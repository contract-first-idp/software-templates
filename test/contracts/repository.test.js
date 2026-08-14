const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const {
  API_VERSION_PATTERN,
  RELEASE_VERSION_PATTERN,
} = require('../helpers/releaseVersion');
const {repositoryRoot: root} = require('../helpers/paths');

const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function localDependencies(templatePath, value) {
  if (Array.isArray(value)) return value.flatMap(child =>
    localDependencies(templatePath, child));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const dependency = key === 'url' && typeof child === 'string' &&
      (child.startsWith('./') || child.startsWith('../'))
      ? [path.resolve(path.dirname(templatePath), child)]
      : [];
    return [...dependency, ...localDependencies(templatePath, child)];
  });
}

describe('registered template contracts', () => {
  const catalog = YAML.parse(read('catalog-info.yaml'));
  const targets = catalog.spec.targets;

  it('registers parseable templates with existing local skeleton dependencies', () => {
    expect(catalog.kind).toBe('Location');
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      const templatePath = path.resolve(root, target);
      const template = YAML.parse(fs.readFileSync(templatePath, 'utf8'));
      expect(template.kind).toBe('Template');
      for (const dependency of localDependencies(templatePath, template)) {
        const stablePrefix = dependency.includes('${{')
          ? dependency.slice(0, dependency.indexOf('${{'))
          : dependency;
        expect(fs.existsSync(stablePrefix)).toBe(true);
      }
    }
  });

  it('publishes repositories without embedded credentials and registers their root entities', () => {
    for (const name of ['domain', 'system', 'api', 'component', 'resource']) {
      const template = YAML.parse(read(`templates/${name}/template.yaml`));
      const publish = template.spec.steps.find(step => step.action === 'publish:github');
      expect(publish.input).not.toHaveProperty('token');
      expect(publish.input.collaborators).toEqual([
        {team: 'domain-maintainers', access: 'maintain'},
        {team: 'domain-contributors', access: 'push'},
        {team: 'domain-viewers', access: 'pull'},
      ]);
      const registrations = template.spec.steps.filter(step =>
        step.action === 'catalog:register');
      expect(registrations).toHaveLength(1);
      expect(registrations[0].input.repoContentsUrl)
        .toBe('${{ steps.publish.output.repoContentsUrl }}');
    }
  });

  it('adds GitOps push webhooks only to repositories that drive discovery', () => {
    for (const name of ['domain', 'system']) {
      const template = YAML.parse(read(`templates/${name}/template.yaml`));
      const webhooks = template.spec.steps.filter(step =>
        ['applicationWebhook', 'applicationSetWebhook'].includes(step.id));
      expect(webhooks.map(step => step.input.webhookUrl)).toEqual([
        '${{ steps.fetchTarget.output.entity.spec.platform.argocd.webhooks.application }}',
        '${{ steps.fetchTarget.output.entity.spec.platform.argocd.webhooks.applicationSet }}',
      ]);
    }
    for (const name of ['api', 'component', 'resource']) {
      const template = YAML.parse(read(`templates/${name}/template.yaml`));
      expect(template.spec.steps.some(step =>
        ['applicationWebhook', 'applicationSetWebhook'].includes(step.id))).toBe(false);
    }
  });

  it('accepts supported immutable and floating API version selectors', () => {
    for (const value of ['v1', 'v2.1.3-rc.1']) {
      expect(RELEASE_VERSION_PATTERN.test(value)).toBe(true);
      expect(API_VERSION_PATTERN.test(value)).toBe(true);
    }
    for (const value of ['latest', 'a'.repeat(40)]) {
      expect(API_VERSION_PATTERN.test(value)).toBe(true);
      expect(RELEASE_VERSION_PATTERN.test(value)).toBe(false);
    }
    for (const value of ['', 'main', 'v1/unsafe']) {
      expect(API_VERSION_PATTERN.test(value)).toBe(false);
      expect(RELEASE_VERSION_PATTERN.test(value)).toBe(false);
    }
  });

  it('does not generate credentials or target the internal image registry', () => {
    const sources = fs.readdirSync(path.join(root, 'skeletons'), {recursive: true})
      .filter(relative => fs.statSync(path.join(root, 'skeletons', relative)).isFile())
      .map(relative => fs.readFileSync(path.join(root, 'skeletons', relative), 'utf8'))
      .join('\n');
    expect(sources).not.toContain('image-registry.openshift-image-registry.svc:5000');
    expect(sources).not.toMatch(/\.dockerconfigjson|BEGIN PRIVATE KEY/);
    expect(sources).not.toMatch(/<clientSecret>(?!\$\{env\.)[^<]+<\/clientSecret>/);
  });
});
