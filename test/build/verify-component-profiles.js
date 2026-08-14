const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {profileValues} = require('../helpers/componentProfileFixtures');
const {renderComponentProfile} = require('../helpers/profileRenderer');
const {repositoryRoot: root} = require('../helpers/paths');

const profiles = [
  'spring-boot-openapi',
  'spring-boot-camel-openapi',
  'quarkus-camel-openapi',
  'quarkus-camel-openapi-yaml',
  'nodejs-openapi',
];

function run(directory, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: directory,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', code => code === 0
      ? resolve()
      : reject(new Error(`${command} ${args.join(' ')} exited ${code} in ${directory}`)));
  });
}

async function verify(directory, profile) {
  if (profile === 'nodejs-openapi') {
    await run(directory, 'npm', ['ci', '--ignore-scripts']);
    await run(directory, 'npm', ['test']);
    await run(directory, 'npm', ['run', 'build']);
    return;
  }
  await run(directory, './mvnw', ['-ntp', '-q', 'verify']);
}

async function main() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'component-build-'));
  try {
    for (const profile of profiles) {
      const directory = path.join(temporaryRoot, profile);
      await renderComponentProfile({
        root,
        profile,
        destination: directory,
        values: profileValues({
          implementationProfile: profile,
          provided_api: null,
          consumed_apis: [],
        }),
      });
      await verify(directory, profile);
      console.log(`Build baseline passed: ${profile}`);
    }
  } finally {
    await fs.rm(temporaryRoot, {recursive: true, force: true});
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
