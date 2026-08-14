import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, 'openapi.config.json'), 'utf8'));
const contractsDir = path.join(root, 'contracts');
const generatedDir = path.join(root, 'src', 'generated');
const clientsDir = path.join(generatedDir, 'clients');

await Promise.all([
  mkdir(contractsDir, {recursive: true}),
  mkdir(clientsDir, {recursive: true}),
]);

const openapiBin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'openapi.cmd' : 'openapi',
);

function registryContentUrl(api) {
  const base = config.schemaRegistryApiUrl.replace(/\/$/, '');
  const selector = api.version === 'latest' ? 'branch=latest' : api.version;
  return `${base}/groups/${encodeURIComponent(api.groupId)}`
    + `/artifacts/${encodeURIComponent(api.artifactId)}`
    + `/versions/${encodeURIComponent(selector)}/content`;
}

async function downloadContract(api, targetPath) {
  const headers = {};
  if (process.env.SCHEMA_REGISTRY_TOKEN) {
    headers.authorization = `Bearer ${process.env.SCHEMA_REGISTRY_TOKEN}`;
  }

  const response = await fetch(registryContentUrl(api), {headers});
  if (!response.ok) {
    throw new Error(
      `Failed to download ${api.groupId}/${api.artifactId}@${api.version}: `
      + `${response.status} ${response.statusText}`,
    );
  }

  await writeFile(targetPath, await response.text(), 'utf8');
}

function generateTypes(mode, contractPath, outputPath) {
  const output = execFileSync(
    openapiBin,
    ['typegen', `--${mode}`, contractPath],
    {cwd: root, encoding: 'utf8'},
  );
  return writeFile(outputPath, output, 'utf8');
}

function identifier(value) {
  const words = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const result = words.map((word, index) => {
    if (index === 0) return word.charAt(0).toLowerCase() + word.slice(1);
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join('');
  return result || 'api';
}

function typeName(value) {
  const id = identifier(value);
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function envName(alias) {
  return `OPENAPI_CLIENT_${alias.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_URL`;
}

if (config.provided) {
  const contractPath = path.join(contractsDir, 'provided-api.yaml');
  await downloadContract(config.provided, contractPath);
  await generateTypes(
    'backend',
    contractPath,
    path.join(generatedDir, 'provided-api.d.ts'),
  );
}

const clientExports = [
  "import {readFileSync} from 'node:fs';",
  "import {load as loadYaml} from 'js-yaml';",
  "import {OpenAPIClientAxios, type Document} from 'openapi-client-axios';",
  '',
];

for (const api of config.consumed) {
  const contractPath = path.join(contractsDir, `${api.alias}.yaml`);
  const typePath = path.join(clientsDir, `${api.alias}.d.ts`);
  await downloadContract(api, contractPath);
  await generateTypes('client', contractPath, typePath);

  const id = identifier(api.alias);
  const clientType = `${typeName(api.alias)}Client`;
  const factory = `create${typeName(api.alias)}Client`;
  const environment = envName(api.alias);

  clientExports.push(
    `import type {Client as ${clientType}} from './clients/${api.alias}.js';`,
    '',
    `export async function ${factory}(): Promise<${clientType}> {`,
    `  const baseUrl = process.env.${environment} ?? ${JSON.stringify(api.defaultBaseUrl)};`,
    '  const contractUrl = new URL(',
    `    '../../../contracts/${api.alias}.yaml',`,
    '    import.meta.url,',
    '  );',
    "  const definition = loadYaml(readFileSync(contractUrl, 'utf8'));",
    '  const api = new OpenAPIClientAxios({',
    '    definition: definition as Document,',
    '    withServer: {url: baseUrl},',
    '  });',
    `  return api.init<${clientType}>();`,
    '}',
    '',
  );
}

await writeFile(
  path.join(generatedDir, 'clients.ts'),
  `${clientExports.join('\n')}\n`,
  'utf8',
);

await writeFile(
  path.join(generatedDir, 'runtime-config.ts'),
  `export const openapiRuntime = ${JSON.stringify({provided: Boolean(config.provided)}, null, 2)} as const;\n`,
  'utf8',
);
