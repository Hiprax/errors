import type { Request, Response, NextFunction } from "express";
import { handleCommonErrors } from "./handleCommonErrors";
import ErrorHandler from "./ErrorHandler";

/**
 * Express middleware for handling errors.
 * Intercepts errors thrown in the application, processes them using `handleCommonErrors`,
 * and sends a standardized JSON response.
 *
 * @param {any} err - The original error object.
 * @param {Request} _req - The incoming HTTP request (unused in this middleware).
 * @param {Response} res - The outgoing HTTP response.
 * @param {NextFunction} _next - The next middleware function (unused in this middleware).
 *
 * @returns {void}
 *
 * @example
 * app.use(errorMiddleware);
 */
const errorMiddleware = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = handleCommonErrors(err);

  switch (err.code) {
    case "ENOENT":
      error = new ErrorHandler("Resource not found", 404);
      break;
    case 11000: {
      const duplicateField = Object.keys(err.keyValue || {}).join(", ");
      error = new ErrorHandler(
        `Duplicate entry for field(s): ${duplicateField}`,
        400
      );
      break;
    }
    case "EBADCSRFTOKEN":
      error = new ErrorHandler("Invalid CSRF token", 403);
      break;
    case "ECONNREFUSED":
      error = new ErrorHandler("Connection refused", 502);
      break;
    case "ECONNRESET":
      error = new ErrorHandler("Connection reset by peer", 502);
      break;
    case "ETIMEDOUT":
      error = new ErrorHandler("Connection timed out", 502);
      break;
    default:
      break;
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    statusCode: error.statusCode,
    statusText: error.statusText,
  });
};

export default errorMiddleware;
