const path = require('path');
const { readFile, writeFile, rm, stat } = require('fs/promises');
const { ensureDir } = require('fs-extra');
const readdir = require('recursive-readdir');
const { gzipSync } = require('zlib');
const YAML = require('yaml');

const { loadFixtureYaml } = require('./fixtures');
const {repositoryRoot, testRoot} = require('./paths');

const EXPRESSION_PATTERN = /\$\{\{[\s\S]*?\}\}/g;
const MAX_GZIPPED_REQUEST_BYTES = 90 * 1024;

function resolveRepositoryPath(requestedPath, repoRoot = repositoryRoot) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  return path.isAbsolute(requestedPath)
    ? path.normalize(requestedPath)
    : path.resolve(resolvedRepoRoot, requestedPath);
}

function resolveTemplatePath(templatePath, repoRoot = repositoryRoot) {
  return resolveRepositoryPath(templatePath, repoRoot);
}

function resolveFixturePath(fixturePath, repoRoot = repositoryRoot) {
  return resolveRepositoryPath(fixturePath, repoRoot);
}

function pathResolutionError({kind, repoRoot, requestedPath, resolvedPath}) {
  return new Error([
    `${kind} path could not be resolved`,
    '',
    'Repository root:',
    `  ${repoRoot}`,
    '',
    `Requested ${kind.toLowerCase()} path:`,
    `  ${requestedPath}`,
    '',
    `Resolved ${kind.toLowerCase()} path:`,
    `  ${resolvedPath}`,
  ].join('\n'));
}

async function statResolvedPath({kind, repoRoot, requestedPath, resolvedPath}) {
  try {
    return await stat(resolvedPath);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw pathResolutionError({kind, repoRoot, requestedPath, resolvedPath});
    }
    throw error;
  }
}

async function loadDependencyContents(rootPath, dependencyPaths, contentOverrides = {}) {
  const files = new Set();

  for (const dependencyPath of dependencyPaths) {
    const absolutePath = path.resolve(rootPath, dependencyPath);
    const relativePath = path.relative(rootPath, absolutePath);
    if (!relativePath || relativePath.startsWith('..')) {
      throw new Error(`Template dependency escapes repository root: ${dependencyPath}`);
    }

    const dependencyStat = await stat(absolutePath);
    if (dependencyStat.isDirectory()) {
      for (const file of await readdir(absolutePath, ['.git', 'node_modules', 'output'])) {
        files.add(file);
      }
    } else {
      files.add(absolutePath);
    }
  }

  return Promise.all([...files].sort().map(async filePath => {
    const relativePath = path.relative(rootPath, filePath).split(path.sep).join('/');
    const content = Object.hasOwn(contentOverrides, relativePath)
      ? Buffer.from(contentOverrides[relativePath])
      : await readFile(filePath);
    return {path: relativePath, base64Content: content.toString('base64')};
  }));
}

function normalizeBackstageTemplateYaml(raw) {
  const expressions = [];
  const protectedYaml = raw.replace(EXPRESSION_PATTERN, expression => {
    const placeholder = `BACKSTAGEEXPRESSION${expressions.length}PLACEHOLDER`;
    expressions.push(expression);
    return placeholder;
  });
  const parsed = YAML.parse(protectedYaml);

  const restore = value => {
    if (Array.isArray(value)) {
      return value.map(restore);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, restore(child)]),
      );
    }
    if (typeof value === 'string') {
      return expressions.reduce(
        (restored, expression, index) =>
          restored.replaceAll(`BACKSTAGEEXPRESSION${index}PLACEHOLDER`, expression),
        value,
      );
    }
    return value;
  };

  return restore(parsed);
}

async function loadTemplateObject(templatePath) {
  const templateStat = await stat(templatePath);
  const templateFile = templateStat.isDirectory()
    ? path.join(templatePath, 'template.yaml')
    : templatePath;
  const raw = await readFile(templateFile, 'utf8');
  return normalizeBackstageTemplateYaml(raw);
}

function rewriteRelativeUrls(value, { templateDirFromRepoRoot }) {
  if (Array.isArray(value)) {
    return value.map(item =>
      rewriteRelativeUrls(item, { templateDirFromRepoRoot }),
    );
  }

  if (value && typeof value === 'object') {
    const out = {};

    for (const [key, child] of Object.entries(value)) {
      if (
        key === 'url' &&
        typeof child === 'string' &&
        (child.startsWith('./') || child.startsWith('../'))
      ) {
        const resolved = path
          .normalize(path.join(templateDirFromRepoRoot, child))
          .split(path.sep)
          .join('/');

        if (resolved.startsWith('..')) {
          throw new Error(
            `Template url escapes repository root: ${child} from ${templateDirFromRepoRoot}`,
          );
        }

        out[key] = resolved;
      } else {
        out[key] = rewriteRelativeUrls(child, { templateDirFromRepoRoot });
      }
    }

    return out;
  }

  return value;
}

function collectTemplateDependencies(template, values = {}) {
  const dependencies = new Set();

  const visit = value => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        key === 'url' &&
        typeof child === 'string' &&
        !/^[a-z][a-z0-9+.-]*:/i.test(child)
      ) {
        const parameterMatch = child.match(/^\$\{\{\s*parameters\.([A-Za-z0-9_]+)\s*\}\}$/);
        if (parameterMatch && values[parameterMatch[1]]) {
          dependencies.add(String(values[parameterMatch[1]]));
        } else {
          const resolved = child.replace(
            /\$\{\{\s*parameters\.([A-Za-z0-9_]+)\s*\}\}/g,
            (_, name) => values[name] ?? `UNRESOLVED-${name}`,
          );
          if (!resolved.includes('${{') && !resolved.includes('UNRESOLVED-')) {
            dependencies.add(resolved);
          }
        }
      }
      visit(child);
    }
  };

  visit(template);
  return [...dependencies];
}

function rewriteCompatibleActions(template) {
  if (template?.metadata?.annotations?.['backstage-gitea.io/github-compatible'] !== 'true') {
    return template;
  }
  const actionMap = {
    'publish:github': 'publish:gitea',
    'publish:github:pull-request': 'publish:gitea:pull-request',
    'github:webhook': 'gitea:webhook',
  };
  return {
    ...template,
    spec: {
      ...template.spec,
      steps: (template.spec.steps || []).map(step => ({
        ...step,
        action: actionMap[step.action] || step.action,
      })),
    },
  };
}

function applyRegistryFixtureOverrides(template, fixtureContents) {
  if (!fixtureContents || Object.keys(fixtureContents).length === 0) return template;
  return {
    ...template,
    spec: {
      ...template.spec,
      steps: (template.spec.steps || []).map(step => step.id === 'fetchConsumedContracts'
        ? {
          ...step,
          action: 'roadiehq:utils:fs:write',
          input: {
            path: 'consumed-contracts/${{ each.key }}-${{ each.value.contract_file }}',
            content: '${{ parameters.__registryFixtures[each.key] }}',
            preserveFormatting: true,
          },
        }
        : step),
    },
  };
}

async function applyLocalDomainContract(
  template,
  repoRoot,
  values = {},
  domainContractPath = '../cf-idp-domain/catalog-info.yaml',
) {
  const domainPath = path.resolve(repoRoot, domainContractPath);
  let domain;
  try {
    domain = YAML.parse(await readFile(domainPath, 'utf8'));
  } catch {
    return template;
  }

  const buildEnvironment = domain.spec.environments.build;
  const replacements = new Map([
    [
      'steps.fetchDomain.output.entity.spec.groupId',
      JSON.stringify(domain.spec.groupId),
    ],
    [
      "steps.fetchDomain.output.entity.spec.environments.definitions[steps.fetchDomain.output.entity.spec.environments.build].namespaceSuffix",
      JSON.stringify(domain.spec.environments.definitions[buildEnvironment].namespaceSuffix),
    ],
    [
      "steps.fetchDomain.output.entity.metadata.annotations['contract-first-idp.github.io/scm-host']",
      JSON.stringify(domain.metadata.annotations['contract-first-idp.github.io/scm-host']),
    ],
    [
      "steps.fetchDomain.output.entity.metadata.annotations['contract-first-idp.github.io/domain-org']",
      JSON.stringify(domain.metadata.annotations['contract-first-idp.github.io/domain-org']),
    ],
    [
      "steps.fetchDomain.output.entity.metadata.annotations['contract-first-idp.github.io/domain-repo']",
      JSON.stringify(domain.metadata.annotations['contract-first-idp.github.io/domain-repo']),
    ],
    [
      'steps.fetchDomain.output.entity.spec.environments.build',
      JSON.stringify(buildEnvironment),
    ],
    [
      'steps.fetchDomain.output.entity.spec.environments.order',
      JSON.stringify(domain.spec.environments.order),
    ],
  ]);

  const replace = value => {
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, replace(child)]),
      );
    }
    if (typeof value !== 'string') return value;
    if (
      value.trim() ===
      '${{ steps.fetchDomain.output.entity.spec.environments.order }}'
    ) {
      return [...domain.spec.environments.order];
    }
    let result = value;
    for (const [source, target] of replacements) {
      result = result.replaceAll(source, target);
    }
    return result;
  };
  return replace(template);
}

async function writeOutputToDisk(outputDir, directoryContents) {
  await rm(outputDir, { recursive: true, force: true });
  await ensureDir(outputDir);

  for (const file of directoryContents) {
    const fullPath = path.join(outputDir, file.path);
    await ensureDir(path.dirname(fullPath));
    await writeFile(fullPath, Buffer.from(file.base64Content, 'base64'), {
      mode: file.executable ? 0o755 : 0o644,
    });
  }
}

async function callDryRunApi({ baseUrl, token, body }) {
  const gzipped = gzipSync(JSON.stringify(body));
  if (gzipped.length >= MAX_GZIPPED_REQUEST_BYTES) {
    throw new Error(
      `Dry-run request is ${gzipped.length} bytes compressed; limit is ${MAX_GZIPPED_REQUEST_BYTES}`,
    );
  }

  const headers = {
    'Content-Type': 'application/json',
    'Content-Encoding': 'gzip',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    new URL('/api/scaffolder/v2/dry-run', baseUrl),
    {
      method: 'POST',
      headers,
      body: gzipped,
    },
  );

  if (!response.ok) {
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      throw new Error(JSON.stringify(data, null, 2));
    }

    throw new Error(await response.text());
  }

  return {
    response: await response.json(),
    compressedRequestBytes: gzipped.length,
  };
}

function defaultOutputDir({resolvedRepoRoot, resolvedTemplatePath, resolvedFixturePath}) {
  const templatePathFromRepoRoot = path.relative(resolvedRepoRoot, resolvedTemplatePath);
  const parsedTemplatePath = path.parse(templatePathFromRepoRoot);
  const outputTemplatePath = path.join(parsedTemplatePath.dir, parsedTemplatePath.name);
  const fixtureName = path.basename(
    resolvedFixturePath,
    path.extname(resolvedFixturePath),
  );

  return path.join(testRoot, 'output', outputTemplatePath, fixtureName);
}

function resolveOutputDir(outputDir) {
  return path.isAbsolute(outputDir)
    ? path.normalize(outputDir)
    : path.resolve(testRoot, outputDir);
}

async function runDryRun({
  baseUrl,
  token,
  templatePath,
  fixturePath,
  outputDir,
  writeOutput = false,
  repoRoot = repositoryRoot,
  domainContractPath,
  dependencyContentOverrides,
  registryContentFixtures,
}) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedTemplatePath = resolveTemplatePath(templatePath, resolvedRepoRoot);
  const resolvedFixturePath = resolveFixturePath(fixturePath, resolvedRepoRoot);
  const templateStat = await statResolvedPath({
    kind: 'Template',
    repoRoot: resolvedRepoRoot,
    requestedPath: templatePath,
    resolvedPath: resolvedTemplatePath,
  });
  await statResolvedPath({
    kind: 'Fixture',
    repoRoot: resolvedRepoRoot,
    requestedPath: fixturePath,
    resolvedPath: resolvedFixturePath,
  });
  const resolvedTemplateDirectory = templateStat.isDirectory()
    ? resolvedTemplatePath
    : path.dirname(resolvedTemplatePath);
  if (templateStat.isDirectory()) {
    await statResolvedPath({
      kind: 'Template',
      repoRoot: resolvedRepoRoot,
      requestedPath: templatePath,
      resolvedPath: path.join(resolvedTemplatePath, 'template.yaml'),
    });
  }

  const templateDirFromRepoRoot = path
    .relative(resolvedRepoRoot, resolvedTemplateDirectory)
    .split(path.sep)
    .join('/');

  if (!templateDirFromRepoRoot || templateDirFromRepoRoot.startsWith('..')) {
    throw new Error(
      `templatePath must be inside repoRoot. templatePath=${resolvedTemplatePath} repoRoot=${resolvedRepoRoot}`,
    );
  }

  const values = await loadFixtureYaml(resolvedFixturePath);
  const secrets = {};

  if (registryContentFixtures) {
    if (Array.isArray(registryContentFixtures)) {
      values.__registryFixtures = await Promise.all(registryContentFixtures.map(
        relativePath => readFile(path.resolve(resolvedRepoRoot, relativePath), 'utf8'),
      ));
    } else {
      values.__registryFixtures = Object.fromEntries(await Promise.all(
        Object.entries(registryContentFixtures).map(async ([key, relativePath]) => [
          key,
          await readFile(path.resolve(resolvedRepoRoot, relativePath), 'utf8'),
        ]),
      ));
    }
  }

  const parsedTemplate = await loadTemplateObject(resolvedTemplatePath);
  const template = applyRegistryFixtureOverrides(await applyLocalDomainContract(rewriteCompatibleActions(
    rewriteRelativeUrls(parsedTemplate, {
      templateDirFromRepoRoot,
    }),
  ), resolvedRepoRoot, values, domainContractPath), values.__registryFixtures);
  const directoryContents = await loadDependencyContents(
    resolvedRepoRoot,
    collectTemplateDependencies(template, values),
    dependencyContentOverrides,
  );

  const {response: result, compressedRequestBytes} = await callDryRunApi({
    baseUrl,
    token,
    body: {
      directoryContents,
      values,
      secrets,
      template,
    },
  });

  const finalOutputDir = writeOutput
    ? outputDir
      ? resolveOutputDir(outputDir)
      : defaultOutputDir({
        resolvedRepoRoot,
        resolvedTemplatePath,
        resolvedFixturePath,
      })
    : null;

  if (finalOutputDir) {
    await writeOutputToDisk(finalOutputDir, result.directoryContents);
  }

  const files = Object.fromEntries(
    result.directoryContents.map(file => [
      file.path,
      Buffer.from(file.base64Content, 'base64').toString('utf8'),
    ]),
  );

  return {
    log: result.log,
    files,
    rawDirectoryContents: result.directoryContents,
    compressedRequestBytes,
    outputDir: finalOutputDir,
  };
}

module.exports = {
  MAX_GZIPPED_REQUEST_BYTES,
  collectTemplateDependencies,
  normalizeBackstageTemplateYaml,
  rewriteCompatibleActions,
  applyRegistryFixtureOverrides,
  applyLocalDomainContract,
  defaultOutputDir,
  resolveFixturePath,
  resolveOutputDir,
  resolveTemplatePath,
  runDryRun,
};
