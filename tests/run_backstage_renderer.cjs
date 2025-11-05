#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const SKIP_CODE = 64;

function skip(message) {
  if (message) {
    console.error(message);
  }
  process.exit(SKIP_CODE);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function findRenderFunction(exportsObject, seen = new Set()) {
  if (!exportsObject) {
    return undefined;
  }
  if (typeof exportsObject === 'function') {
    const source = exportsObject.toString();
    if (source.includes('copyWithoutRender') || source.includes('nunjucks')) {
      return exportsObject;
    }
  }
  if (typeof exportsObject !== 'object' || seen.has(exportsObject)) {
    return undefined;
  }
  seen.add(exportsObject);
  for (const value of Object.values(exportsObject)) {
    const candidate = findRenderFunction(value, seen);
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
}

function tryRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return undefined;
    }
    throw error;
  }
}

function loadRenderTemplate() {
  let basePath;
  try {
    basePath = path.dirname(require.resolve('@backstage/plugin-scaffolder-backend/package.json'));
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      skip('The @backstage/plugin-scaffolder-backend package is not installed');
    }
    throw error;
  }

  const attempts = [
    path.join(basePath, 'dist', 'scaffolder', 'actions', 'builtin', 'legacy', 'templating.cjs.js'),
    path.join(basePath, 'dist', 'scaffolder', 'actions', 'builtin', 'legacy', 'templating.js'),
    path.join(basePath, 'dist', 'scaffolder', 'actions', 'legacy', 'templating.cjs.js'),
    path.join(basePath, 'dist', 'scaffolder', 'actions', 'legacy', 'templating.js'),
    path.join(basePath, 'dist', 'legacy', 'templating.cjs.js'),
    path.join(basePath, 'dist', 'legacy', 'templating.js'),
    '@backstage/plugin-scaffolder-backend',
  ];

  for (const candidatePath of attempts) {
    const moduleExports = tryRequire(candidatePath);
    if (!moduleExports) {
      continue;
    }
    const render = findRenderFunction(moduleExports);
    if (render) {
      return render;
    }
  }

  skip('Unable to locate Backstage\'s renderTemplate implementation');
}

async function main() {
  if (process.argv.length < 4) {
    console.error('Usage: node run_backstage_renderer.cjs <templateDir> <valuesJson>');
    process.exit(1);
  }

  const templateDir = path.resolve(process.argv[2]);
  const valuesPath = path.resolve(process.argv[3]);

  let values;
  try {
    values = readJson(valuesPath);
  } catch (error) {
    console.error(`Failed to read render context: ${error}`);
    process.exit(1);
  }

  const renderTemplate = loadRenderTemplate();

  const tmpDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'backstage-render-'));

  const noop = () => {};
  const logger = {
    child: () => logger,
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
  };

  const options = {
    templateDir,
    templatePath: templateDir,
    workspacePath: templateDir,
    baseDir: templateDir,
    values,
    outputDir: tmpDir,
    outputPath: tmpDir,
    logger,
    logStream: logger,
    copyWithoutRender: [],
    concurrency: 16,
  };

  let result;
  try {
    result = renderTemplate(options);
    if (result && typeof result.then === 'function') {
      await result;
    }
  } catch (error) {
    console.error(error.stack || error.message || error);
    process.exit(1);
  }

  const unresolved = [];
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        const content = fs.readFileSync(entryPath, 'utf8');
        if (content.includes('${{')) {
          unresolved.push(entryPath);
        }
      }
    }
  };
  visit(tmpDir);

  if (unresolved.length > 0) {
    console.error('Unresolved template markers after rendering:\n' + unresolved.join('\n'));
    process.exit(1);
  }
}

main();
