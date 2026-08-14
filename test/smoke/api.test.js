const {getTestConfig} = require('../helpers/env');
const {runDryRun} = require('../helpers/dryRun');
const {parseYamlFile} = require('../helpers/assertions');

test('live Backstage dry-run creates an API from a complete document', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/api',
    fixturePath: 'test/fixtures/inputs/basic/api.yaml',
    domainContractPath: 'test/fixtures/inputs/nonstandard-lifecycle/domain.yaml',
    writeOutput: config.writeOutput,
  });
  expect(parseYamlFile(result, 'api-repo/catalog-info.yaml').kind).toBe('API');
  expect(parseYamlFile(result, 'api-repo/specification.yaml')).toMatchObject({
    openapi: '3.1.0',
    info: {title: 'reviews', description: 'Bookinfo Reviews API', version: '1.2.0'},
  });
  expect(parseYamlFile(result, 'system-pr/apis/reviews/values.yaml'))
    .toHaveProperty('repository');
}, 15000);
