import type { ErrorRequestHandler } from "express";
import { handleCommonErrors } from "./handleCommonErrors";
import ErrorHandler from "./ErrorHandler";

/**
 * Maximum size (in characters) for the serialized stack trace included in the
 * non-production response body. Keeps the response bounded even when an error
 * carries a pathologically large stack.
 */
const MAX_STACK_LENGTH = 10_000;

/**
 * Public response shape produced by {@link errorMiddleware}.
 *
 * Consumers (e.g. typed `fetch` wrappers, error parsers) can import this type
 * to statically type the JSON body returned by the middleware.
 */
export interface ErrorPayload {
  success: false;
  message: string;
  statusCode: number;
  statusText: string | undefined;
  stack?: string;
}

/**
 * Options for {@link createErrorMiddleware}.
 */
export interface ErrorMiddlewareOptions {
  /**
   * Whether server-error (status >= 500) messages are sent to the client.
   *
   * - `true` (default): always include the resolved message — preserves the
   *   historical, zero-config behavior of {@link errorMiddleware}.
   * - `false`: in production (`NODE_ENV === "production"`), replace the message
   *   for `statusCode >= 500` with the generic status text (e.g. "Internal
   *   Server Error") so internal details are not leaked to the client
   *   (CWE-209). The original error remains available to structured loggers via
   *   `err.cause`. Client errors (4xx) and non-production responses are
   *   unaffected.
   */
  exposeServerErrors?: boolean;
}

/**
 * Safely read a string value from a property that may be backed by a throwing
 * getter or a non-string value. Returns `fallback` if reading or coercion
 * throws.
 */
function safeReadString(read: () => unknown, fallback: string): string {
  try {
    const value = read();
    /* istanbul ignore if -- defensive: at the only call site, `read`
     * returns `error.message` from a freshly constructed ErrorHandler,
     * whose `message` is always a string. */
    if (value === undefined || value === null) return fallback;
    // String() can also call a throwing toString; guard that too.
    return String(value);
  } catch {
    /* istanbul ignore next -- defensive: at the only call site in this
     * module, `read` returns `error.message` from a freshly constructed
     * ErrorHandler, which always has a string `message`. The guard exists
     * so the middleware survives a future ErrorHandler subclass that
     * exposes `message` as a throwing getter. */
    return fallback;
  }
}

/**
 * Returns a JSON.stringify replacer that strips circular references and
 * non-serializable values (e.g. BigInt, functions) so a sanitized payload can
 * be serialized after a primary stringify failure.
 */
/* istanbul ignore next -- defensive: at the call site, the payload only
 * contains primitives (booleans, numbers, strings) so the bigint, function,
 * symbol, and circular branches are never exercised in practice. The
 * replacer is wired in for future-proofing if the payload shape grows. */
function createSafeReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (_key, value) => {
    if (typeof value === "bigint") return `${value.toString()}n`;
    if (typeof value === "function" || typeof value === "symbol") return undefined;
    if (typeof value === "object" && value !== null) {
      if (seen.has(value as object)) return "[Circular]";
      seen.add(value as object);
    }
    return value;
  };
}

/**
 * Build an Express error middleware with optional response hardening.
 *
 * The returned middleware intercepts errors thrown in the application,
 * processes them using {@link handleCommonErrors}, and sends a standardized
 * JSON response.
 *
 * The middleware is hardened against errors whose `message` or `stack`
 * accessors throw, against payloads that fail JSON serialization (circular
 * references, BigInt, etc.), and against pathologically large stack traces.
 *
 * When `res.headersSent` is true the middleware delegates to Express's
 * default error handler (`next(err)`) so its well-tested teardown logic can
 * close the connection. The original (un-normalized) error is forwarded so
 * the default handler can log the real underlying cause.
 *
 * `createErrorMiddleware()` with no options is identical to the default
 * {@link errorMiddleware} export.
 *
 * @param options - Optional {@link ErrorMiddlewareOptions}. Pass
 *   `{ exposeServerErrors: false }` to redact `statusCode >= 500` messages to
 *   the generic status text in production.
 * @example
 * app.use(createErrorMiddleware());
 * app.use(createErrorMiddleware({ exposeServerErrors: false }));
 */
export function createErrorMiddleware(
  options: ErrorMiddlewareOptions = {}
): ErrorRequestHandler {
  const exposeServerErrors = options.exposeServerErrors ?? true;

  const middleware: ErrorRequestHandler = (err, _req, res, _next) => {
    // Normalize to our ErrorHandler using common mappers. If the mapper itself
    // throws (e.g. a hostile error whose `.message` getter throws while the
    // mapper inspects it), fall back to a generic 500 so the middleware can
    // still produce a response.
    let error: ErrorHandler;
    try {
      error = handleCommonErrors(err);
    } catch {
      error = new ErrorHandler("Unexpected error occurred", 500);
    }

    // Map various known Node/Mongo/Network codes to friendlier messages.
    // Each branch forwards the original error as `cause` so structured loggers
    // (Pino, Sentry, Node 22+ console.error) can walk `err.cause` back to the
    // raw upstream error (Mongo duplicate-key, FS ENOENT, network failure, etc.).
    switch (err?.code) {
      case "ENOENT":
        error = new ErrorHandler("Resource not found", 404, { cause: err });
        break;
      case 11000: {
        const duplicateField =
          Object.keys(err.keyValue || {}).join(", ") || "unknown";
        error = new ErrorHandler(
          `Duplicate entry for field(s): ${duplicateField}`,
          400,
          { cause: err }
        );
        break;
      }
      case "EBADCSRFTOKEN":
        error = new ErrorHandler("Invalid CSRF token", 403, { cause: err });
        break;
      case "ECONNREFUSED":
      case "ECONNRESET":
      case "ETIMEDOUT":
        error = new ErrorHandler("Upstream network error", 502, { cause: err });
        break;
      default:
        break;
    }

    if (res.headersSent) {
      // Per Express's documented contract, when the response has already been
      // partially written we must delegate to the default error handler so it
      // can finalize/close the connection. Forward the *original* error so the
      // built-in handler logs the real cause, not our normalized facade.
      if (typeof _next === "function") {
        return _next(err);
      }
      // Defensive fallback: if a caller passed something other than a function
      // for next (unusual outside of tests), end the response so we don't hang.
      try {
        res.end();
      } catch {
        /* swallow */
      }
      return;
    }

    // Safely derive the response strings; never let a hostile getter escape.
    const safeMessage = safeReadString(
      () => error.message,
      "Error message unavailable"
    );
    const safeStatusText = (() => {
      try {
        return error.statusText;
      } catch {
        /* istanbul ignore next -- defensive: `statusText` on ErrorHandler is
         * a plain instance property assigned in the constructor, so reading
         * it never throws. Mirrors the message guard above for symmetry. */
        return undefined;
      }
    })();

    const isProd = process.env.NODE_ENV === "production";

    // Opt-in server-error hardening (CWE-209). When `exposeServerErrors` is
    // false, redact the resolved message for `statusCode >= 500` responses in
    // production, substituting the generic status text so internal details
    // (DSNs, stack-derived strings, upstream payloads) are not leaked to the
    // client. The original error is still reachable to structured loggers via
    // `err.cause`. Client errors (4xx) and non-production responses are
    // unaffected, and the default (`exposeServerErrors: true`) skips this
    // block entirely — preserving the historical zero-config behavior
    // byte-for-byte.
    let responseMessage = safeMessage;
    if (!exposeServerErrors && isProd && error.statusCode >= 500) {
      /* istanbul ignore next -- defensive: the `?? "Internal Server Error"`
       * fallback is unreachable here. We only enter this block when
       * `error.statusCode >= 500`, and ErrorHandler normalizes every unknown
       * code to 500, so `error.statusText` (and thus `safeStatusText`) always
       * resolves to a known string from the errorCodes map. The nullish
       * fallback is belt-and-braces against a future ErrorHandler subclass
       * that could leave `statusText` undefined. */
      responseMessage = safeStatusText ?? "Internal Server Error";
    }

    const payload: ErrorPayload = {
      success: false,
      message: responseMessage,
      statusCode: error.statusCode,
      statusText: safeStatusText,
    };

    if (!isProd) {
      let safeStack: string | undefined;
      try {
        const raw = err?.stack;
        if (raw !== undefined && raw !== null) {
          safeStack = String(raw);
        }
      } catch {
        safeStack = "Stack trace unavailable";
      }
      if (typeof safeStack === "string") {
        if (safeStack.length > MAX_STACK_LENGTH) {
          safeStack =
            safeStack.slice(0, MAX_STACK_LENGTH) + "\n... [stack truncated]";
        }
        payload.stack = safeStack;
      }
    }

    // Send the response. Guard against res.json throwing (monkey-patched res,
    // payload that fails to serialize, etc.) by retrying with a sanitized
    // payload, and finally falling back to plain text.
    try {
      res.status(error.statusCode).json(payload);
    } catch {
      try {
        const sanitized = JSON.parse(
          JSON.stringify(payload, createSafeReplacer())
        );
        res.status(error.statusCode).json(sanitized);
      } catch {
        try {
          /* istanbul ignore next -- defensive: `safeStatusText` is always
           * a non-empty string here because ErrorHandler always resolves a
           * known statusText from the errorCodes map (unknown codes are
           * normalized to 500 → "Internal Server Error"). */
          const fallbackText = safeStatusText || "Internal Server Error";
          res
            .status(error.statusCode)
            .type("text/plain")
            .send(fallbackText);
        } catch {
          /* nothing more we can do */
        }
      }
    }
  };

  return middleware;
}

/**
 * Express middleware for handling errors. This is the zero-config form,
 * exactly equivalent to `createErrorMiddleware()` — see
 * {@link createErrorMiddleware} for the configurable factory (e.g. the opt-in
 * `exposeServerErrors` response hardening).
 *
 * Must be registered as the **last** middleware in the Express app.
 *
 * @example
 * app.use(errorMiddleware);
 */
const errorMiddleware: ErrorRequestHandler = createErrorMiddleware();

export default errorMiddleware;
