# @hiprax/errors

[![npm version](https://img.shields.io/npm/v/@hiprax/errors)](https://www.npmjs.com/package/@hiprax/errors)
[![license](https://img.shields.io/npm/l/@hiprax/errors)](./LICENSE)

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
new ErrorHandler(message?: string, statusCode?: number)
```

Custom `Error` subclass with HTTP semantics.

| Parameter    | Default                                        | Description                                    |
|--------------|------------------------------------------------|------------------------------------------------|
| `message`    | `"Something went wrong! Please try again"`     | Error message                                  |
| `statusCode` | `500`                                          | HTTP status code (unknown codes normalize to 500) |

The instance exposes `.statusCode` and `.statusText` (resolved from the built-in status code map).

```ts
import { ErrorHandler } from "@hiprax/errors";

throw new ErrorHandler("Not allowed", 403);
// => { message: "Not allowed", statusCode: 403, statusText: "Forbidden" }
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

3. Checks `res.headersSent` to avoid double responses
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

> `stack` is only included when `NODE_ENV !== "production"`.

```ts
app.use(errorMiddleware);
```

---

### `handleCommonErrors`

```ts
handleCommonErrors(err: any): ErrorHandler
```

Maps common library/framework errors to `ErrorHandler` instances by `err.name`:

| `err.name`           | Status | Behavior                                           |
|----------------------|--------|----------------------------------------------------|
| `CastError`          | 400    | Includes `err.path` in message (Mongoose)          |
| `ValidationError`    | 400    | Joins all `err.errors[*].message` (Mongoose)       |
| `JsonWebTokenError`  | 401    | Fixed JWT invalid/expired message                  |
| `TokenExpiredError`  | 401    | Fixed JWT invalid/expired message                  |
| `AxiosError`         | 502    | External service communication error               |
| `SyntaxError`        | 400    | Malformed JSON or invalid syntax                   |
| `ZodError`           | 400    | Joins `err.issues[*].message` (Zod)               |
| _(default)_          | `err.statusCode` or 500 | Passes through `err.message` if present |

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

// Class decorator
@catchAsync
class UserController {
  async getUser(req: Request, res: Response) {
    res.json({ id: req.params.id });
  }
}
```

---

### `httpErrors`

```ts
import { httpErrors } from "@hiprax/errors";
```

Namespaced factory functions that return `ErrorHandler` instances. Each accepts an optional `message` override.

| Factory                | Code | Default Message          |
|------------------------|------|--------------------------|
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
| `httpErrors.badGateway`           | 502  | Bad gateway              |
| `httpErrors.serviceUnavailable`   | 503  | Service unavailable      |
| `httpErrors.gatewayTimeout`       | 504  | Gateway timeout          |

```ts
throw httpErrors.notFound();                    // "Not found" (404)
throw httpErrors.forbidden("Admins only");      // "Admins only" (403)
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

## License

MIT &copy; Hiprax
