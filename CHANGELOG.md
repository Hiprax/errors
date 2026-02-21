# Changelog

## [0.2.2] - 2026-02-21

### Added

- Comprehensive test coverage improvements across all modules (`tests/`)
- Tests for `catchAsync`: successful sync/async handler paths, TypeError on invalid input, sync non-Error throw wrapping, handler invoked without next function, class decorator skipping getter properties, default "handler" name for anonymous functions, sync duplicate-next guard (`tests/catchAsync.test.ts`)
- Tests for `errorMiddleware`: ENOENT error code mapping, production/non-production stack trace inclusion, `res.end()` throwing when `headersSent`, full payload structure verification (`tests/errorMiddleware.test.ts`)
- Tests for `handleCommonErrors`: null/undefined/string/number inputs, ZodError with empty and missing issues, default case edge cases for non-string message, empty string message, non-number statusCode (`tests/handleCommonErrors.test.ts`)
- Tests for `httpErrors`: all factory default messages, instanceof checks, custom message overrides (`tests/httpErrors.test.ts`)
- Tests for `ErrorHandler`: instanceof checks, captureStackTrace unavailability, statusText for various status codes (`tests/ErrorHandler.test.ts`)

### Improved

- Strengthened existing test assertions: `headersSent` test now verifies no JSON body is sent, payload structure test verifies exact `statusText` value
- Renamed misleading test descriptions for clarity (circular dependencies → wrapped methods without next)

## [0.2.0] - 2026-02-21

### Fixed

- **Critical**: `catchAsync` now correctly wraps regular named functions instead of silently treating them as class decorators (`src/catchAsync.ts`)
- `handleCommonErrors` no longer crashes when a `ValidationError` has no `errors` property (`src/handleCommonErrors.ts`)
- JWT errors (`JsonWebTokenError`, `TokenExpiredError`) now correctly return 401 instead of 400 per RFC 6750 (`src/handleCommonErrors.ts`)
- `ErrorHandler` now sets `this.name = 'ErrorHandler'` for proper identification in logs and switch statements (`src/ErrorHandler.ts`)
- `ErrorHandler` now calls `Error.captureStackTrace` for cleaner stack traces in V8 environments (`src/ErrorHandler.ts`)
- MongoDB duplicate key error with empty `keyValue` now produces `"unknown"` instead of an empty string (`src/errorMiddleware.ts`)
- `catchAsync` property copy now skips `prototype`, `arguments`, and `caller` to avoid strict-mode issues (`src/catchAsync.ts`)

### Added

- New `httpErrors` factories: `methodNotAllowed` (405), `requestTimeout` (408), `gone` (410), `payloadTooLarge` (413), `unsupportedMediaType` (415), `unprocessableEntity` (422) (`src/httpErrors.ts`)
- Tests for all new functionality and bug fixes (`tests/`)

### Removed

- Unused `@types/mocha` from devDependencies (`package.json`)
