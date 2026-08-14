const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const {renderDirectory} = require('../helpers/profileRenderer');
const {repositoryRoot: root} = require('../helpers/paths');

test('System skeleton renders its catalog identity and group', async () => {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'system-skeleton-'));
  try {
    await renderDirectory({
      source: path.join(root, 'skeletons/system/base'),
      destination,
      values: {
        systemName: 'orders',
        description: 'Order management',
        domainRef: 'domain:retail/retail',
        groupId: 'com.example.orders',
        owner: 'group:default/domain-maintainers',
        scmProvider: 'github',
        scmHost: 'tenant.example',
        domainOrg: 'retail-team',
        domainRepo: 'retail-domain',
        repositoryName: 'orders-system',
      },
    });
    const catalog = YAML.parse(await fs.readFile(
      path.join(destination, 'catalog-info.yaml'), 'utf8'));
    expect(catalog.spec).toMatchObject({
      domain: 'domain:retail/retail',
      groupId: 'com.example.orders',
    });
    expect(catalog.metadata.annotations['contract-first-idp.github.io/repository-name'])
      .toBe('orders-system');
  } finally {
    await fs.rm(destination, {recursive: true, force: true});
  }
});
