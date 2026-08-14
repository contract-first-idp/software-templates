const {execFile} = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {promisify} = require('node:util');
const YAML = require('yaml');
const {consumedApis, profileValues} = require('../helpers/componentProfileFixtures');
const {renderComponentProfile} = require('../helpers/profileRenderer');
const {repositoryRoot: root} = require('../helpers/paths');

const run = promisify(execFile);

const contract = YAML.stringify({
  openapi: '3.0.3',
  info: {title: 'Consumed API', version: '1.0.0'},
  paths: {
    '/details/{id}': {
      get: {
        operationId: 'getProduct',
        parameters: [{name: 'id', in: 'path', required: true, schema: {type: 'string'}}],
        responses: {'200': {description: 'Product details'}},
      },
    },
  },
});

jest.setTimeout(120_000);

test('Node scaffold builds a typed client for a consumed API', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'node-consumed-api-'));
  const registry = http.createServer((_request, response) => {
    response.writeHead(200, {'content-type': 'application/yaml'});
    response.end(contract);
  });

  try {
    await new Promise(resolve => registry.listen(0, '127.0.0.1', resolve));
    const {port} = registry.address();
    await renderComponentProfile({
      root,
      profile: 'nodejs-openapi',
      destination,
      values: profileValues({
        implementationProfile: 'nodejs-openapi',
        schema_registry_api_url: `http://127.0.0.1:${port}`,
        consumed_apis: [consumedApis.bookinfoDetails],
      }),
    });

    await run('npm', ['ci', '--ignore-scripts', '--loglevel=error'], {cwd: destination});
    await run('npm', ['run', 'build', '--silent'], {cwd: destination});
  } finally {
    await new Promise(resolve => registry.close(resolve));
    await fs.rm(destination, {recursive: true, force: true});
  }
});
