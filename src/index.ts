/**
 * @module errors
 * This module provides a centralized error-handling mechanism for Express applications.
 * It defines a custom error class `ErrorHandler`, helper functions for common error types,
 * and an Express middleware to handle errors gracefully.
 */

export { default as ErrorHandler } from "./ErrorHandler";
export { default as errorMiddleware } from "./errorMiddleware";
export { default as errorCodes } from "./errorCodes";
