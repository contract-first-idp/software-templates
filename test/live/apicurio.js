const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {profileValues} = require('../helpers/componentProfileFixtures');
const {renderComponentProfile} = require('../helpers/profileRenderer');
const {repositoryRoot: root} = require('../helpers/paths');

if (process.env.APICURIO_LIVE !== '1') {
  console.error('Refusing live Registry mutation without APICURIO_LIVE=1');
  process.exit(2);
}

const apiUrl = (
  process.env.APICURIO_API_URL ||
  'https://registry.example.com/apis/registry/v3'
).replace(/\/$/, '');
const suffix = `${Date.now()}-${process.pid}`;
const groupId = `io.github.cfidp.live.${Date.now()}.${process.pid}`;
const artifactId = 'reviews-live-verification';
const version = `codex-${suffix}`;

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, stdio: 'inherit'});
    child.on('error', reject);
    child.on('close', code => code === 0
      ? resolve(code)
      : reject(new Error(`${command} exited ${code}`)));
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${url}: HTTP ${response.status} ${await response.text()}`);
  }
  return response;
}

async function main() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-idp-apicurio-live-'));
  const contract = await fs.readFile(
    path.join(root, 'test/fixtures/scenarios/bookinfo/contracts/reviews.yaml'),
    'utf8',
  );
  let published = false;

  try {
    await request(
      `${apiUrl}/groups/${encodeURIComponent(groupId)}/artifacts?ifExists=CREATE_VERSION`,
      {
        method: 'POST',
        headers: {'content-type': 'application/json', accept: 'application/json'},
        body: JSON.stringify({
          artifactId,
          artifactType: 'OPENAPI',
          name: artifactId,
          firstVersion: {
            version,
            name: 'live-verification',
            content: {content: contract, contentType: 'application/yaml'},
          },
        }),
      },
    );
    published = true;

    const directory = path.join(temporaryRoot, 'spring-boot-openapi');
    await renderComponentProfile({
      root,
      profile: 'spring-boot-openapi',
      destination: directory,
      values: profileValues({
        implementationProfile: 'spring-boot-openapi',
        provided_api: {
          ref: 'api:codex/reviews-live-verification',
          name: artifactId,
          registry_group_id: groupId,
          registry_artifact_id: artifactId,
          contract_file: 'reviews-live-verification-api.yaml',
          version,
        },
      }),
    });
    await run('./mvnw', [
      '-ntp',
      'clean',
      'verify',
      `-Dschema.registry.api.url=${apiUrl}`,
    ], directory);
    await fs.access(path.join(
      directory,
      'target/generated-resources/openapi/reviews-live-verification-api.yaml',
    ));
    console.log(`Live Registry build passed for ${groupId}/${artifactId}@${version}`);
  } finally {
    if (published) {
      const deletion = await fetch(
        `${apiUrl}/groups/${encodeURIComponent(groupId)}`,
        {method: 'DELETE'},
      );
      if (deletion.ok) {
        console.log(`Deleted disposable Registry group ${groupId}`);
      } else if (deletion.status === 405) {
        console.warn(
          `Registry group deletion is disabled; disposable group remains: ${groupId}`,
        );
      } else {
        throw new Error(
          `DELETE disposable group: HTTP ${deletion.status} ${await deletion.text()}`,
        );
      }
    }
    await fs.rm(temporaryRoot, {recursive: true, force: true});
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
