const fs = require('node:fs');
const path = require('node:path');
const jsonata = require('jsonata');
const YAML = require('yaml');
const {repositoryRoot: root} = require('../helpers/paths');

function properties(profile) {
  const source = fs.readFileSync(path.join(
    root,
    'skeletons/component/implementations',
    profile,
    'src/main/resources/application.properties',
  ), 'utf8');

  return Object.fromEntries(source.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
}

test('Quarkus scaffolds expose health on the quarkus-jvm runtime management port', async () => {
  const template = YAML.parse(fs.readFileSync(
    path.join(root, 'templates/component/template.yaml'), 'utf8'));
  const resolveBuildProfile = template.spec.steps.find(step =>
    step.id === 'resolveBuildProfile');
  const runtimeContracts = new Map([
    ['quarkus-jvm', {healthPort: 9000}],
  ]);

  for (const profile of [
    'quarkus-camel-openapi',
    'quarkus-camel-openapi-yaml',
  ]) {
    const runtimeProfile = await jsonata(resolveBuildProfile.input.expression).evaluate({
      implementationProfile: profile,
      quarkusBuildTarget: 'jvm',
    });
    const runtimeContract = runtimeContracts.get(runtimeProfile);
    const configuration = properties(profile);
    expect(runtimeContract).toBeDefined();
    expect(configuration['quarkus.management.enabled']).toBe('true');
    expect(Number(configuration['quarkus.management.port'])).toBe(runtimeContract.healthPort);
  }
});
