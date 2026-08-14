const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const semver = require('semver');
const {repositoryRoot: root} = require('../helpers/paths');

const release = YAML.parse(fs.readFileSync(path.join(root, 'release.yaml'), 'utf8'));

describe('software-templates release policy', () => {
  test('declares independent platform and chart compatibility ranges', () => {
    expect(semver.valid(release.version)).toBe(release.version);
    expect(Object.keys(release.requires).sort())
      .toEqual(['developerCharts', 'platformComponents']);
    for (const range of Object.values(release.requires)) {
      expect(semver.validRange(range)).not.toBeNull();
    }
  });

});
