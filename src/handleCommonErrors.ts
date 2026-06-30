import ErrorHandler from "./ErrorHandler";
import errorCodes from "./errorCodes";

/**
 * Handles common error scenarios and maps them to appropriate `ErrorHandler` instances.
 * This function ensures consistent formatting for different error types.
 *
 * @param {any} err - The original error object.
 * @returns {ErrorHandler} - A standardized error object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mapper accepts arbitrary error shapes from third-party libraries (Mongoose, Axios, Zod, JWT, etc.).
export const handleCommonErrors = (err: any): ErrorHandler => {
  if (!err || typeof err !== "object") {
    return new ErrorHandler("Unexpected error occurred", 500);
  }

  switch (err.name) {
    case "CastError":
      return new ErrorHandler(
        `Resource not found. Invalid ${err.path}`,
        400,
        { cause: err }
      );
    case "ValidationError": {
      const message = Object.values(err.errors || {})
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose ValidationError sub-error shapes vary.
        .map((value: any) =>
          value && typeof value === "object" && typeof value.message === "string"
            ? value.message
            : ""
        )
        .filter((m: string) => m.length > 0)
        .join(", ");
      return new ErrorHandler(message || "Validation error", 400, { cause: err });
    }
    case "JsonWebTokenError":
    case "TokenExpiredError":
    case "NotBeforeError":
      return new ErrorHandler(
        "JSON Web Token is invalid or expired. Please try again",
        401,
        { cause: err }
      );
    case "AxiosError": {
      // Pass through the upstream HTTP status when available so callers of
      // *this* service see the real failure class (e.g. an upstream 404
      // surfaces as 404 instead of an opaque 502). Only propagate codes that
      // are valid HTTP error codes (i.e. present in `errorCodes`); anything
      // else (success codes, missing response, exotic codes) falls back to
      // the historical 502 "Bad gateway" behavior.
      const upstreamStatus: unknown = err.response?.status;
      if (
        typeof upstreamStatus === "number" &&
        errorCodes.has(upstreamStatus)
      ) {
        const baseMessage =
          typeof err.message === "string" && err.message.length
            ? err.message
            : "Error communicating with an external service";
        // Optionally enrich a generic Axios message with the upstream's
        // statusText (e.g. "Not Found") so the response includes context
        // beyond Axios's default "Request failed with status code 404"
        // template. We deliberately do NOT include `response.data` to avoid
        // leaking sensitive upstream payloads.
        const upstreamStatusText =
          typeof err.response?.statusText === "string" &&
          err.response.statusText.length
            ? err.response.statusText
            : undefined;
        const message = upstreamStatusText
          ? `${baseMessage} (${upstreamStatusText})`
          : baseMessage;
        return new ErrorHandler(message, upstreamStatus, { cause: err });
      }
      return new ErrorHandler(
        "Error communicating with an external service",
        502,
        { cause: err }
      );
    }
    case "SyntaxError":
      return new ErrorHandler("Malformed JSON or invalid syntax", 400, {
        cause: err,
      });
    case "AggregateError": {
      // `Promise.any` and similar APIs reject with an `AggregateError`. The
      // useful information lives on `err.errors[]`; the top-level `err.message`
      // is usually unhelpful (e.g. "All promises were rejected"). Join the
      // sub-error messages so the underlying causes are surfaced. Forward the
      // original `AggregateError` as `cause` so structured logging that walks
      // the chain still has access to the full sub-error array.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AggregateError sub-errors are typed as `unknown` after spec normalization; we accept arbitrary shapes.
      const subErrors: any[] = Array.isArray(err.errors) ? err.errors : [];
      const message =
        subErrors
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- See above; sub-errors may be plain values.
          .map((e: any) => {
            if (e && typeof e === "object" && typeof e.message === "string") {
              return e.message;
            }
            try {
              return String(e);
            } catch {
              return "";
            }
          })
          .filter((m: string) => m.length > 0)
          .join("; ") || "Multiple errors occurred";
      return new ErrorHandler(message, 500, { cause: err });
    }
    case "ZodError": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod's issue type is not a dependency.
      const issues: any[] = Array.isArray(err.issues) ? err.issues : [];
      const message = issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- issue shapes vary.
        .map((i: any) =>
          i && typeof i === "object" && typeof i.message === "string" ? i.message : ""
        )
        .filter((m: string) => m.length > 0)
        .join(", ");
      return new ErrorHandler(message || "Validation error", 400, {
        cause: err,
      });
    }
    default: {
      // Forward `cause` only when `err` is a non-primitive (object/Error). The
      // top-of-function guard already returns early for null/undefined/primitive
      // input, so by this point `err` is always a non-null object. Including
      // `cause` lets structured loggers walk back to the original error shape
      // (e.g. unrecognized library errors that pass `statusCode`/`message`
      // through but still carry useful auxiliary fields on the original).
      return new ErrorHandler(
        typeof err.message === "string" && err.message.length
          ? err.message
          : "Unhandled server error",
        typeof err.statusCode === "number" ? err.statusCode : 500,
        { cause: err }
      );
    }
  }
};
