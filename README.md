# @hiprax/errors

A small, typed, framework-agnostic error toolkit tailored for Express.js apps:

- **Custom Error class** with `statusCode` and `statusText`
- **Production-ready error middleware** for Express
- **Common error mapper** for popular libraries (JWT, Axios, validation, etc.)
- **Async wrapper/decorator** `catchAsync` for safe handlers and controllers
- **HTTP error factories** for concise and consistent error creation
- **TypeScript first** with ESM/CJS builds and `.d.ts` types

## Install

```bash
npm install @hiprax/errors
```

Requires Node >= 18.12.

### Quick start

```ts
import express from "express";
import {
  errorMiddleware,
  ErrorHandler,
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

// Always last
app.use(errorMiddleware);
```

---

## API

### `class ErrorHandler(message?: string, statusCode?: number)`

- **message**: defaults to "Something went wrong! Please try again"
- **statusCode**: defaults to 500, unknown codes normalize to 500
- `.statusCode: number` and `.statusText?: string` are set based on a predefined map

Example:

```ts
throw new ErrorHandler("Not allowed", 403);
```

### `errorMiddleware(err, req, res, next)`

Express error middleware that:

- Normalizes errors using `handleCommonErrors`
- Maps popular codes like Mongo duplicate key (`11000`), CSRF, common network codes
- Avoids writing after `headersSent`
- Returns JSON: `{ success, message, statusCode, statusText, stack? }` (stack in non-production only)

Register as the last middleware:

```ts
app.use(errorMiddleware);
```

### `handleCommonErrors(err)`

Maps common libraries/framework errors to `ErrorHandler`:

- `CastError`, `ValidationError`, `JsonWebTokenError`, `TokenExpiredError`, `AxiosError`, `SyntaxError`, `ZodError`
- Pass-throughs message/statusCode where provided, else defaults to 500

### `catchAsync(fnOrClass)`

Dual-purpose utility:

- Wrap a single handler to pass thrown/rejected errors to `next()` and prevent duplicate `next()` calls
- Use as a class decorator to wrap all prototype methods of an Express controller

```ts
router.get(
  "/posts",
  catchAsync(async (req, res) => {
    const posts = await listPosts();
    res.json(posts);
  })
);

@catchAsync
class UserController {
  async getUser(req: express.Request, res: express.Response) {
    res.json({ id: req.params.id });
  }
}
```

### HTTP error factories

Convenience helpers that return `ErrorHandler` instances with sensible defaults:

```ts
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  internalServerError,
  badGateway,
  serviceUnavailable,
  gatewayTimeout,
} from "@hiprax/errors";

throw notFound();
throw forbidden("Only admins can do that");
```

---

## TypeScript and builds

- ESM and CJS builds with an exports map
- Full type declarations
- Marked as `sideEffects: false` for optimal tree-shaking

## Testing

This package ships with Jest tests exercising all modules. To run locally:

```bash
npm test
```

## Contributing

Issues and PRs are welcome. Please include tests and keep the API surface small and focused.

## License

MIT © Hiprax
