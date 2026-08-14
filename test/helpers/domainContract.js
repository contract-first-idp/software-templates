const ENVIRONMENT_NAME_PATTERN = /^([a-z][a-z0-9]*)(-[a-z0-9]+)*$/;
const GROUP_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

function validateDomainEnvironmentContract(domain) {
  if (!GROUP_ID_PATTERN.test(domain?.spec?.groupId || '')) {
    throw new Error(`Domain groupId is invalid: ${domain?.spec?.groupId}`);
  }
  if (typeof domain?.spec?.platformTarget !== 'string' || !domain.spec.platformTarget.trim()) {
    throw new Error('Domain platformTarget must be a nonempty entity reference');
  }
  if (domain.spec.schemaRegistry || domain.spec.registry || domain.spec.argocd) {
    throw new Error('Domain contains target-owned runtime configuration');
  }
  const environments = domain?.spec?.environments;
  if (!environments || !Array.isArray(environments.order) || !environments.order.length) {
    throw new Error('Domain environments.order must be a nonempty array');
  }
  const order = environments.order;
  if (new Set(order).size !== order.length) {
    throw new Error('Domain environments.order contains duplicate names');
  }
  for (const name of order) {
    if (!ENVIRONMENT_NAME_PATTERN.test(name)) throw new Error(`unsafe environment name: ${name}`);
    const definition = environments.definitions?.[name];
    if (!definition) throw new Error(`ordered environment ${name} has no definition`);
    if (typeof definition.namespaceSuffix !== 'string') {
      throw new Error(`environment ${name} has no namespaceSuffix`);
    }
    if (Object.hasOwn(definition, 'clusterDomain')) {
      throw new Error(`environment ${name} contains target-owned clusterDomain`);
    }
  }
  if (!order.includes(environments.build)) {
    throw new Error(`build environment ${environments.build} is not ordered`);
  }
  if (order[0] !== environments.build) {
    throw new Error(`build environment ${environments.build} must be first in order`);
  }
}

module.exports = {
  ENVIRONMENT_NAME_PATTERN,
  GROUP_ID_PATTERN,
  validateDomainEnvironmentContract,
};
