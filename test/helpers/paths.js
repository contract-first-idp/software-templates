const path = require('node:path');

const testRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(testRoot, '..');

module.exports = {testRoot, repositoryRoot};
