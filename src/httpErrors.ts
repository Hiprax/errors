import ErrorHandler from "./ErrorHandler";

type ErrorFactory = (message?: string) => ErrorHandler;

const createErrorFactory = (
  statusCode: number,
  defaultMessage?: string
): ErrorFactory => {
  return (message?: string) =>
    new ErrorHandler(message ?? defaultMessage ?? "Error", statusCode);
};

export const badRequest: ErrorFactory = createErrorFactory(400, "Bad request");
export const unauthorized: ErrorFactory = createErrorFactory(
  401,
  "Unauthorized"
);
export const forbidden: ErrorFactory = createErrorFactory(403, "Forbidden");
export const notFound: ErrorFactory = createErrorFactory(404, "Not found");
export const conflict: ErrorFactory = createErrorFactory(409, "Conflict");
export const tooManyRequests: ErrorFactory = createErrorFactory(
  429,
  "Too many requests"
);

export const internalServerError: ErrorFactory = createErrorFactory(
  500,
  "Internal server error"
);
export const badGateway: ErrorFactory = createErrorFactory(502, "Bad gateway");
export const serviceUnavailable: ErrorFactory = createErrorFactory(
  503,
  "Service unavailable"
);
export const gatewayTimeout: ErrorFactory = createErrorFactory(
  504,
  "Gateway timeout"
);

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
