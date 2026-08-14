const {getTestConfig} = require('../helpers/env');
const {runDryRun} = require('../helpers/dryRun');
const {expectFile, parseYamlFile} = require('../helpers/assertions');

test('live Backstage dry-run creates a PostgreSQL Resource', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/resource',
    fixturePath: 'test/fixtures/inputs/basic/resource.yaml',
    domainContractPath: 'test/fixtures/scenarios/bookinfo/domain.yaml',
    writeOutput: config.writeOutput,
  });
  expect(parseYamlFile(result, 'resource-repo/catalog-info.yaml').kind).toBe('Resource');
  expectFile(result, 'system-pr/resources/postgresql/reviews-db/values.yaml');
  expectFile(result, 'system-pr/resources/postgresql/reviews-db/environments/dev.yaml');
}, 15000);
