const {spawnSync} = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');
const {testRoot} = require('../helpers/paths');

dotenv.config({path: path.join(testRoot, '.env')});

const required = [
  'BACKSTAGE_URL',
  'TEST_DOMAIN_REF',
  'TEST_SYSTEM_REF',
  'TEST_COMPONENT_REF',
];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error([
    'Cannot run the Backstage dry-run smoke suite.',
    `Missing environment variables: ${missing.join(', ')}`,
    'This command targets a live Backstage installation; configure test/.env first.',
  ].join('\n'));
  process.exit(2);
}

const jest = require.resolve('jest/bin/jest');
const config = path.join(testRoot, 'jest.smoke.config.js');
const discovered = spawnSync(process.execPath, [
  jest, '--config', config, '--listTests', '--runInBand',
], {encoding: 'utf8'});
if (discovered.status !== 0) {
  process.stderr.write(discovered.stderr || discovered.stdout || 'Jest test discovery failed.\n');
  process.exit(discovered.status ?? 1);
}
const tests = discovered.stdout.split(/\r?\n/).filter(Boolean);
if (tests.length === 0) {
  console.error('The Backstage smoke configuration discovered zero tests.');
  process.exit(3);
}
console.log(`Running ${tests.length} Backstage smoke test files.`);
const result = spawnSync(process.execPath, [
  jest, '--config', config, '--runInBand',
], {stdio: 'inherit'});
process.exit(result.status ?? 1);
