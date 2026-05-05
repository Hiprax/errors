# @hiprax/errors

[![npm version](https://img.shields.io/npm/v/@hiprax/errors)](https://www.npmjs.com/package/@hiprax/errors)
[![license](https://img.shields.io/npm/l/@hiprax/errors)](./LICENSE)
[![CI](https://github.com/Hiprax/errors/actions/workflows/ci.yml/badge.svg)](https://github.com/Hiprax/errors/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Hiprax/errors/branch/main/graph/badge.svg)](https://codecov.io/gh/Hiprax/errors)
[![CodeQL](https://github.com/Hiprax/errors/actions/workflows/codeql.yml/badge.svg)](https://github.com/Hiprax/errors/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Hiprax/errors/badge)](https://scorecard.dev/viewer/?uri=github.com/Hiprax/errors)

A small, typed error toolkit for Express.js apps. Zero runtime dependencies.

- **Custom Error class** with `statusCode` and `statusText`
- **Production-ready error middleware** for Express
- **Common error mapper** for popular libraries (Mongoose, JWT, Axios, Zod, etc.)
- **Async wrapper & class decorator** `catchAsync` for safe handlers and controllers
- **HTTP error factories** for concise, consistent error creation
- **TypeScript first** with ESM + CJS builds and `.d.ts` types

## Install

```bash
npm install @hiprax/errors
```

Requires **Node >= 18.12** and **Express >= 4.x** (peer dependency).

## Quick Start

```ts
import express from "express";
import {
  errorMiddleware,
  catchAsync,
  httpErrors,
} from "@hiprax/errors";

const app = express();

app.get(
  "/users/:id",
  catchAsync(async (req, res) => {
    if (req.params.id === "0") {
      throw httpErrors.notFound("User not found");
    }
    res.json({ id: req.params.id });
  })
);

// Always register last
app.use(errorMiddleware);
```

---

## API

### `ErrorHandler`

```ts
new ErrorHandler(message?: string, statusCode?: number, options?: { cause?: unknown })
```

Custom `Error` subclass with HTTP semantics.

| Parameter    | Default                                        | Description                                                                                                |
|--------------|------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `message`    | `"Something went wrong! Please try again"`     | Error message                                                                                              |
| `statusCode` | `500`                                          | HTTP status code (unknown codes normalize to 500)                                                          |
| `options`    | `undefined`                                    | ES2022 options bag — pass `{ cause: originalError }` to preserve the underlying error on `this.cause`.     |

The instance exposes `.statusCode` and `.statusText` (resolved from the built-in status code map).

```ts
import { ErrorHandler } from "@hiprax/errors";

throw new ErrorHandler("Not allowed", 403);
// => { message: "Not allowed", statusCode: 403, statusText: "Forbidden" }

// Preserve the underlying error for richer logs / chained debugging
try {
  await db.query("SELECT 1");
} catch (err) {
  throw new ErrorHandler("Lookup failed", 500, { cause: err });
  // => err.cause === the original db error
}
```

---

### `errorMiddleware`

```ts
errorMiddleware(err, req, res, next)
```

Express error middleware. Register it as the **last** middleware in your app.

**Processing pipeline:**

1. Normalizes the error via `handleCommonErrors` (by `err.name`)
2. Maps well-known `err.code` values:

   | `err.code`             | Status | Message                               |
   |------------------------|--------|---------------------------------------|
   | `"ENOENT"`             | 404    | Resource not found                    |
   | `11000` (Mongo dup key)| 400    | Duplicate entry for field(s): ...     |
   | `"EBADCSRFTOKEN"`      | 403    | Invalid CSRF token                    |
   | `"ECONNREFUSED"` / `"ECONNRESET"` / `"ETIMEDOUT"` | 502 | Upstream network error |

3. Checks `res.headersSent` and, if so, delegates to Express's default error handler (`next(err)`) so the in-flight response is finalized cleanly.
4. Responds with JSON:

```json
{
  "success": false,
  "message": "...",
  "statusCode": 400,
  "statusText": "Bad Request",
  "stack": "..."
}
```

> `stack` is only included when `NODE_ENV !== "production"`. When present, it is truncated to a bounded length so a pathologically large trace cannot bloat the response.

**Hardening behavior.** The middleware is defensive against hostile or malformed errors:

- If `err.message` or `err.stack` is backed by a getter that throws, the middleware substitutes a safe fallback string instead of crashing.
- If the JSON payload fails to serialize (circular references, `BigInt`, functions, symbols, etc.), the middleware retries with a sanitizing replacer that strips/normalizes the offending values.
- If JSON serialization fails even after sanitization, it falls back to a plain-text response (`text/plain`) using the resolved status text so the client always receives *some* response.
- If the mapper itself throws while normalizing the error, the middleware degrades to a generic 500 rather than letting the throw escape.

```ts
app.use(errorMiddleware);
```

---

### `handleCommonErrors`

```ts
handleCommonErrors(err: any): ErrorHandler
```

Maps common library/framework errors to `ErrorHandler` instances by `err.name`:

| `err.name`           | Status                  | Behavior                                                                                                           |
|----------------------|-------------------------|--------------------------------------------------------------------------------------------------------------------|
| `CastError`          | 400                     | Includes `err.path` in message (Mongoose)                                                                          |
| `ValidationError`    | 400                     | Joins all `err.errors[*].message` (Mongoose)                                                                       |
| `JsonWebTokenError`  | 401                     | Fixed JWT invalid/expired message                                                                                  |
| `TokenExpiredError`  | 401                     | Fixed JWT invalid/expired message                                                                                  |
| `NotBeforeError`     | 401                     | JWT used before its `nbf` ("not before") timestamp; same message as the other JWT cases                            |
| `AxiosError`         | upstream status, else 502 | When `err.response.status` is a known HTTP error code, that status passes through (e.g. upstream 404 → 404). Otherwise falls back to 502 "Bad gateway". |
| `SyntaxError`        | 400                     | Malformed JSON or invalid syntax                                                                                   |
| `AggregateError`     | 500                     | Joins `err.errors[*].message` with `; `; original `AggregateError` attached as `cause` for full chain traversal     |
| `ZodError`           | 400                     | Joins `err.issues[*].message` (Zod)                                                                                |
| _(default)_          | `err.statusCode` or 500 | Passes through `err.message` if present                                                                            |

> **Cause chain.** Every mapper branch above (and every `err.code` mapping in `errorMiddleware` — `ENOENT`, `11000`, `EBADCSRFTOKEN`, `ECONNREFUSED` / `ECONNRESET` / `ETIMEDOUT`) preserves the original error on `.cause`. Structured loggers (Pino's `err` serializer, Sentry, Node 22+ `console.error`, OpenTelemetry's `exception.cause`) walk this chain to surface the underlying library-specific error (e.g. the original Mongoose validation, Axios `response.data`, Zod `issues[*].path`). The JSON response body intentionally omits `cause` to avoid leaking upstream payloads — read it from the live `Error` instance via your logger of choice.

---

### `catchAsync`

```ts
catchAsync(fn): wrappedFn
catchAsync(Class): Class        // as decorator
```

Dual-purpose utility:

- **Function wrapper** — wraps a single handler so thrown/rejected errors are forwarded to `next()`. Prevents duplicate `next()` calls. Preserves function arity and name for correct Express routing.
- **Class decorator** — wraps all prototype methods (including inherited) of an Express controller class.

```ts
// Function wrapper
router.get(
  "/posts",
  catchAsync(async (req, res) => {
    const posts = await listPosts();
    res.json(posts);
  })
);

// Class decorator (works with both legacy and stage-3 decorators)
@catchAsync
class UserController {
  async getUser(req: Request, res: Response) {
    res.json({ id: req.params.id });
  }
}

// Manual application is also supported and behaves identically
class OrderController {
  async list(req: Request, res: Response) {
    res.json(await loadOrders());
  }
}
const WrappedOrderController = catchAsync(OrderController);
```

#### Decorator setup

`catchAsync` supports **both** decorator implementations and you can pick whichever
your project uses:

- **Stage-3 (TC39) decorators** — TypeScript 5.0+ default. No special flag needed.
  Works out of the box when `experimentalDecorators` is `false` or omitted.
- **Legacy / experimental decorators** — set in `tsconfig.json`:

  ```jsonc
  {
    "compilerOptions": {
      "experimentalDecorators": true,
      "emitDecoratorMetadata": false
    }
  }
  ```

Both forms wrap every method on the class prototype (and inherited ones, shadowed
on the decorated subclass without mutating parents).

#### Caveats

- **Manual call footgun.** You can write `const Wrapped = catchAsync(MyClass)` and
  export `Wrapped` instead of decorating in place. This works and is
  **idempotent** — wrapping an already-wrapped class or function returns the
  same value, so `catchAsync(catchAsync(fn)) === catchAsync(fn)` and re-applying
  the decorator does not double-wrap methods.

- **Manual invocation outside Express returns `undefined`.** Wrapped handlers rely
  on the last positional argument being Express's `next` callback. If you call a
  wrapped controller method directly from your own code (e.g. in a unit test or
  from a script) without supplying a `next`-shaped function, thrown errors are
  forwarded to a no-op and silently swallowed. For unit tests, either pass a
  `jest.fn()` as `next` or call the original undecorated function.

- **Inheritance is isolated.** Decorating a subclass shadows inherited methods on
  the subclass's own prototype — it does **not** mutate the parent class. Sibling
  subclasses and direct uses of the parent class continue to use the original
  unwrapped methods.

- **Express's arity contract.** Express identifies error-handling middleware by
  function arity: `length === 4` means error handler, `length === 3` means
  request handler. `catchAsync` preserves the original arity (3 vs 4), so
  wrapping `(err, req, res, next) => ...` still registers correctly via
  `app.use(catchAsync(myErrorHandler))`. Do not strip parameters.

---

### `httpErrors`

```ts
import { httpErrors } from "@hiprax/errors";
```

Namespaced factory functions that return `ErrorHandler` instances. Each factory has the signature `(message?: string, options?: { cause?: unknown }) => ErrorHandler`, so you can override the default message and/or attach an underlying `cause`.

| Factory                           | Code | Default Message          |
|-----------------------------------|------|--------------------------|
| `httpErrors.badRequest`           | 400  | Bad request              |
| `httpErrors.unauthorized`         | 401  | Unauthorized             |
| `httpErrors.forbidden`            | 403  | Forbidden                |
| `httpErrors.notFound`             | 404  | Not found                |
| `httpErrors.methodNotAllowed`     | 405  | Method not allowed       |
| `httpErrors.requestTimeout`       | 408  | Request timeout          |
| `httpErrors.conflict`             | 409  | Conflict                 |
| `httpErrors.gone`                 | 410  | Gone                     |
| `httpErrors.payloadTooLarge`      | 413  | Payload too large        |
| `httpErrors.unsupportedMediaType` | 415  | Unsupported media type   |
| `httpErrors.unprocessableEntity`  | 422  | Unprocessable entity     |
| `httpErrors.tooManyRequests`      | 429  | Too many requests        |
| `httpErrors.internalServerError`  | 500  | Internal server error    |
| `httpErrors.notImplemented`       | 501  | Not implemented          |
| `httpErrors.badGateway`           | 502  | Bad gateway              |
| `httpErrors.serviceUnavailable`   | 503  | Service unavailable      |
| `httpErrors.gatewayTimeout`       | 504  | Gateway timeout          |

```ts
throw httpErrors.notFound();                          // "Not found" (404)
throw httpErrors.forbidden("Admins only");            // "Admins only" (403)
throw httpErrors.conflict("Email taken", { cause: dbErr }); // 409, cause preserved
```

---

### `errorCodes`

```ts
import { errorCodes } from "@hiprax/errors";
```

A `Map<number, string>` of all standard HTTP 4xx/5xx status codes and their text descriptions. Used internally by `ErrorHandler` to validate codes and resolve `statusText`. Exported for advanced use cases (e.g., custom middleware or logging).

```ts
errorCodes.get(404); // "Not Found"
errorCodes.get(418); // "I'm a teapot"
```

---

## Exported types

The package re-exports the following types from its entry point so consumers can statically type wrappers, response parsers, and custom factories without redeclaring them locally:

| Type                  | Source module        | Purpose                                                                                                  |
|-----------------------|----------------------|----------------------------------------------------------------------------------------------------------|
| `ErrorHandler`        | `./ErrorHandler`     | The custom `Error` subclass itself (also usable as a value via `import { ErrorHandler }`).               |
| `ErrorHandlerOptions` | `./ErrorHandler`     | Options bag for the `ErrorHandler` constructor — currently `{ cause?: unknown }`, mirrors ES2022.        |
| `ErrorPayload`        | `./errorMiddleware`  | The JSON shape produced by `errorMiddleware` (`{ success: false, message, statusCode, statusText, stack? }`). |
| `ErrorFactory`        | `./httpErrors`       | The signature shared by every `httpErrors.*` factory: `(message?, options?) => ErrorHandler`.            |

```ts
import {
  ErrorHandler,
  type ErrorHandlerOptions,
  type ErrorPayload,
  type ErrorFactory,
} from "@hiprax/errors";

// Build your own factory with the same signature shape
const teapot: ErrorFactory = (message = "I'm a teapot", options) =>
  new ErrorHandler(message, 418, options);

// Type a fetch wrapper response
async function call(url: string): Promise<unknown | ErrorPayload> {
  const r = await fetch(url);
  return r.json();
}
```

---

## TypeScript & Builds

- ESM (`.mjs`) and CJS (`.js`) builds via an `exports` map
- Full `.d.ts` type declarations
- `sideEffects: false` for optimal tree-shaking

## Testing

```bash
npm test
```

Runs the Jest test suite covering all modules.

## Contributing

Issues and PRs are welcome. Please include tests and keep the API surface small and focused.

## Security

Security vulnerabilities should be reported privately via [GitHub private advisories](https://github.com/Hiprax/errors/security/advisories/new) or by email — see [`SECURITY.md`](./SECURITY.md) for the full policy, supported versions, and response timeline. Please do not open public GitHub issues for security problems.

## License

MIT &copy; Hiprax
