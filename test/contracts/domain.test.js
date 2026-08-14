const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const {validateDomainEnvironmentContract} = require('../helpers/domainContract');
const {repositoryRoot: root} = require('../helpers/paths');

const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const fixture = () => YAML.parse(read('test/fixtures/inputs/nonstandard-lifecycle/domain.yaml'));

describe('portable Domain and admission contracts', () => {
  it('accepts a consistent nonstandard lifecycle without cluster endpoints', () => {
    expect(() => validateDomainEnvironmentContract(fixture())).not.toThrow();
  });

  it.each([
    ['duplicate order', domain => domain.spec.environments.order.push('stage')],
    ['missing definition', domain => delete domain.spec.environments.definitions.stage],
    ['build not first', domain => { domain.spec.environments.build = 'stage'; }],
    ['tenant cluster domain', domain => {
      domain.spec.environments.definitions.stage.clusterDomain = 'apps.example';
    }],
  ])('rejects %s', (_name, mutate) => {
    const domain = fixture();
    mutate(domain);
    expect(() => validateDomainEnvironmentContract(domain)).toThrow();
  });

  it('selects typed platform targets and creates one independent admission directory', () => {
    const template = YAML.parse(read('templates/domain/template.yaml'));
    const properties = template.spec.parameters[0].properties;
    expect(properties.platformTarget['ui:options'].catalogFilter).toEqual([
      {kind: 'Resource', 'spec.type': 'contract-first-idp-target'},
    ]);
    expect(template.spec.steps.filter(step => step.id === 'renderAdmission')).toHaveLength(1);
    expect(template.spec.steps.find(step => step.id === 'fetchTargetValues')).toBeUndefined();
    expect(template.spec.steps.find(step => step.id === 'parseTargetValues')).toBeUndefined();
    expect(template.spec.steps.some(step => step.action?.startsWith('roadiehq:'))).toBe(false);
    expect(template.spec.steps.find(step => step.id === 'renderAdmission').input.targetPath)
      .toContain('spec.platform.tenantAdmission.path');
    expect(template.spec.steps.find(step => step.id === 'renderAdmission').input.values)
      .toMatchObject({
        keycloakNamespace:
          '${{ steps.fetchTarget.output.entity.spec.platform.security.keycloak.namespace }}',
        secretsNamespace:
          '${{ steps.fetchTarget.output.entity.spec.platform.security.secrets.namespace }}',
      });
    expect(template.spec.steps.find(step => step.id === 'platformPr').action)
      .toBe('publish:github:pull-request');
    expect(template.spec.steps.find(step => step.id === 'platformPr').input.targetBranchName)
      .toContain('spec.platform.tenantAdmission.branch');
  });

});
