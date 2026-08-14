const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const {repositoryRoot: root} = require('../helpers/paths');

const platformRoot = path.resolve(
  root, process.env.PLATFORM_COMPONENTS_DIR || '../platform-components');
const target = YAML.parse(fs.readFileSync(
  path.join(platformRoot, 'catalog-info.yaml'), 'utf8'));
const dependency = target.spec.platform.dependencies.developerCharts;
const charts = target.spec.platform.charts;
const requiredCharts = [
  'charts/api/openapi/Chart.yaml',
  'charts/component/container/Chart.yaml',
  'charts/domain/environment/Chart.yaml',
  'charts/resource/postgresql/Chart.yaml',
  'charts/system/environment/Chart.yaml',
];

if (dependency.repositoryUrl !== charts.repositoryUrl ||
    dependency.revision !== charts.revision) {
  throw new Error('The developerCharts dependency and charts coordinates must be identical');
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-charts-'));
try {
  const checkout = path.join(temporary, 'developer-charts');
  fs.mkdirSync(checkout);
  const runGit = args => {
    const result = spawnSync('git', args, {encoding: 'utf8'});
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || 'Unable to fetch developer charts');
    }
  };
  const exactTag = `refs/tags/${dependency.revision}`;
  runGit(['ls-remote', '--exit-code', '--refs', dependency.repositoryUrl, exactTag]);
  runGit(['-C', checkout, 'init', '--quiet']);
  runGit(['-C', checkout, 'remote', 'add', 'origin', dependency.repositoryUrl]);
  runGit(['-C', checkout, 'fetch', '--depth', '1', 'origin', exactTag]);
  runGit(['-C', checkout, 'checkout', '--detach', '--quiet', 'FETCH_HEAD']);
  const missing = requiredCharts.filter(relative =>
    !fs.existsSync(path.join(checkout, relative)));
  if (missing.length) {
    throw new Error([
      `${dependency.repositoryUrl}@${dependency.revision} is missing canonical chart paths:`,
      ...missing.map(relative => `- ${relative}`),
    ].join('\n'));
  }
  console.log(
    `${dependency.repositoryUrl}@${dependency.revision} contains all ${requiredCharts.length} canonical charts.`,
  );
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
