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
  // Normalize to our ErrorHandler using common mappers
  let error = handleCommonErrors(err);

  // Map various known Node/Mongo/Network codes to friendlier messages
  switch (err?.code) {
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
    case "ECONNRESET":
    case "ETIMEDOUT":
      error = new ErrorHandler("Upstream network error", 502);
      break;
    default:
      break;
  }

  if (res.headersSent) {
    // Avoid writing after headers were sent; just end the response
    try {
      res.end();
    } catch {}
    return;
  }

  const isProd = process.env.NODE_ENV === "production";
  const payload: Record<string, any> = {
    success: false,
    message: error.message,
    statusCode: error.statusCode,
    statusText: error.statusText,
  };

  if (!isProd && err?.stack) {
    payload.stack = String(err.stack);
  }

  res.status(error.statusCode).json(payload);
};

export default errorMiddleware;
