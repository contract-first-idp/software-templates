const {getTestConfig} = require('../helpers/env');
const {runDryRun} = require('../helpers/dryRun');
const {
  componentDryRunOverrides,
  componentRegistryFixtures,
} = require('../helpers/component');
const {expectFile} = require('../helpers/assertions');

test('live Backstage dry-run creates a complex cross-System Component', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/component',
    fixturePath: 'test/fixtures/inputs/cross-system/component.yaml',
    domainContractPath: 'test/fixtures/inputs/nonstandard-lifecycle/domain.yaml',
    writeOutput: config.writeOutput,
    dependencyContentOverrides: componentDryRunOverrides('quarkus-camel-openapi'),
    registryContentFixtures: componentRegistryFixtures,
  });
  const pom = expectFile(result, 'component-repo/pom.xml');
  expect(pom).toContain('<groupId>io.github.cfidp.payments</groupId>');
  expect(pom).toContain('<groupId>com.vendor.catalog</groupId>');
  const routes = expectFile(result,
    'component-repo/src/main/java/io/github/cfidp/storefront/storefrontclient/ApiRoute.java');
  expect(routes).toContain('direct:payments-authorization.authorizePayment');
  expect(routes).toContain('direct:cf-idp-integration-tests-details.getProduct');
  expect(routes).toContain('direct:vendor-details.getProduct');
}, 30000);

test('live Backstage dry-run creates a Component without APIs', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/component',
    fixturePath: 'test/fixtures/inputs/basic/component.yaml',
    domainContractPath: 'test/fixtures/inputs/nonstandard-lifecycle/domain.yaml',
    writeOutput: config.writeOutput,
    dependencyContentOverrides: componentDryRunOverrides('spring-boot-openapi'),
  });
  const pom = expectFile(result, 'component-repo/pom.xml');
  expect(pom).not.toContain('apicurio-registry-maven-plugin');
}, 30000);

test('live Backstage dry-run creates a provided-API-only Component', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/component',
    fixturePath: 'test/fixtures/inputs/cross-system/component-provided-only.yaml',
    domainContractPath: 'test/fixtures/inputs/nonstandard-lifecycle/domain.yaml',
    writeOutput: config.writeOutput,
    dependencyContentOverrides: componentDryRunOverrides('spring-boot-openapi'),
  });
  const pom = expectFile(result, 'component-repo/pom.xml');
  expect(pom).toContain('<artifactId>reviews</artifactId>');
  expect(pom).toContain('<version>v1.2.3</version>');
}, 30000);

test('live Backstage dry-run creates a one-consumed-API Component', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/component',
    fixturePath: 'test/fixtures/inputs/cross-system/component-one-consumed.yaml',
    domainContractPath: 'test/fixtures/inputs/nonstandard-lifecycle/domain.yaml',
    writeOutput: config.writeOutput,
    dependencyContentOverrides: componentDryRunOverrides('quarkus-camel-openapi'),
    registryContentFixtures: [
      'test/fixtures/scenarios/bookinfo/contracts/details.yaml',
    ],
  });
  const routes = expectFile(result,
    'component-repo/src/main/java/io/github/cfidp/storefront/detailsclient/ApiRoute.java');
  expect(routes).toContain('direct:cf-idp-integration-tests-details.getProduct');
}, 30000);

test('live Backstage dry-run isolates two versions of the same consumed API', async () => {
  const config = getTestConfig();
  const result = await runDryRun({
    baseUrl: config.baseUrl,
    token: config.token,
    templatePath: 'templates/component',
    fixturePath: 'test/fixtures/inputs/cross-system/component-duplicate-versions.yaml',
    domainContractPath: 'test/fixtures/inputs/nonstandard-lifecycle/domain.yaml',
    writeOutput: config.writeOutput,
    dependencyContentOverrides: componentDryRunOverrides('quarkus-camel-openapi'),
    registryContentFixtures: [
      'test/fixtures/scenarios/bookinfo/contracts/details.yaml',
      'test/fixtures/scenarios/cross-system/contracts/authorization.yaml',
    ],
  });
  const routes = expectFile(result,
    'component-repo/src/main/java/io/github/cfidp/storefront/versioncomparisonclient/ApiRoute.java');
  expect(routes).toContain('direct:cf-idp-integration-tests-details.getProduct');
  expect(routes).toContain('direct:cf-idp-integration-tests-details.authorizePayment');
}, 30000);
