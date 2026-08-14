const providedApi = {
  ref: 'api:cf-idp-integration-tests/reviews',
  name: 'reviews',
  registry_group_id: 'io.github.cfidp.bookinfo',
  registry_artifact_id: 'reviews',
  contract_file: 'reviews-api.yaml',
  version: 'latest',
};

const consumedApis = {
  bookinfoDetails: {
    ref: 'api:cf-idp-integration-tests/details',
    namespace: 'cf-idp-integration-tests',
    name: 'details',
    alias: 'cf-idp-integration-tests-details',
    registry_group_id: 'io.github.cfidp.bookinfo',
    registry_artifact_id: 'details',
    contract_file: 'cf-idp-integration-tests-details-api.yaml',
    version: 'latest',
    operations: [{
      operation_id: 'getProduct',
      method: 'get',
      path: '/details/{id}',
      summary: 'Get product details',
    }],
  },
  payments: {
    ref: 'api:payments/authorization',
    namespace: 'payments',
    name: 'authorization',
    alias: 'payments-authorization',
    registry_group_id: 'io.github.cfidp.payments',
    registry_artifact_id: 'authorization',
    contract_file: 'payments-authorization-api.yaml',
    version: 'latest',
    operations: [{
      operation_id: 'authorizePayment',
      method: 'post',
      path: '/authorizations',
      summary: 'Authorize a payment',
    }],
  },
  vendorDetails: {
    ref: 'api:vendor/details',
    namespace: 'vendor',
    name: 'details',
    alias: 'vendor-details',
    registry_group_id: 'com.vendor.catalog',
    registry_artifact_id: 'details',
    contract_file: 'vendor-details-api.yaml',
    version: 'latest',
    operations: [{
      operation_id: 'getProduct',
      method: 'get',
      path: '/details/{id}',
      summary: 'Get vendor product details',
    }],
  },
  wiringOnly: {
    ref: 'api:cf-idp-integration-tests/wiring-only',
    namespace: 'cf-idp-integration-tests',
    name: 'wiring-only',
    alias: 'cf-idp-integration-tests-wiring-only',
    registry_group_id: 'io.github.cfidp.bookinfo',
    registry_artifact_id: 'wiring-only',
    contract_file: 'cf-idp-integration-tests-wiring-only-api.yaml',
    version: 'latest',
    operations: [],
  },
};

function profileValues(overrides = {}) {
  return {
    component_id: 'registry-verification',
    componentName: 'registry-verification',
    implementationProfile: 'spring-boot-openapi',
    description: 'Hermetic Apicurio Registry verification',
    owner: 'group:default/domain-maintainers',
    system_ref: 'system:cf-idp-integration-tests/storefront',
    system_name: 'storefront',
    git_org: 'contract-first-idp',
    openshift_cluster_domain: 'apps.example.com',
    group_id: 'io.github.cfidp.storefront',
    java_package: 'io.github.cfidp.storefront.registryverification',
    folder_java_package: 'io/github/cfidp/storefront/registryverification',
    schema_registry_api_url: 'https://apicurio.invalid/apis/registry/v3',
    provided_api: null,
    consumed_apis: [],
    ...overrides,
  };
}

module.exports = {consumedApis, profileValues, providedApi};
