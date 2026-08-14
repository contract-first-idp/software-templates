/**
 * Register provided-API operation handlers here.
 *
 * The default server mocks any operation without a handler from the OpenAPI contract,
 * so a newly scaffolded component is immediately runnable. When implementing an
 * operation, use the generated OperationHandler/OperationResponse types from
 * ./generated/provided-api.js to keep request and response code contract-typed.
 */
export type HandlerMap = Record<string, (...args: any[]) => any>;

export const handlers: HandlerMap = {};
