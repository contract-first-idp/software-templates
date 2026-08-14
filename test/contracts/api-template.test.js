const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const {repositoryRoot: root} = require('../helpers/paths');

const template = YAML.parse(fs.readFileSync(
  path.join(root, 'templates/api/template.yaml'),
  'utf8',
));
const source = fs.readFileSync(path.join(root, 'templates/api/template.yaml'), 'utf8');

test('API template consumes runtime configuration from the target entity', () => {
  expect(source).toContain('steps.fetchTarget.output.entity.spec.platform.schemaRegistry.apiUrl');
  expect(source).toContain('steps.fetchTarget.output.entity.spec.platform.cluster.routerDomain');
});

test('API template stages the selected document without governing it', () => {
  expect(template.spec.steps.find(step => step.id === 'prepareSpecification')).toMatchObject({
    action: 'roadiehq:utils:jsonata',
    input: {
      data: {
        dataUrl: '${{ parameters.specificationFile }}',
        apiId: '${{ parameters.apiId }}',
        description: '${{ parameters.description }}',
      },
      expression: expect.any(String),
    },
  });
  expect(template.spec.steps.find(step => step.id === 'writeSpecification')).toMatchObject({
    action: 'roadiehq:utils:fs:write',
    input: {
      path: 'api-repo/specification.yaml',
      content: '${{ steps.prepareSpecification.output.result.content }}',
      preserveFormatting: true,
    },
  });
});
