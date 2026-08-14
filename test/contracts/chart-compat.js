const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nunjucks = require('nunjucks');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const YAML = require('yaml');
const {repositoryRoot: root} = require('../helpers/paths');

const charts = process.env.DEVELOPER_CHARTS_DIR || '../developer-charts';
const chartsRoot = path.resolve(root, charts);
if (!fs.existsSync(path.join(chartsRoot, 'charts/domain/environment/Chart.yaml'))) {
  console.error(`DEVELOPER_CHARTS_DIR is not a developer-charts checkout: ${chartsRoot}`);
  process.exit(2);
}
const platformRoot = path.resolve(
  root, process.env.PLATFORM_COMPONENTS_DIR || '../platform-components');
const targetPath = path.join(platformRoot, 'catalog-info.yaml');
if (!fs.existsSync(targetPath)) {
  console.error(`Workshop target catalog does not exist: ${targetPath}`);
  process.exit(2);
}

const environment = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: true,
  tags: {variableStart: '${{', variableEnd: '}}'},
});
const values = {
  domainName: 'retail',
  title: 'Retail',
  description: 'Retail domain',
  groupId: 'com.example',
  platformTarget: 'resource:default/workshop',
  organization: 'retail-team',
  repositoryName: 'retail-domain',
  environment: 'stage',
  scmProvider: 'github',
  tenantScmHost: 'tenant.example',
  argocdNamespace: 'openshift-gitops',
  argocdDestinationServer: 'https://kubernetes.default.svc',
  registryHost: 'quay.example',
  registryClusterId: 'west',
  sourcePullSecretName: 'source-registry-auth',
  destinationPushSecretName: 'destination-registry-auth',
  runtimePullSecretName: 'runtime-registry-auth',
  buildSourceRevision: 'main',
  buildSccClusterRoleName: 'system:openshift:scc:pipelines-scc',
  deploymentUpdateStrategy: 'restart',
  buildEnvironment: 'sandbox',
  environments: [
    {name: 'sandbox', namespaceSuffix: '-build'},
    {name: 'stage', namespaceSuffix: '-preprod'},
    {name: 'production', namespaceSuffix: ''},
  ],
};
function mergeValues(base, overlay) {
  if (!base || typeof base !== 'object' || Array.isArray(base) ||
      !overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    return overlay;
  }
  const merged = {...base};
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = key in merged ? mergeValues(merged[key], value) : value;
  }
  return merged;
}

const catalogSource = fs.readFileSync(
  path.join(root, 'skeletons/domain/base/catalog-info.yaml'), 'utf8');
const tenantCatalog = YAML.parse(environment.renderString(catalogSource, {values}));
const targetCatalog = YAML.parse(fs.readFileSync(targetPath, 'utf8'));
const domainChartMetadata = YAML.parse(fs.readFileSync(
  path.join(chartsRoot, 'charts/domain/environment/Chart.yaml'), 'utf8'));
const selectedCharts = targetCatalog.spec.platform.dependencies.developerCharts;
if (selectedCharts.revision !== `v${domainChartMetadata.version}` ||
    selectedCharts.version !== domainChartMetadata.version) {
  throw new Error(
    'Platform developer-charts revision/version does not match distributed chart versions');
}
if (targetCatalog.spec.platform.dependencies.softwareTemplates.catalogPath !==
    'catalog-info.yaml') {
  throw new Error('Platform software-template dependency lost the root catalog convention');
}
const mergedDomainValues = mergeValues(targetCatalog, tenantCatalog);
const domainSchema = JSON.parse(fs.readFileSync(
  path.join(chartsRoot, 'charts/domain/environment/values.schema.json'), 'utf8'));
const ajv = new Ajv({allErrors: true, strict: false});
addFormats(ajv);
const validateDomainValues = ajv.compile(domainSchema);
if (!validateDomainValues(mergedDomainValues)) {
  throw new Error(
    `Real target/Domain values failed Domain schema validation:\n${JSON.stringify(
      validateDomainValues.errors, null, 2)}`,
  );
}
if (mergedDomainValues.spec.type !== 'contract-first-idp-target') {
  throw new Error('Real merged values did not retain target spec.type');
}
console.log(`Real target/Domain values pass ${path.join(
  chartsRoot, 'charts/domain/environment/values.schema.json')}`);

if (process.env.CHART_COMPAT_SCHEMA_ONLY === '1') {
  console.log('Direct JSON Schema compatibility passed; Helm checks were not requested.');
  process.exit(0);
}

const helmProbe = spawnSync('helm', ['version', '--short'], {encoding: 'utf8'});
if (helmProbe.error?.code === 'ENOENT') {
  console.log('Helm is unavailable; direct JSON Schema compatibility passed and Helm checks were skipped.');
  process.exit(0);
}
if (helmProbe.error) {
  throw new Error(`Unable to execute helm: ${helmProbe.error.message}`);
}
if (helmProbe.status !== 0) {
  throw new Error(`Unable to execute helm: ${helmProbe.stderr || helmProbe.stdout}`);
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'chart-compat-'));

function renderChart(chart, documents) {
  const files = documents.map((document, index) => {
    const file = path.join(temporary, `${chart.replaceAll('/', '-')}-${index}.yaml`);
    fs.writeFileSync(file, typeof document === 'string' ? document : YAML.stringify(document));
    return file;
  });
  const result = spawnSync('helm', [
    'template', 'compat', path.join(chartsRoot, chart),
    ...files.flatMap(file => ['-f', file]),
  ], {encoding: 'utf8'});
  if (result.error) {
    throw new Error(`Unable to execute helm: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${chart} compatibility failed\n${result.stdout || ''}${result.stderr || ''}`);
  }
  return YAML.parseAllDocuments(result.stdout)
    .map(document => document.toJSON()).filter(Boolean);
}

try {
  const domainResources = renderChart('charts/domain/environment', [
    targetCatalog,
    tenantCatalog,
  ]);
  const domainApplicationSet = domainResources.find(resource => resource.kind === 'ApplicationSet');
  if (!domainApplicationSet) {
    throw new Error('Generated Domain values did not render an ApplicationSet');
  }
  const trustedInputs = domainApplicationSet.spec.template.spec.sources[0].helm.valuesObject;
  if (trustedInputs.environment.clusterDomain !==
        targetCatalog.spec.platform.cluster.routerDomain ||
      trustedInputs.schemaRegistry.apiUrl !==
        targetCatalog.spec.platform.schemaRegistry.apiUrl) {
    throw new Error('Tenant Domain values replaced trusted platform endpoints');
  }

  const systemDeclaration = YAML.parse(environment.renderString(
    fs.readFileSync(
      path.join(root, 'skeletons/system/domain-repo/${{ values.environment }}.yaml'),
      'utf8',
    ),
    {
      values: {
        systemName: 'orders',
        groupId: 'com.example.orders',
        systemRepoCloneUrl: 'https://tenant.example/retail-team/orders-system.git',
        systemRepoRevision: 'main',
      },
    },
  ));
  const lifecycle = {
    order: ['sandbox', 'stage', 'production'],
    definitions: {
      sandbox: {namespaceSuffix: '-build', clusterDomain: 'apps.build.example'},
      stage: {namespaceSuffix: '-preprod', clusterDomain: 'apps.stage.example'},
      production: {namespaceSuffix: '', clusterDomain: 'apps.example'},
    },
  };
  const systemResources = renderChart('charts/system/environment', [{
    domainName: 'retail',
    systemName: systemDeclaration.systemName,
    groupId: systemDeclaration.groupId,
    owner: 'group:default/domain-maintainers',
    systemRepository: {
      url: systemDeclaration.repository.cloneUrl,
      revision: systemDeclaration.repository.revision,
    },
    environment: {
      name: 'stage',
      namespaceSuffix: '-preprod',
      clusterDomain: 'apps.stage.example',
    },
    delivery: {
      namespace: 'openshift-gitops',
      project: 'tenant-retail-orders',
      destinationServer: 'https://kubernetes.default.svc',
      charts: {
        repository: 'https://platform.example/platform/developer-charts.git',
        revision: 'main',
      },
    },
    environments: lifecycle,
    registry: {
      host: 'quay.example',
      clusterId: 'west',
      credentials: {
        sourcePullSecretName: 'source-registry-auth',
        destinationPushSecretName: 'destination-registry-auth',
        runtimePullSecretName: 'runtime-registry-auth',
      },
    },
    schemaRegistry: targetCatalog.spec.platform.schemaRegistry,
    microcks: targetCatalog.spec.platform.services.microcks,
    spectralRules: targetCatalog.spec.platform.spectralRules,
    build: {
      environment: 'sandbox',
      namespaceSuffix: '-build',
      sourceRevision: 'main',
      sccClusterRoleName: 'system:openshift:scc:pipelines-scc',
      deploymentUpdate: {strategy: 'restart'},
    },
  }]);
  if (!systemResources.some(resource => resource.kind === 'Namespace') ||
      !systemResources.some(resource => resource.kind === 'ApplicationSet')) {
    throw new Error('Generated System values did not render its high-level resources');
  }

  const apiValues = YAML.parse(environment.renderString(
    fs.readFileSync(path.join(root, 'skeletons/api/system-repo/values.yaml'), 'utf8'),
    {values: {apiRepoCloneUrl: 'https://tenant.example/retail-team/orders-api.git'}},
  ));
  const apiResources = renderChart('charts/api/openapi', [{
    ...apiValues,
    systemName: 'orders',
    groupId: 'com.example.orders',
    apiName: 'orders',
    revision: 'main',
    serviceAccountName: 'orders-build',
    schemaRegistry: {apiUrl: 'https://registry.example/apis/registry/v3'},
    spectralRules: targetCatalog.spec.platform.spectralRules,
  }]);
  if (!apiResources.some(resource =>
    resource.kind === 'Pipeline' || resource.kind === 'EventListener')) {
    throw new Error('Generated API values did not render a Pipeline or trigger resource');
  }

  const componentValues = {
    ...values,
    componentName: 'checkout',
    implementationProfile: 'quarkus-camel-openapi',
    buildEnabled: false,
    componentRepoCloneUrl: 'https://tenant.example/retail-team/checkout.git',
    sourceRevision: 'main',
    buildProfile: 'quarkus-jvm',
    releaseVersion: 'v1.2.3',
    targetEnvironment: 'stage',
  };
  const render = relative => environment.renderString(
    fs.readFileSync(path.join(root, relative), 'utf8'),
    {values: componentValues},
  );

  const componentEnvironmentResources = renderChart('charts/component/container', [
    render('skeletons/component/system-repo/base/values.yaml'),
    render('skeletons/component/system-repo/environment/${{ values.environment }}.yaml'),
    {
      systemName: 'orders',
      componentName: 'checkout',
      environment: 'stage',
      namespace: 'orders-preprod',
      image: {repository: 'quay.example/west_orders-preprod/checkout'},
      build: {
        environment: 'sandbox',
        serviceAccountName: 'orders-build',
        registryPushSecretName: 'destination-registry-auth',
      },
      promotion: {sourceEnvironment: 'sandbox'},
    },
  ]);
  if (!componentEnvironmentResources.some(resource => resource.kind === 'ImageStream') ||
      componentEnvironmentResources.some(resource =>
        ['Deployment', 'Service', 'Route'].includes(resource.kind))) {
    throw new Error('Environment-only Component state did not render only its ImageStream');
  }

  const buildComponentValues = {...componentValues, environment: 'sandbox', buildEnabled: true};
  const renderBuildComponent = relative => environment.renderString(
    fs.readFileSync(path.join(root, relative), 'utf8'),
    {values: buildComponentValues},
  );
  const buildComponentResources = renderChart('charts/component/container', [
    renderBuildComponent('skeletons/component/system-repo/base/values.yaml'),
    renderBuildComponent(
      'skeletons/component/system-repo/environment/${{ values.environment }}.yaml'),
    renderBuildComponent(
      'skeletons/component/system-repo/base/releases/${{ values.buildEnvironment }}.yaml'),
    {
      systemName: 'orders',
      componentName: 'checkout',
      environment: 'sandbox',
      namespace: 'orders-build',
      image: {repository: 'quay.example/west_orders-build/checkout'},
      build: {
        environment: 'sandbox',
        imageRepository: 'quay.example/west_orders-build/checkout',
        serviceAccountName: 'orders-build',
        registryPushSecretName: 'destination-registry-auth',
      },
    },
  ]);
  for (const kind of ['ImageStream', 'Pipeline', 'Deployment', 'Service', 'Route']) {
    if (!buildComponentResources.some(resource => resource.kind === kind)) {
      throw new Error(`Build Component state did not render ${kind}`);
    }
  }

  const promotedComponentResources = renderChart('charts/component/container', [
    render('skeletons/component/system-repo/base/values.yaml'),
    render('skeletons/component/system-repo/environment/${{ values.environment }}.yaml'),
    render('skeletons/component/promotion/${{ values.targetEnvironment }}.yaml'),
    {
      systemName: 'orders',
      componentName: 'checkout',
      environment: 'stage',
      namespace: 'orders-preprod',
      image: {repository: 'quay.example/west_orders-preprod/checkout'},
      build: {
        environment: 'sandbox',
        serviceAccountName: 'orders-build',
        registryPushSecretName: 'destination-registry-auth',
      },
      promotion: {sourceEnvironment: 'sandbox'},
    },
  ]);
  for (const kind of ['ImageStream', 'Deployment', 'Service', 'Route', 'Job']) {
    if (!promotedComponentResources.some(resource => resource.kind === kind)) {
      throw new Error(`Promoted Component state did not render ${kind}`);
    }
  }

  const resourceValues = {
    resourceName: 'orders-db',
    postgresVersion: 16,
    replicaCount: 1,
    storageClass: 'fast-block',
    userName: 'orders_owner',
    databaseName: 'orders',
    storageSize: '10Gi',
    environment: 'stage',
  };
  const renderResource = relative => environment.renderString(
    fs.readFileSync(path.join(root, relative), 'utf8'),
    {values: resourceValues},
  );
  renderChart('charts/resource/postgresql', [
    renderResource(
      'skeletons/resource/implementations/postgresql/system-repo/base/values.yaml'),
    renderResource(
      'skeletons/resource/implementations/postgresql/system-repo/environment/${{ values.environment }}.yaml'),
    {systemName: 'orders', clusterName: 'orders-db-stage'},
  ]);

  console.log(`Template-generated chart inputs are compatible with ${chartsRoot}`);
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
