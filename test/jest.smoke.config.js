const path = require('node:path');

const testRoot = __dirname;
const repositoryRoot = path.resolve(testRoot, '..');

module.exports = {
  rootDir: repositoryRoot,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/smoke/**/*.test.js'],
  testPathIgnorePatterns: ['<rootDir>/test/node_modules/', '<rootDir>/test/fixtures/'],
};
