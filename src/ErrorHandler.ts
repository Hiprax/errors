import errorCodes from "./errorCodes";

/**
 * Options bag for the {@link ErrorHandler} constructor. Mirrors the standard
 * ES2022 `ErrorOptions` shape so callers can attach an underlying `cause`
 * (the error that triggered this one) for richer error chains and structured
 * logging that walks `err.cause`.
 */
export interface ErrorHandlerOptions {
  /**
   * The original error that caused this `ErrorHandler` to be raised. Forwarded
   * to the native `Error` constructor so the value lands on `this.cause` per
   * the ES2022 spec.
   */
  cause?: unknown;
}

/**
 * Custom error class for standardized error handling.
 * Extends the built-in `Error` class to include HTTP status codes and descriptions.
 *
 * @class
 * @extends Error
 */
class ErrorHandler extends Error {
  /**
   * HTTP status code associated with the error.
   * @type {number}
   */
  public statusCode: number;

  /**
   * HTTP status text associated with the error.
   * @type {string | undefined}
   */
  public statusText: string | undefined;

  /**
   * Constructor to initialize the error object with a message and status code.
   * Defaults to a generic server error if the status code is not recognized.
   *
   * @param {string} [message="Something went wrong! Please try again"] - Error message.
   * @param {number} [statusCode=500] - HTTP status code.
   * @param {ErrorHandlerOptions} [options] - Optional ES2022 error options bag.
   *   Pass `{ cause: originalError }` to preserve the underlying error for
   *   debugging / structured logging. Forwarded to `super(message, options)`.
   */
  constructor(
    message = "Something went wrong! Please try again",
    statusCode = 500,
    options?: ErrorHandlerOptions
  ) {
    // Forward the options bag (containing `cause`, if any) to the native
    // Error constructor so it lands on `this.cause` per the ES2022 spec.
    // We deliberately only forward when defined to preserve the historical
    // single-argument super call behavior in environments that may not yet
    // accept the second argument (none of our supported Node versions, but
    // belt-and-braces for exotic runtimes).
    if (options !== undefined) {
      super(message, options);
    } else {
      super(message);
    }
    this.name = "ErrorHandler";
    this.statusCode = errorCodes.has(statusCode) ? statusCode : 500;
    this.statusText = errorCodes.get(this.statusCode);

    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ErrorHandler;
