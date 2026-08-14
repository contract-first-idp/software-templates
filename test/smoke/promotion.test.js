const {getTestConfig} = require('../helpers/env');
const {MAX_GZIPPED_REQUEST_BYTES, runDryRun} = require('../helpers/dryRun');
const {expectFileToContain} = require('../helpers/assertions');

test('live Backstage dry-run proposes one immutable Component promotion', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/component/promotion.yaml',
    fixturePath: 'test/fixtures/inputs/basic/promotion.yaml',
    domainContractPath: 'test/fixtures/scenarios/bookinfo/domain.yaml',
    writeOutput: config.writeOutput,
  });
  expect(Object.keys(result.files)).toEqual([
    'system-pr/components/reviews/releases/test.yaml',
  ]);
  expectFileToContain(result,
    'system-pr/components/reviews/releases/test.yaml', 'tag: v1.7.3');
  expect(result.compressedRequestBytes).toBeLessThan(MAX_GZIPPED_REQUEST_BYTES);
}, 15000);
