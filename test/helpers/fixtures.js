const { readFile } = require('node:fs/promises');
const path = require('node:path');
const YAML = require('yaml');
const {repositoryRoot} = require('./paths');

function interpolateEnv(template) {
  return template.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    const value = process.env[name];

    if (value === undefined) {
      throw new Error(`Fixture references environment variable ${name}, but it is not set.`);
    }

    return value;
  });
}

async function loadFixtureYaml(relativePath) {
  const fixturePath = path.resolve(repositoryRoot, relativePath);
  const raw = await readFile(fixturePath, 'utf8');
  return YAML.parse(interpolateEnv(raw));
}

module.exports = loadFixtureYaml;
module.exports.loadFixtureYaml = loadFixtureYaml;
