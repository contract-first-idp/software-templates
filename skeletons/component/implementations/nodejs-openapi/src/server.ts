import addFormatsModule, {type FormatsPlugin} from 'ajv-formats';
import express, {type Request, type Response} from 'express';
import {OpenAPIBackend, type Context, type Request as OpenAPIRequest} from 'openapi-backend';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

import {handlers} from './handlers.js';
import {openapiRuntime} from './generated/runtime-config.js';

const addFormats = addFormatsModule as unknown as FormatsPlugin;

function firstSuccessStatus(operation: {responses?: Record<string, unknown>} | undefined) {
  const statuses = Object.keys(operation?.responses ?? {})
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value >= 200 && value < 300)
    .sort((a, b) => a - b);
  return statuses[0] ?? 200;
}

export async function createApp() {
  const app = express();
  app.use(express.json());

  app.get(['/health', '/health/live', '/health/ready'], (_req: Request, res: Response) => {
    res.status(200).json({status: 'UP'});
  });

  if (!openapiRuntime.provided) {
    app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({component: '${{ values.component_id }}'});
    });
    return app;
  }

  const definition = path.join(process.cwd(), 'contracts', 'provided-api.yaml');
  const api = new OpenAPIBackend({
    definition,
    strict: true,
    validate: true,
    coerceTypes: true,
    customizeAjv: (ajv) => {
      addFormats(ajv);
      return ajv;
    },
  });

  api.register(handlers);
  api.register({
    validationFail: (context: Context, _req: Request, res: Response) =>
      res.status(400).json({error: 'request does not match OpenAPI contract', details: context.validation.errors}),
    notFound: (_context: Context, _req: Request, res: Response) =>
      res.status(404).json({error: 'not found'}),
    methodNotAllowed: (_context: Context, _req: Request, res: Response) =>
      res.status(405).json({error: 'method not allowed'}),
    notImplemented: (context: Context) => {
      const {status, mock} = context.api.mockResponseForOperation(context.operation.operationId!);
      return {__cfidpMockResponse: true, status, body: mock};
    },
    postResponseHandler: (context: Context, _req: Request, res: Response) => {
      const generatedMock = context.response as {
        __cfidpMockResponse?: boolean;
        status?: number;
        body?: unknown;
      };
      const isGeneratedMock = generatedMock?.__cfidpMockResponse === true;
      const status = isGeneratedMock && generatedMock.status
        ? generatedMock.status
        : firstSuccessStatus(context.operation);
      const body = isGeneratedMock ? generatedMock.body : context.response;
      const result = context.api.validateResponse(body, context.operation, status);
      if (result.errors) {
        return res.status(500).json({
          error: 'handler response does not match OpenAPI contract',
          details: result.errors,
        });
      }
      return res.status(status).json(body);
    },
  });

  await api.init();
  app.use((req: Request, res: Response) =>
    api.handleRequest(req as unknown as OpenAPIRequest, req, res));
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number.parseInt(process.env.PORT || '8080', 10);
  const app = await createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`${{ values.component_id }} listening on ${port}`);
  });
}
