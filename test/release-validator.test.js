'use strict';

const {validateRelease} = require('./validate-release');

const base = {
  version: '1.2.3',
  requires: {platformComponents: '>=1.0.0 <2.0.0'},
};

describe('release validator', () => {
  test('accepts a first release with a matching tag', () => {
    expect(() => validateRelease({
      release: {version: '1.0.0'}, tag: 'v1.0.0',
    })).not.toThrow();
  });

  test('rejects a release tag/version mismatch', () => {
    expect(() => validateRelease({
      release: {version: '1.0.0'}, tag: 'v1.0.1',
    })).toThrow(/does not match release.yaml/);
  });

  test('rejects a non-monotonic proposed version', () => {
    expect(() => validateRelease({
      release: {version: '1.2.3'}, tag: 'v1.2.3',
      previousRelease: base, previousTag: 'v1.2.3',
    })).toThrow(/must be greater/);
  });

  test('accepts a patch with exactly unchanged requirements', () => {
    expect(() => validateRelease({
      release: {
        version: '1.2.4',
        requires: {platformComponents: '>=1.0.0 <2.0.0'},
      },
      tag: 'v1.2.4', previousRelease: base, previousTag: 'v1.2.3',
    })).not.toThrow();
  });

  test('rejects a patch that changes dependency requirements', () => {
    expect(() => validateRelease({
      release: {
        version: '1.2.4',
        requires: {platformComponents: '>=1.1.0 <2.0.0'},
      },
      tag: 'v1.2.4', previousRelease: base, previousTag: 'v1.2.3',
    })).toThrow(/must not change dependency compatibility requirements/);
  });

  test.each([
    {
      release: {
        version: '1.3.0',
        requires: {platformComponents: '>=1.1.0 <2.0.0'},
      },
      tag: 'v1.3.0',
    },
    {
      release: {
        version: '2.0.0',
        requires: {platformComponents: '>=2.0.0 <3.0.0'},
      },
      tag: 'v2.0.0',
    },
  ])('allows minor and major releases to change ranges: $tag', proposed => {
    expect(() => validateRelease({
      ...proposed, previousRelease: base, previousTag: 'v1.2.3',
    })).not.toThrow();
  });

  test('rejects invalid SemVer dependency ranges', () => {
    expect(() => validateRelease({
      release: {
        version: '1.3.0', requires: {platformComponents: 'not-a-range'},
      },
      tag: 'v1.3.0', previousRelease: base, previousTag: 'v1.2.3',
    })).toThrow(/not a valid SemVer range/);
  });
});
