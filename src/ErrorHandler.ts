import errorCodes from "./errorCodes";

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
   */
  constructor(
    message = "Something went wrong! Please try again",
    statusCode = 500
  ) {
    super(message);
    this.statusCode = errorCodes.has(statusCode) ? statusCode : 500;
    this.statusText = errorCodes.get(this.statusCode);
  }
}

export default ErrorHandler;
