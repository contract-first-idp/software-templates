const {getTestConfig} = require('../helpers/env');
const {runDryRun} = require('../helpers/dryRun');
const {expectFile, parseYamlFile} = require('../helpers/assertions');

test('live Backstage dry-run creates a System and build activation', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/system',
    fixturePath: 'test/fixtures/inputs/basic/system.yaml',
    domainContractPath: 'test/fixtures/inputs/nonstandard-lifecycle/domain.yaml',
    writeOutput: config.writeOutput,
  });
  expect(parseYamlFile(result, 'system-repo/catalog-info.yaml')).toMatchObject({
    kind: 'System',
    spec: {groupId: 'io.github.cfidp.bookinfo'},
  });
  expectFile(result, 'domain-pr/systems/bookinfo/environments/sandbox.yaml');
});
