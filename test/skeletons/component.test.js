const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {XMLValidator} = require('fast-xml-parser');
const YAML = require('yaml');
const {
  consumedApis,
  profileValues,
  providedApi,
} = require('../helpers/componentProfileFixtures');
const {renderComponentProfile, renderDirectory} = require('../helpers/profileRenderer');
const {repositoryRoot: root} = require('../helpers/paths');

const profiles = [
  'spring-boot-openapi',
  'spring-boot-camel-openapi',
  'quarkus-camel-openapi',
  'quarkus-camel-openapi-yaml',
  'nodejs-openapi',
];

const exactSha = '0123456789abcdef0123456789abcdef01234567';

const scenarios = {
  basic: {
    provided_api: null,
    consumed_apis: [],
  },
  'cross-system': {
    provided_api: {
      ...providedApi,
      version: 'v2.1.3',
    },
    consumed_apis: [
      consumedApis.bookinfoDetails,
      {
        ...consumedApis.payments,
        version: 'v2.1.3',
      },
      {
        ...consumedApis.vendorDetails,
        version: exactSha,
      },
      consumedApis.wiringOnly,
    ],
  },
};

describe('Component implementation profiles', () => {
  let temporaryRoot;

  beforeAll(async () => {
    temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'component-skeleton-'),
    );
  });

  afterAll(async () => {
    await fs.rm(temporaryRoot, {
      recursive: true,
      force: true,
    });
  });

  test.each(profiles)(
    '%s renders the basic and cross-System scenarios',
    async profile => {
      for (const [scenario, selection] of Object.entries(scenarios)) {
        const destination = path.join(
          temporaryRoot,
          profile,
          scenario,
        );

        await renderComponentProfile({
          root,
          profile,
          destination,
          values: profileValues({
            implementationProfile: profile,
            ...selection,
          }),
        });

        const files = await fs.readdir(destination, {
          recursive: true,
        });

        const textFiles = [];

        for (const relative of files) {
          const file = path.join(destination, relative);

          if (
            !(await fs.stat(file)).isFile()
            || relative.endsWith('.jar')
          ) {
            continue;
          }

          const content = await fs.readFile(file);

          if (!content.subarray(0, 8192).includes(0)) {
            textFiles.push(content.toString('utf8'));
          }
        }

        const generated = textFiles.join('\n');

        expect(generated).not.toContain('${{');
        expect(generated).not.toContain('{%');
        expect(generated).not.toMatch(
          /\.dockerconfigjson|clientSecret|BEGIN PRIVATE KEY/,
        );

        if (profile === 'nodejs-openapi') {
          const packageJson = JSON.parse(
            await fs.readFile(
              path.join(destination, 'package.json'),
              'utf8',
            ),
          );
          const packageLock = JSON.parse(
            await fs.readFile(
              path.join(destination, 'package-lock.json'),
              'utf8',
            ),
          );

          expect(packageJson.engines.node).toBe('>=24 <25');
          expect(generated).toContain('npm ci');
          expect(packageLock).toMatchObject({
            name: packageJson.name,
            lockfileVersion: 3,
          });
          expect(packageLock.packages[''].dependencies).toEqual(
            packageJson.dependencies,
          );

          expect(packageJson.scripts.test).toContain('npm run build');
          expect(packageJson.dependencies).toEqual(expect.objectContaining({
            express: expect.any(String),
            'openapi-backend': expect.any(String),
            'openapi-client-axios': expect.any(String),
          }));
          expect(generated).toContain(
            'registry.access.redhat.com/ubi9/nodejs-24:latest',
          );
          expect(generated).toMatch(/id: run[\s\S]*npm ci[\s\S]*npm run build[\s\S]*npm start/);

          const openapiConfig = JSON.parse(
            await fs.readFile(
              path.join(destination, 'openapi.config.json'),
              'utf8',
            ),
          );

          if (scenario === 'basic') {
            expect(openapiConfig.provided).toBeNull();
            expect(openapiConfig.consumed).toEqual([]);
          } else {
            expect(openapiConfig.provided).toMatchObject({
              version: 'v2.1.3',
            });

            expect(openapiConfig.consumed).toHaveLength(selection.consumed_apis.length);
            expect(openapiConfig.consumed.map(api => api.version))
              .toEqual(selection.consumed_apis.map(api => api.version));
            expect(openapiConfig.consumed.every(api =>
              api.alias && api.defaultBaseUrl.startsWith('http://'))).toBe(true);
            expect(generated).toContain('OPENAPI_CLIENT_');
          }

          continue;
        }

        const pom = await fs.readFile(
          path.join(destination, 'pom.xml'),
          'utf8',
        );

        expect(XMLValidator.validate(pom)).toBe(true);
        if (scenario === 'basic') {
          expect(pom).not.toContain(
            'apicurio-registry-maven-plugin',
          );
          continue;
        }

        for (const api of selection.consumed_apis) {
          expect(pom).toContain(api.contract_file);
        }

        expect(pom).toContain('<version>v2.1.3</version>');
        expect(pom).toContain(`<version>${exactSha}</version>`);

        if (profile !== 'spring-boot-openapi') {
          expect(generated).toMatch(
            /missingOperation\(["']mock["']\)|missingOperation:\s*mock/,
          );

          expect(generated).not.toMatch(
            /missingOperation\(["']ignore["']\)|missingOperation:\s*ignore/,
          );

          for (const api of selection.consumed_apis) {
            for (const operation of api.operations) {
              expect(generated).toContain(`direct:${api.alias}.${operation.operation_id}`);
            }
          }
        }
      }
    },
  );
});

test.each(Object.entries(scenarios))(
  'Component base renders clean catalog metadata for %s API selection',
  async (scenario, selection) => {
    const destination = await fs.mkdtemp(
      path.join(os.tmpdir(), 'component-base-'),
    );

    try {
      await renderDirectory({
        source: path.join(
          root,
          'skeletons/component/base',
        ),
        destination,
        values: {
          componentName: 'registry-verification',
          description: 'Hermetic Apicurio Registry verification',
          scmProvider: 'github',
          scmHost: 'github.com',
          domainOrg: 'contract-first-idp',
          domainRepo: 'storefront-domain',
          repositoryName: 'registry-verification',
          implementationProfile: 'spring-boot-openapi',
          buildProfile: 'spring-boot',
          owner: 'group:default/domain-maintainers',
          systemRef: 'system:cf-idp-integration-tests/storefront',
          schemaRegistryApiUrl:
            'https://apicurio.invalid/apis/registry/v3',
          implementsApi: Boolean(selection.provided_api),
          apiRef: selection.provided_api?.ref || '',
          ...selection,
        },
      });

      const catalog = YAML.parse(
        await fs.readFile(
          path.join(destination, 'catalog-info.yaml'),
          'utf8',
        ),
      );

      expect(
        catalog.spec.providesApis || [],
      ).toHaveLength(
        selection.provided_api ? 1 : 0,
      );

      expect(
        catalog.spec.consumesApis || [],
      ).toHaveLength(
        selection.consumed_apis.length,
      );
    } finally {
      await fs.rm(destination, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  'Component desired-state base includes values and the initial build release',
  async () => {
    const destination = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        'component-desired-state-',
      ),
    );

    try {
      const values = {
        componentName: 'storefront-client',
        componentRepoCloneUrl:
          'https://git.example/storefront-client.git',
        implementationProfile: 'quarkus-camel-openapi',
        buildProfile: 'quarkus-native',
        buildEnabled: true,
        sourceRevision: 'main',
        buildEnvironment: 'sandbox',
        environment: 'sandbox',
      };

      await renderDirectory({
        source: path.join(
          root,
          'skeletons/component/system-repo/base',
        ),
        destination,
        values,
      });

      await renderDirectory({
        source: path.join(
          root,
          'skeletons/component/system-repo/environment',
        ),
        destination: path.join(
          destination,
          'environments',
        ),
        values,
      });

      const desiredState = YAML.parse(
        await fs.readFile(
          path.join(destination, 'values.yaml'),
          'utf8',
        ),
      );

      expect(desiredState).toHaveProperty(
        'build.enabled',
        true,
      );

      expect(desiredState).toHaveProperty(
        'build.profile',
        'quarkus-native',
      );

      expect(desiredState.build).not.toHaveProperty(
        'dockerfilePath',
      );

      expect(
        YAML.parse(
          await fs.readFile(
            path.join(
              destination,
              'releases/sandbox.yaml',
            ),
            'utf8',
          ),
        ),
      ).toEqual({
        image: {
          tag: 'latest',
        },
      });

      expect(
        YAML.parse(
          await fs.readFile(
            path.join(
              destination,
              'environments/sandbox.yaml',
            ),
            'utf8',
          ),
        ),
      ).toHaveProperty(
        'image.pullPolicy',
        'Always',
      );

      const environmentSource = await fs.readFile(
        path.join(
          root,
          'skeletons/component/system-repo/environment/${{ values.environment }}.yaml',
        ),
        'utf8',
      );

      expect(environmentSource).not.toMatch(
        /quarkus|spring|nodejs|implementationProfile/,
      );
    } finally {
      await fs.rm(destination, {
        recursive: true,
        force: true,
      });
    }
  },
);
