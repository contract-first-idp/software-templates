const COMPACT_ECLIPSE_FORMATTER = `<?xml version="1.0" encoding="UTF-8"?>
<profiles version="21">
  <profile kind="CodeFormatterProfile" name="Dry-run payload" version="21">
    <setting id="org.eclipse.jdt.core.formatter.tabulation.char" value="space"/>
    <setting id="org.eclipse.jdt.core.formatter.tabulation.size" value="4"/>
    <setting id="org.eclipse.jdt.core.formatter.lineSplit" value="120"/>
  </profile>
</profiles>
`;

function componentDryRunOverrides(profile) {
  const overrides = {
    [`skeletons/component/implementations/${profile}/.mvn/wrapper/maven-wrapper.jar`]: '',
  };
  if (profile.startsWith('quarkus-camel-openapi')) {
    overrides[
      `skeletons/component/implementations/${profile}/eclipse-formatter-config.xml`
    ] = COMPACT_ECLIPSE_FORMATTER;
  }
  return overrides;
}

const componentRegistryFixtures = [
  'test/fixtures/scenarios/cross-system/contracts/authorization.yaml',
  'test/fixtures/scenarios/bookinfo/contracts/details.yaml',
  'test/fixtures/scenarios/cross-system/contracts/vendor-details.yaml',
];

module.exports = {componentDryRunOverrides, componentRegistryFixtures};
