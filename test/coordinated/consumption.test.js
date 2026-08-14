const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const {repositoryRoot: root} = require('../helpers/paths');

const chartsRoot = path.resolve(
  root, process.env.DEVELOPER_CHARTS_DIR || '../developer-charts');
const platformRoot = path.resolve(
  root, process.env.PLATFORM_COMPONENTS_DIR || '../platform-components');
const read = (base, relative) => fs.readFileSync(path.join(base, relative), 'utf8');

describe('generated Git output is consumed at the exact coordinated paths', () => {
  test('the sibling platform root catalog remains the single target contract', () => {
    expect(fs.existsSync(path.join(
      platformRoot, 'targets/workshop/domain-values.yaml'))).toBe(false);
    expect(YAML.parse(read(platformRoot, 'catalog-info.yaml'))).toMatchObject({
      kind: 'Resource',
      spec: {
        type: 'contract-first-idp-target',
        platform: {configuration: {valuesPath: 'catalog-info.yaml'}},
      },
    });
  });

  test.each([
    {
      entity: 'System',
      producer: ['templates/system/template.yaml',
        'targetPath: domain-pr/systems/${{ parameters.systemName }}/environments'],
      output: ['skeletons/system/domain-repo/${{ values.environment }}.yaml'],
      consumer: ['charts/domain/environment/templates/applicationset.yaml',
        'path: systems/*/environments/{{ $environment }}.yaml'],
    },
    {
      entity: 'API',
      producer: ['templates/api/template.yaml',
        'targetPath: system-pr/apis/${{ parameters.apiId }}'],
      output: ['skeletons/api/system-repo/values.yaml'],
      consumer: ['charts/system/environment/templates/api-applicationset.yaml',
        'path: apis/*/values.yaml'],
    },
    {
      entity: 'Component environment',
      producer: ['templates/component/template.yaml',
        'targetPath: system-pr/components/${{ parameters.componentName }}/environments'],
      output: ['skeletons/component/system-repo/environment/${{ values.environment }}.yaml'],
      consumer: ['charts/system/environment/templates/component-applicationset.yaml',
        'path: components/*/environments/{{ .Values.environment.name }}.yaml'],
    },
    {
      entity: 'Component base',
      producer: ['templates/component/template.yaml',
        'targetPath: system-pr/components/${{ parameters.componentName }}'],
      output: ['skeletons/component/system-repo/base/values.yaml'],
      consumer: ['charts/system/environment/templates/component-applicationset.yaml',
        "'$values/components/{{ \"{{ index .path.segments 1 }}\" }}/values.yaml'"],
    },
    {
      entity: 'Component release',
      producer: ['templates/component/promotion.yaml',
        'targetPath: system-pr/components/${{ steps.fetchComponent.output.entity.metadata.name }}/releases'],
      output: ['skeletons/component/promotion/${{ values.targetEnvironment }}.yaml'],
      consumer: ['charts/system/environment/templates/component-applicationset.yaml',
        "'$values/components/{{ \"{{ index .path.segments 1 }}\" }}/releases/{{ .Values.environment.name }}.yaml'"],
    },
    {
      entity: 'Resource base',
      producer: ['templates/resource/template.yaml',
        'targetPath: system-pr/resources/${{ parameters.profile }}/${{ parameters.resourceName }}'],
      output: ['skeletons/resource/implementations/postgresql/system-repo/base/values.yaml'],
      consumer: ['charts/system/environment/templates/resource-applicationset.yaml',
        'path: resources/*/*/values.yaml'],
    },
    {
      entity: 'Resource',
      producer: ['templates/resource/template.yaml',
        'targetPath: system-pr/resources/${{ parameters.profile }}/${{ parameters.resourceName }}/environments'],
      output: ['skeletons/resource/implementations/postgresql/system-repo/environment/${{ values.environment }}.yaml'],
      consumer: ['charts/system/environment/templates/resource-applicationset.yaml',
        'path: resources/*/*/environments/{{ .Values.environment.name }}.yaml'],
    },
  ])('$entity producer output matches its active chart consumer', contract => {
    expect(read(root, contract.producer[0])).toContain(contract.producer[1]);
    expect(fs.existsSync(path.join(root, contract.output[0]))).toBe(true);
    expect(read(chartsRoot, contract.consumer[0])).toContain(contract.consumer[1]);
  });

  test('System activation writes the same path consumed by Domain discovery', () => {
    expect(read(root, 'templates/system/activation.yaml')).toContain(
      'targetPath: domain-pr/systems/${{ steps.fetchSystem.output.entity.metadata.name }}/environments',
    );
    expect(fs.existsSync(path.join(
      root, 'skeletons/system/domain-repo/${{ values.environment }}.yaml'))).toBe(true);
    expect(read(
      chartsRoot, 'charts/domain/environment/templates/applicationset.yaml',
    )).toContain('path: systems/*/environments/{{ $environment }}.yaml');
  });

  test('Domain admission output is recursively consumed with ordered sync waves', () => {
    const domainTemplate = read(root, 'templates/domain/template.yaml');
    expect(domainTemplate).toContain(
      'targetPath: platform-pr/${{ steps.fetchTarget.output.entity.spec.platform.tenantAdmission.path }}/${{ parameters.domainName }}',
    );
    const project = YAML.parse(read(
      root, 'skeletons/domain/platform-admission/project.yaml'));
    const application = YAML.parse(read(
      root, 'skeletons/domain/platform-admission/application.yaml'));
    expect(project.metadata.annotations['argocd.argoproj.io/sync-wave']).toBe('0');
    expect(application.metadata.annotations['argocd.argoproj.io/sync-wave']).toBe('1');

    const applicationSet = YAML.parse(read(
      platformRoot, 'bootstrap/root/platform-applicationset.yaml'));
    const inventory = applicationSet.spec.generators[0].matrix.generators[1].list.elements;
    expect(inventory.find(item => item.name === 'tenant-admissions')).toMatchObject({
      path: 'tenants', renderer: 'directory',
    });
    expect(applicationSet.spec.templatePatch).toMatch(
      /if eq \(get \. "renderer" \| default "kustomize"\) "directory"[\s\S]*directory:\s*\n\s+recurse: true/,
    );
    expect(fs.existsSync(path.join(platformRoot, 'tenants/kustomization.yaml'))).toBe(false);
  });
});
