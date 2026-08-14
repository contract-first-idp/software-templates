const fs = require('node:fs/promises');
const path = require('node:path');
const nunjucks = require('nunjucks');

const environment = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: true,
  tags: {
    variableStart: '${{',
    variableEnd: '}}',
  },
});

function isText(buffer) {
  return !buffer.subarray(0, 8192).includes(0);
}

function validateRenderedWhitespace(relative, rendered) {
  if (/[ \t]+$/m.test(rendered)) {
    throw new Error(`${relative} renders trailing or whitespace-only line content`);
  }
  if (/\n{3,}/.test(rendered)) {
    throw new Error(`${relative} renders more than one consecutive blank line`);
  }
}

async function filesBelow(directory) {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

async function renderDirectory({source, destination, values}) {
  await fs.rm(destination, {recursive: true, force: true});

  for (const sourceFile of await filesBelow(source)) {
    const relative = path.relative(source, sourceFile);
    const renderedRelative = environment.renderString(relative, {values});
    const destinationFile = path.join(destination, renderedRelative);
    const [content, metadata] = await Promise.all([
      fs.readFile(sourceFile),
      fs.stat(sourceFile),
    ]);
    await fs.mkdir(path.dirname(destinationFile), {recursive: true});
    const rendered = isText(content)
      ? environment.renderString(content.toString('utf8'), {values})
      : content;
    if (typeof rendered === 'string') validateRenderedWhitespace(relative, rendered);
    await fs.writeFile(destinationFile, rendered, {mode: metadata.mode});
  }

  return destination;
}

function renderComponentProfile({root, profile, destination, values}) {
  return renderDirectory({
    source: path.join(root, 'skeletons/component/implementations', profile),
    destination,
    values,
  });
}

module.exports = {renderComponentProfile, renderDirectory};
