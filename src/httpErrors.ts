import ErrorHandler, { ErrorHandlerOptions } from "./ErrorHandler";

/**
 * Factory function shape produced by every `httpErrors.*` helper. Accepts an
 * optional message override and an optional ES2022 options bag (currently just
 * `cause`) for preserving the underlying error in the resulting
 * {@link ErrorHandler}'s `cause` slot.
 */
type ErrorFactory = (
  message?: string,
  options?: ErrorHandlerOptions
) => ErrorHandler;

const createErrorFactory = (
  statusCode: number,
  defaultMessage?: string
): ErrorFactory => {
  return (message?: string, options?: ErrorHandlerOptions) =>
    new ErrorHandler(
      message ?? defaultMessage ?? "Error",
      statusCode,
      options
    );
};

// Internal factories (not exported individually) to encourage namespaced usage
const badRequest: ErrorFactory = createErrorFactory(400, "Bad request");
const unauthorized: ErrorFactory = createErrorFactory(401, "Unauthorized");
const forbidden: ErrorFactory = createErrorFactory(403, "Forbidden");
const notFound: ErrorFactory = createErrorFactory(404, "Not found");
const methodNotAllowed: ErrorFactory = createErrorFactory(
  405,
  "Method not allowed"
);
const requestTimeout: ErrorFactory = createErrorFactory(
  408,
  "Request timeout"
);
const conflict: ErrorFactory = createErrorFactory(409, "Conflict");
const gone: ErrorFactory = createErrorFactory(410, "Gone");
const payloadTooLarge: ErrorFactory = createErrorFactory(
  413,
  "Payload too large"
);
const unsupportedMediaType: ErrorFactory = createErrorFactory(
  415,
  "Unsupported media type"
);
const unprocessableEntity: ErrorFactory = createErrorFactory(
  422,
  "Unprocessable entity"
);
const tooManyRequests: ErrorFactory = createErrorFactory(
  429,
  "Too many requests"
);

const internalServerError: ErrorFactory = createErrorFactory(
  500,
  "Internal server error"
);
const notImplemented: ErrorFactory = createErrorFactory(501, "Not implemented");
const badGateway: ErrorFactory = createErrorFactory(502, "Bad gateway");
const serviceUnavailable: ErrorFactory = createErrorFactory(
  503,
  "Service unavailable"
);
const gatewayTimeout: ErrorFactory = createErrorFactory(504, "Gateway timeout");

export const httpErrors = {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  requestTimeout,
  conflict,
  gone,
  payloadTooLarge,
  unsupportedMediaType,
  unprocessableEntity,
  tooManyRequests,
  internalServerError,
  notImplemented,
  badGateway,
  serviceUnavailable,
  gatewayTimeout,
};

export type { ErrorFactory };
