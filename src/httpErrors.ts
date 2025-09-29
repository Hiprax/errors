import ErrorHandler from "./ErrorHandler";

type ErrorFactory = (message?: string) => ErrorHandler;

const createErrorFactory = (
  statusCode: number,
  defaultMessage?: string
): ErrorFactory => {
  return (message?: string) =>
    new ErrorHandler(message ?? defaultMessage ?? "Error", statusCode);
};

// Internal factories (not exported individually) to encourage namespaced usage
const badRequest: ErrorFactory = createErrorFactory(400, "Bad request");
const unauthorized: ErrorFactory = createErrorFactory(401, "Unauthorized");
const forbidden: ErrorFactory = createErrorFactory(403, "Forbidden");
const notFound: ErrorFactory = createErrorFactory(404, "Not found");
const conflict: ErrorFactory = createErrorFactory(409, "Conflict");
const tooManyRequests: ErrorFactory = createErrorFactory(
  429,
  "Too many requests"
);

const internalServerError: ErrorFactory = createErrorFactory(
  500,
  "Internal server error"
);
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
  conflict,
  tooManyRequests,
  internalServerError,
  badGateway,
  serviceUnavailable,
  gatewayTimeout,
};

export type { ErrorFactory };
