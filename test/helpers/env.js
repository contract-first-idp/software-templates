const path = require('node:path');
const dotenv = require('dotenv');
const {testRoot} = require('./paths');

dotenv.config({path: path.join(testRoot, '.env')});

function getEnv(name, { required = false } = {}) {
  const value = process.env[name];
  if (required && !value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getTestConfig() {
  return {
    baseUrl: getEnv('BACKSTAGE_URL', { required: true }),
    token: getEnv('BACKSTAGE_TOKEN'),
    writeOutput: ['true', '1'].includes(getEnv('DRY_RUN_WRITE_OUTPUT')),
  };
}

module.exports = {getEnv, getTestConfig};
