import ErrorHandler from "./ErrorHandler";

/**
 * Handles common error scenarios and maps them to appropriate `ErrorHandler` instances.
 * This function ensures consistent formatting for different error types.
 *
 * @param {any} err - The original error object.
 * @returns {ErrorHandler} - A standardized error object.
 */
export const handleCommonErrors = (err: any): ErrorHandler => {
  if (!err || typeof err !== "object") {
    return new ErrorHandler("Unexpected error occurred", 500);
  }

  switch (err.name) {
    case "CastError":
      return new ErrorHandler(`Resource not found. Invalid ${err.path}`, 400);
    case "ValidationError": {
      const message = Object.values(err.errors)
        .map((value: any) => value.message)
        .join(", ");
      return new ErrorHandler(message, 400);
    }
    case "JsonWebTokenError":
    case "TokenExpiredError":
      return new ErrorHandler(
        "JSON Web Token is invalid or expired. Please try again",
        400
      );
    case "AxiosError":
      return new ErrorHandler(
        "Error communicating with an external service",
        502
      );
    case "SyntaxError":
      return new ErrorHandler("Malformed JSON or invalid syntax", 400);
    case "ZodError": {
      const message = (err.issues || []).map((i: any) => i.message).join(", ");
      return new ErrorHandler(message || "Validation error", 400);
    }
    default:
      return new ErrorHandler(
        typeof err.message === "string" && err.message.length
          ? err.message
          : "Unhandled server error",
        typeof err.statusCode === "number" ? err.statusCode : 500
      );
  }
};
