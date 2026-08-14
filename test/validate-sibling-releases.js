#!/usr/bin/env node
'use strict';

// Cross-repository release compatibility validation.

const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');

const root = path.resolve(__dirname, '..');
const requireFromTests = createRequire(path.join(root, 'test/package.json'));
const semver = requireFromTests('semver');
const YAML = requireFromTests('yaml');

const platformRoot = path.resolve(root, process.env.PLATFORM_COMPONENTS_DIR || '../platform-components');
const chartsRoot = path.resolve(root, process.env.DEVELOPER_CHARTS_DIR || '../developer-charts');
const templates = YAML.parse(fs.readFileSync(path.join(root, 'release.yaml'), 'utf8'));
const platform = YAML.parse(fs.readFileSync(path.join(platformRoot, 'release.yaml'), 'utf8'));
const charts = YAML.parse(fs.readFileSync(path.join(chartsRoot, 'release.yaml'), 'utf8'));

const checks = [
  ['platform-components for developer-charts',
    platform.version, charts.requires.platformComponents],
  ['platform-components for software-templates',
    platform.version, templates.requires.platformComponents],
  ['developer-charts for software-templates',
    charts.version, templates.requires.developerCharts],
];
for (const [name, version, range] of checks) {
  if (!semver.satisfies(version, range)) {
    throw new Error(`${name}: ${version} does not satisfy ${range}`);
  }
}
console.log(
  `Compatible release candidates: platform-components ${platform.version}, ` +
  `developer-charts ${charts.version}, software-templates ${templates.version}.`,
);
