const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const {renderDirectory} = require('../helpers/profileRenderer');
const {repositoryRoot: root} = require('../helpers/paths');

test('Resource skeleton renders PostgreSQL catalog and desired-state values', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'resource-skeleton-'));
  const values = {
    profile: 'postgresql',
    resourceName: 'orders-db',
    systemName: 'orders',
    systemRef: 'system:retail/orders',
    owner: 'group:default/domain-maintainers',
    scmProvider: 'github',
    scmHost: 'tenant.example',
    domainOrg: 'retail-team',
    domainRepo: 'retail-domain',
    repositoryName: 'orders-db-resource',
    repoWebUrl: 'https://tenant.example/retail-team/orders-db-resource',
    systemRepoWebUrl: 'https://tenant.example/retail-team/orders-system',
    postgresVersion: 16,
    replicaCount: 2,
    databaseName: 'orders',
    userName: 'orders_owner',
    storageClass: 'fast-block',
  };
  try {
    await renderDirectory({
      source: path.join(root, 'skeletons/resource/base'),
      destination: path.join(destination, 'base-repository'),
      values,
    });
    await renderDirectory({
      source: path.join(root,
        'skeletons/resource/implementations/postgresql/resource-repo'),
      destination: path.join(destination, 'repository'),
      values,
    });
    await renderDirectory({
      source: path.join(root,
        'skeletons/resource/implementations/postgresql/system-repo/base'),
      destination: path.join(destination, 'desired-state'),
      values,
    });
    expect(YAML.parse(await fs.readFile(
      path.join(destination, 'repository/catalog-info.yaml'), 'utf8')).spec.database)
      .toMatchObject({postgresVersion: 16, databaseName: 'orders', userName: 'orders_owner'});
    const readme = await fs.readFile(path.join(destination, 'base-repository/README.md'), 'utf8');
    expect(readme).not.toContain('${{');
    expect(readme).toContain('(docs/index.md)');
    await expect(fs.access(path.join(destination, 'repository/docs/index.md')))
      .resolves.toBeUndefined();
    expect(YAML.parse(await fs.readFile(
      path.join(destination, 'desired-state/values.yaml'), 'utf8')))
      .toMatchObject({
        implementation: {path: 'charts/resource/postgresql'},
        instances: {replicas: 2},
        user: {name: 'orders_owner', database: 'orders'},
      });
  } finally {
    await fs.rm(destination, {recursive: true, force: true});
  }
});
