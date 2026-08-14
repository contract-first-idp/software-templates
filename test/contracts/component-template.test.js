const fs = require('node:fs');
const path = require('node:path');
const jsonata = require('jsonata');
const YAML = require('yaml');
const {repositoryRoot: root} = require('../helpers/paths');

const source = fs.readFileSync(
  path.join(root, 'templates/component/template.yaml'), 'utf8');
const template = YAML.parse(source);

function step(id) {
  const match = template.spec.steps.find(candidate => candidate.id === id);
  expect(match).toBeDefined();
  return match;
}

function apiEntity({namespace = 'default', name, group, artifact = name}) {
  return {
    kind: 'API',
    metadata: {
      namespace,
      name,
      annotations: {
        'contract-first-idp.github.io/schema-registry-group-id': group,
        'contract-first-idp.github.io/schema-registry-artifact-id': artifact,
        'contract-first-idp.github.io/scm-provider': 'gitea',
        'contract-first-idp.github.io/scm-host': 'git.example',
        'contract-first-idp.github.io/domain-org': 'ignored',
        'contract-first-idp.github.io/repository-name': 'ignored-api',
      },
    },
    spec: {type: 'openapi', definition: 'ignored source definition'},
  };
}

test('Component connects API resolution to implementation and desired-state rendering', () => {
  for (const id of [
    'fetchSystem', 'fetchDomain', 'fetchTarget', 'resolveBuildProfile',
    'resolveApiMetadata', 'fetchConsumedContracts', 'discoverConsumedOperations',
    'renderImplementation', 'renderBase', 'renderComponentDesiredState',
    'publish', 'register', 'systemPr',
  ]) expect(step(id)).toBeDefined();
  expect(step('resolveBuildProfile').action).toBe('roadiehq:utils:jsonata');
  expect(step('resolveApiMetadata').action).toBe('roadiehq:utils:jsonata');
});

test('provided and consumed API pickers require OpenAPI entities', () => {
  const parameters = template.spec.parameters.find(section =>
    section.properties?.implementationProfile);
  expect(parameters.properties.implementationProfile.default)
    .toBe('quarkus-camel-openapi');
  expect(parameters.properties.implementationProfile.enum).toContain('nodejs-openapi');
  const quarkus = parameters.dependencies.implementationProfile.oneOf.find(branch =>
    branch.properties?.quarkusBuildTarget);
  expect(quarkus.properties.quarkusBuildTarget).toMatchObject({
    default: 'jvm', enum: ['jvm', 'native'],
  });
  const consumed = parameters.properties.consumedApis.items.properties;
  expect(consumed.apiRef['ui:options'].catalogFilter)
    .toEqual([{kind: 'API', 'spec.type': 'openapi'}]);
  const provided = parameters.dependencies.implementsApi.oneOf.find(
    branch => branch.properties?.implementsApi?.const === true,
  ).properties;
  expect(provided.apiRef['ui:options'].catalogFilter)
    .toEqual([{kind: 'API', 'spec.type': 'openapi'}]);
  expect(provided.providedApiVersion.pattern).toBe(consumed.version.pattern);
});

test.each([
  ['quarkus-camel-openapi', 'jvm', 'quarkus-jvm'],
  ['quarkus-camel-openapi-yaml', 'native', 'quarkus-native'],
  ['spring-boot-camel-openapi', 'jvm', 'spring-boot'],
  ['spring-boot-openapi', 'jvm', 'spring-boot'],
  ['nodejs-openapi', 'jvm', 'nodejs'],
])('resolves %s/%s to the approved %s recipe', async (
  implementationProfile, quarkusBuildTarget, expected,
) => {
  const result = await jsonata(step('resolveBuildProfile').input.expression).evaluate({
    implementationProfile, quarkusBuildTarget,
  });
  expect(result).toBe(expected);
});

test('Component consumes target and catalog each outputs directly', () => {
  expect(source).toContain(
    'steps.fetchTarget.output.entity.spec.platform.schemaRegistry.apiUrl');
  expect(source).toContain(
    'steps.fetchTarget.output.entity.spec.platform.cluster.routerDomain');
  expect(source).not.toContain('domain-values.yaml');
  expect(step('fetchConsumedApis')).toMatchObject({
    each: '${{ parameters.consumedApis }}',
    action: 'catalog:fetch',
    input: {
      entityRef: '${{ each.value.apiRef }}',
      defaultKind: 'API',
      defaultNamespace: 'default',
    },
  });
  expect(step('resolveApiMetadata').input.data.consumedEntities)
    .toContain('steps.fetchConsumedApis.output.entity');
});

test('API resolution maps metadata to Apicurio URLs without source validation', async () => {
  const expressionSource = step('resolveApiMetadata').input.expression;
  for (const forbidden of [
    '$assert', 'spec.definition', 'scm-provider', 'scm-host', 'domain-org',
    'repository-name',
  ]) expect(expressionSource).not.toContain(forbidden);
  expect(source).not.toContain('raw.githubusercontent.com');
  expect(source).not.toMatch(/\/raw\/(?:tag|commit)?/);

  const sha = '0123456789abcdef0123456789abcdef01234567';
  const result = await jsonata(expressionSource).evaluate({
    providedEntity: apiEntity({name: 'orders', group: 'io.example.orders'}),
    providedVersion: 'v1.2.0',
    consumedEntities: [
      apiEntity({namespace: 'customers', name: 'lookup', group: 'io.example/customers'}),
      apiEntity({namespace: 'payments', name: 'authorization', group: 'io.example.payments'}),
      apiEntity({namespace: 'vendor', name: 'details', group: 'com.vendor.catalog'}),
    ],
    consumedSelections: [
      {version: 'latest'}, {version: 'v2.1.3'}, {version: sha},
    ],
    schemaRegistryApiUrl: 'https://registry.example/apis/registry/v3/',
  });
  expect(result.provided_api).toEqual({
    ref: 'api:default/orders',
    name: 'orders',
    registry_group_id: 'io.example.orders',
    registry_artifact_id: 'orders',
    contract_file: 'orders-api.yaml',
    version: 'v1.2.0',
  });
  expect(result.consumed_apis.map(api => [
    api.version, api.registry_version_selector,
  ])).toEqual([
    ['latest', 'branch=latest'], ['v2.1.3', 'v2.1.3'], [sha, sha],
  ]);
  expect(result.consumed_apis[0].content_url).toBe(
    'https://registry.example/apis/registry/v3/groups/' +
    'io.example%2Fcustomers/artifacts/lookup/versions/branch%3Dlatest/content');
  expect(result.consumed_apis[1].content_url)
    .toContain('/versions/v2.1.3/content');
  expect(result.consumed_apis[2].content_url)
    .toContain('/versions/' + sha + '/content');
});

test('consumed contracts use one Apicurio fetch and parse path', () => {
  expect(step('fetchConsumedContracts')).toMatchObject({
    each: '${{ steps.resolveApiMetadata.output.result.consumed_apis }}',
    action: 'fetch:plain:file',
    input: {
      url: '${{ each.value.content_url }}',
      targetPath: 'consumed-contracts/${{ each.key }}-${{ each.value.contract_file }}',
    },
  });
  expect(step('parseConsumedContracts')).toMatchObject({
    each: '${{ steps.resolveApiMetadata.output.result.consumed_apis }}',
    action: 'roadiehq:utils:fs:parse',
    input: {
      path: 'consumed-contracts/${{ each.key }}-${{ each.value.contract_file }}',
    },
  });
  expect(template.spec.steps.filter(candidate =>
    candidate.action === 'fetch:plain:file')).toHaveLength(1);
  expect(source).not.toContain('provided-contract/');
});

test('duplicate API versions retain stable names and isolated operations', async () => {
  const entity = apiEntity({
    namespace: 'customers', name: 'lookup', group: 'io.example.customers',
  });
  const resolved = await jsonata(step('resolveApiMetadata').input.expression).evaluate({
    providedEntity: null,
    providedVersion: null,
    consumedEntities: [entity, entity],
    consumedSelections: [{version: 'v1.0.0'}, {version: 'v2.0.0'}],
    schemaRegistryApiUrl: 'https://registry.example/apis/registry/v3',
  });
  expect(resolved.consumed_apis.map(api => ({
    version: api.version,
    contract_file: api.contract_file,
  }))).toEqual([
    {version: 'v1.0.0', contract_file: 'customers-lookup-api.yaml'},
    {version: 'v2.0.0', contract_file: 'customers-lookup-api.yaml'},
  ]);

  const discovered = await jsonata(
    step('discoverConsumedOperations').input.expression,
  ).evaluate({
    apis: resolved.consumed_apis,
    parsedContracts: [
      {paths: {'/v1/customers': {get: {operationId: 'listCustomersV1'}}}},
      {paths: {'/v2/customers': {post: {operationId: 'createCustomerV2'}}}},
    ],
  });
  expect(discovered.consumed_apis.map(api => ({
    version: api.version,
    operations: api.operations,
  }))).toEqual([
    {version: 'v1.0.0', operations: [{
      operation_id: 'listCustomersV1', method: 'get',
      path: '/v1/customers', summary: '',
    }]},
    {version: 'v2.0.0', operations: [{
      operation_id: 'createCustomerV2', method: 'post',
      path: '/v2/customers', summary: '',
    }]},
  ]);
});

test('operation discovery ignores missing IDs and does not reject duplicates', async () => {
  const result = await jsonata(step('discoverConsumedOperations').input.expression)
    .evaluate({
      apis: [{name: 'customers'}],
      parsedContracts: [{paths: {
        '/customers/{id}': {
          get: {operationId: 'getCustomer', summary: 'Get a customer'},
          post: {summary: 'Missing ID'},
          trace: {operationId: 'traceCustomer'},
        },
        '/customers': {
          get: {operationId: 'getCustomer', summary: 'Duplicate accepted'},
        },
      }}],
    });
  expect(result.consumed_apis[0].operations).toEqual([
    {operation_id: 'getCustomer', method: 'get',
      path: '/customers/{id}', summary: 'Get a customer'},
    {operation_id: 'traceCustomer', method: 'trace',
      path: '/customers/{id}', summary: ''},
    {operation_id: 'getCustomer', method: 'get',
      path: '/customers', summary: 'Duplicate accepted'},
  ]);
});

test('API resolution and operation discovery preserve the no-API path', async () => {
  const resolved = await jsonata(step('resolveApiMetadata').input.expression).evaluate({
    providedEntity: null,
    providedVersion: null,
    consumedEntities: [],
    consumedSelections: [],
    schemaRegistryApiUrl: 'https://registry.example/apis/registry/v3',
  });
  expect(resolved).toEqual({provided_api: null, consumed_apis: []});
  const discovered = await jsonata(
    step('discoverConsumedOperations').input.expression,
  ).evaluate({apis: []});
  expect(discovered).toEqual({consumed_apis: []});
});

test('resolved APIs reach rendering and desired state owns initial release', () => {
  for (const id of ['renderImplementation', 'renderBase']) {
    expect(step(id).input.values.provided_api)
      .toBe('${{ steps.resolveApiMetadata.output.result.provided_api }}');
    expect(step(id).input.values.consumed_apis)
      .toBe('${{ steps.discoverConsumedOperations.output.result.consumed_apis }}');
  }
  expect(step('renderComponentDesiredState').input.values).toMatchObject({
    buildProfile: '${{ steps.resolveBuildProfile.output.result }}',
    buildEnabled: true,
    sourceRevision: 'main',
    buildEnvironment: '${{ steps.fetchDomain.output.entity.spec.environments.build }}',
  });
  expect(step('renderComponentDesiredState').input.values).not.toHaveProperty('dockerfilePath');
  expect(source).not.toContain("'quarkus' in parameters.implementationProfile");
  expect(fs.existsSync(path.join(root,
    'skeletons/component/system-repo/base/releases/${{ values.buildEnvironment }}.yaml')))
    .toBe(true);
  expect(fs.existsSync(path.join(root, 'skeletons/component/system-repo/release')))
    .toBe(false);
});
