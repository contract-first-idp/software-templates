#!/usr/bin/env node
'use strict';

// Repository release-policy validation.

const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const requireFromTests = createRequire(path.join(root, 'test/package.json'));
const semver = requireFromTests('semver');
const YAML = requireFromTests('yaml');

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

function validateRelease({release, tag, previousRelease, previousTag}) {
  invariant(release && typeof release === 'object', 'release.yaml must contain a mapping');
  invariant(semver.valid(release.version) === release.version,
    `release.yaml version is not valid SemVer: ${release.version}`);
  invariant(tag === `v${release.version}`,
    `release tag ${tag} does not match release.yaml version ${release.version}`);

  const requirements = release.requires || {};
  invariant(requirements && typeof requirements === 'object' && !Array.isArray(requirements),
    'release.yaml requires must be a mapping');
  for (const [name, range] of Object.entries(requirements)) {
    invariant(typeof range === 'string' && semver.validRange(range) !== null,
      `release.yaml requires.${name} is not a valid SemVer range: ${range}`);
  }

  if (!previousRelease) return;
  const previousVersion = previousTag?.slice(1);
  invariant(semver.valid(previousVersion) === previousVersion,
    `previous release tag is not valid SemVer: ${previousTag}`);
  invariant(previousRelease.version === previousVersion,
    `${previousTag} release.yaml declares version ${previousRelease.version}`);
  invariant(semver.gt(release.version, previousVersion),
    `proposed version ${release.version} must be greater than previous release ${previousVersion}`);

  const current = semver.parse(release.version);
  const previous = semver.parse(previousVersion);
  if (current.major === previous.major && current.minor === previous.minor) {
    invariant(
      JSON.stringify(canonical(requirements)) ===
        JSON.stringify(canonical(previousRelease.requires || {})),
      `patch release ${release.version} must not change dependency compatibility requirements`,
    );
  }
}

function validateChartMetadata(release, charts) {
  invariant(charts.length > 0, 'no owned Chart.yaml files were found');
  for (const {relative, metadata} of charts) {
    invariant(metadata.version === release.version,
      `${relative} version ${metadata.version} does not match release.yaml ${release.version}`);
    if (metadata.appVersion !== undefined) {
      invariant(metadata.appVersion === release.version,
        `${relative} appVersion ${metadata.appVersion} does not match release.yaml ${release.version}`);
    }
  }
}

function chartMetadata() {
  const chartsRoot = path.join(root, 'charts');
  if (!fs.existsSync(chartsRoot)) return [];
  const results = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.name === 'Chart.yaml') {
        results.push({
          relative: path.relative(root, absolute),
          metadata: YAML.parse(fs.readFileSync(absolute, 'utf8')),
        });
      }
    }
  };
  walk(chartsRoot);
  return results;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main() {
  const release = YAML.parse(fs.readFileSync(path.join(root, 'release.yaml'), 'utf8'));
  const tag = option('--tag') ||
    (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined) ||
    `v${release.version}`;
  const tags = execFileSync('git', ['tag', '--list', 'v*', '--merged', 'HEAD'], {
    cwd: root, encoding: 'utf8',
  }).trim().split('\n').filter(Boolean)
    .filter(candidate => semver.valid(candidate.slice(1)) !== null && candidate !== tag)
    .sort((left, right) => semver.rcompare(left.slice(1), right.slice(1)));
  const previousTag = tags[0];
  const previousRelease = previousTag
    ? YAML.parse(execFileSync('git', ['show', `${previousTag}:release.yaml`], {
      cwd: root, encoding: 'utf8',
    }))
    : undefined;

  validateRelease({release, tag, previousRelease, previousTag});
  if (path.basename(root) === 'developer-charts') {
    validateChartMetadata(release, chartMetadata());
  }
  console.log(`${path.basename(root)} release ${tag} is valid${previousTag
    ? ` after ${previousTag}` : ' as the first release'}.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`release validation failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {validateChartMetadata, validateRelease};
