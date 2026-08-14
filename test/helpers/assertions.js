const YAML = require('yaml');

function expectFile(result, filePath) {
  expect(result.files[filePath]).toBeDefined();
  return result.files[filePath];
}

function expectNoFile(result, filePath) {
  expect(result.files[filePath]).toBeUndefined();
}

function expectFileToContain(result, filePath, text) {
  const content = expectFile(result, filePath);
  expect(content).toContain(text);
  return content;
}

function parseYamlFile(result, filePath) {
  return YAML.parse(expectFile(result, filePath));
}

function expectScmCoordinates(entity, repositoryName) {
  expect(entity.metadata.annotations).toMatchObject({
    'contract-first-idp.github.io/scm-provider': 'github',
    'contract-first-idp.github.io/scm-host': 'github.com',
    'contract-first-idp.github.io/domain-org': 'contract-first-idp',
    'contract-first-idp.github.io/domain-repo': 'software-templates',
    'contract-first-idp.github.io/repository-name': repositoryName,
  });
  expect(entity.metadata.annotations['contract-first-idp.github.io/repo-url']).toBeUndefined();
  expect(entity.metadata.annotations['contract-first-idp.github.io/repo-clone-url']).toBeUndefined();
}

function getLogMessages(result) {
  return (result.log || [])
    .map(entry => entry?.body?.message)
    .filter(Boolean);
}

module.exports = {
  expectFile,
  expectNoFile,
  expectFileToContain,
  expectScmCoordinates,
  parseYamlFile,
  getLogMessages,
};
