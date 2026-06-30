# Changelog

## [Unreleased]

## [0.6.0] - 2026-06-30

### Added

- `createErrorMiddleware(options)` factory and the `ErrorMiddlewareOptions` type. The opt-in `exposeServerErrors` flag (default `true`) redacts server-error (`statusCode >= 500`) messages to the generic status text **in production only** when set to `false`, so internal details are not leaked to clients (CWE-209). The default preserves the historical, zero-config `errorMiddleware` behavior byte-for-byte; client errors (4xx) and non-production responses are never redacted, and the original error stays reachable via `err.cause` (`src/errorMiddleware.ts`, `src/index.ts`)
- `"./package.json"` subpath is now resolvable via the `exports` map, so `require.resolve("@hiprax/errors/package.json")` (and the ESM equivalent) no longer throw `ERR_PACKAGE_PATH_NOT_EXPORTED` under strict exports encapsulation. Purely additive — the `"."` main-entry type resolution is unchanged (`package.json`)

### Fixed

- `handleCommonErrors` `ValidationError` and `ZodError` branches no longer throw a `TypeError` on a null/non-object sub-entry (which `errorMiddleware` previously caught and downgraded from 400 to 500). Each element is now guarded like the `AggregateError` branch, and `ZodError` gained an `Array.isArray` container guard so a non-array `issues` value can no longer throw (`src/handleCommonErrors.ts`)

### Tests

- Precedence tests pinning that the `errorMiddleware` `err.code` switch wins over `handleCommonErrors` when an error matches both stages — `AxiosError` + `ECONNREFUSED` → 502 "Upstream network error" (message level) and `CastError` + `ENOENT` → 404 "Resource not found" (status level); `createErrorMiddleware` redaction unit + integration tests; null/non-object/non-array sub-entry validation tests; and a package-exports test reading `package.json` from disk (`tests/errorMiddleware.test.ts`, `tests/errorMiddleware.integration.test.ts`, `tests/handleCommonErrors.test.ts`, `tests/packageExports.test.ts`)

### Docs

- Corrected the `CLAUDE.md` `handleCommonErrors` AxiosError bullet (message source is `err.message` + `err.response.statusText`; `err.response.data` is deliberately not read) and the AggregateError separator (`; `, not `, `) to match the implementation; documented the `createErrorMiddleware` factory, the `exposeServerErrors` option, and the `"./package.json"` export across `README.md` and `CLAUDE.md` (`CLAUDE.md`, `README.md`)

## [0.5.6] - 2026-05-12

### Removed

- Libraries.io dependency-status badge removed from the README. The package has zero runtime dependencies, so the badge surfaced devDependency churn that wasn't relevant to consumers (`README.md`)

## [0.5.5] - 2026-05-12

### Added

- Tag protection ruleset (`release-tags`) on the repository. Any tag matching `refs/tags/v*.*.*` now blocks deletion, force-push (`non_fast_forward`), and tag-update operations, so a published release tag cannot be silently rewritten to point at a different commit. Configured via the GitHub API; the canonical definition lives at `.github/rulesets/tags.json` for review and re-apply (`.github/rulesets/tags.json`)
- README now displays two additional badges alongside the existing CI / Codecov / CodeQL set: a Libraries.io dependency status badge for `@hiprax/errors` and an npm-provenance badge linking to npm's provenance docs (the release workflow already publishes with `--provenance`) (`README.md`)

### Changed

- Repository settings: `delete_branch_on_merge` and `allow_update_branch` are now enabled at the repo level. Merged PR branches are auto-deleted from the remote, and contributors can update a PR branch from the GitHub UI without dropping to the CLI when `main` has moved ahead

### Docs

- `CLAUDE.md` "CI / Workflow Conventions" section now documents the tag-protection ruleset alongside the existing branch-protection guidance, so a future contributor can re-create the ruleset from the checked-in `.github/rulesets/tags.json` without reverse-engineering the GitHub UI (`CLAUDE.md`)

## [0.5.4] - 2026-05-12

### Removed

- Dependabot is fully removed from the repository. The `.github/dependabot.yml` configuration is deleted, all open Dependabot PRs are closed, and Dependabot vulnerability alerts / automated security updates are disabled at the repo level. Action and dependency bumps will be done manually going forward (`.github/dependabot.yml`)
- OpenSSF Scorecard supply-chain analysis workflow removed (`.github/workflows/scorecard.yml`)
- OpenSSF Scorecard and OpenSSF Best Practices badges removed from the README (`README.md`)

### Docs

- `CLAUDE.md` rewritten to drop OpenSSF Scorecard references in the CI conventions, security reporting, and branch protection sections. Manual SHA-pin and least-privilege workflow practices remain as they're still sound supply-chain hygiene independent of the OpenSSF program (`CLAUDE.md`)



### Docs

- README now displays the OpenSSF Best Practices badge for project 12757 alongside the existing Scorecard badge. Earning the badge satisfies the Scorecard `CII-Best-Practices` check (`README.md`)

### Internal

- Test coverage hits **100% / 100% / 100% / 100%** (statements / branches / functions / lines) across all source files; new test count is 198 (up from 188). Codecov should now report 100% line coverage where it previously sat at ~89%.
- New tests cover: `catchAsync` ignoring a duplicate `next()` call from a buggy handler, decorating a class whose method was pre-wrapped (idempotence on individual methods), parent-walk shadow skip when the child overrides a parent method with the same name, parent-walk shadow reusing a pre-wrapped parent method by reference, parent-walk skip for non-function data properties on the parent prototype, and a Proxy whose WRAPPED-symbol read throws (graceful fallback to "not yet wrapped"). New `handleCommonErrors` tests cover Axios responses with missing / empty-string / non-string `statusText`, plus an `AggregateError` whose sub-error throws on every primitive coercion (`String()` failure → empty token filtered out) (`tests/catchAsync.test.ts`, `tests/handleCommonErrors.test.ts`)
- `httpErrors.createErrorFactory` no longer carries a `?? "Error"` dead-fallback branch — the internal `defaultMessage` parameter is now required, eliminating the unreachable string literal. Public `httpErrors.*` factory shapes and behavior are unchanged (`src/httpErrors.ts`)
- `errorMiddleware`'s plain-text fallback path now stages the resolved status text in a single `const fallbackText = safeStatusText || "Internal Server Error"` so the istanbul-ignore comment can target the unreachable empty-statusText branch cleanly. No behavior change (`src/errorMiddleware.ts`)
- Defensive guards that are unreachable through the public API now carry explicit `/* istanbul ignore next|if */` annotations with rationale: `catchAsync` private helpers (`isAlreadyWrapped` null/primitive guards, `isClassConstructor` toString catch, `wrapHandler` non-function input, `wrapControllerClass` non-function and missing-prototype guards, descriptor-existence check after `getOwnPropertyNames`) and `errorMiddleware` (`safeReadString` null-value branch, `createSafeReplacer` exotic-value branches) (`src/catchAsync.ts`, `src/errorMiddleware.ts`)

## [0.5.2] - 2026-05-05

### Security

- All GitHub Actions in every workflow are now pinned to immutable commit SHAs with a trailing `# vX.Y.Z` comment (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `codecov/codecov-action`, `github/codeql-action/*`, `ossf/scorecard-action`, `softprops/action-gh-release`). Addresses the Scorecard `Pinned-Dependencies` check and prevents tag-retag supply-chain attacks (`.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/release.yml`, `.github/workflows/scorecard.yml`)
- `release.yml` no longer grants `contents: write` and `id-token: write` at the workflow level; both are scoped to the `publish` job only. Top-level token now defaults to `contents: read`. Addresses Scorecard `Token-Permissions` (`.github/workflows/release.yml`)
- Every `actions/checkout` step now passes `persist-credentials: false`, so the auth token is dropped from `.git/config` after checkout completes (`.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/release.yml`, `.github/workflows/scorecard.yml`)
- `SECURITY.md` added at repo root with private vulnerability reporting instructions (GitHub private advisory + email), supported-versions matrix, response SLA, and out-of-scope notes. Addresses Scorecard `Security-Policy` (`SECURITY.md`)
- Added explicit job-level `permissions: contents: read` to the CI test job for least-privilege defense in depth (`.github/workflows/ci.yml`)
- Scorecard workflow now also runs on `pull_request` so it can be a required status check on protected branches. PR runs skip `publish_results` and the SARIF code-scanning upload — those remain `push` / `schedule` / `branch_protection_rule` only — so the public OpenSSF database and the security tab still reflect main-branch state (`.github/workflows/scorecard.yml`)

### Internal

- Dependabot configured for npm and `github-actions` ecosystems with weekly schedule and grouped updates so dev-only patch/minor bumps land as a single PR (`.github/dependabot.yml`)
- CodeQL static analysis workflow (JavaScript/TypeScript, `security-and-quality` query suite) on push to main, on pull requests, and on a weekly schedule (`.github/workflows/codeql.yml`)
- OpenSSF Scorecard supply-chain analysis with SARIF upload to GitHub code scanning and public results publication, runs on push and weekly (`.github/workflows/scorecard.yml`)
- Release workflow now creates a GitHub Release after a successful npm publish, with the body extracted from the matching CHANGELOG section (`.github/workflows/release.yml`)
- CI now collects test coverage on every Node matrix entry and uploads `lcov.info` to Codecov from the Node 22.x leg (`jest.config.js`, `.github/workflows/ci.yml`)
- Issue and pull request templates added: bug report and feature request as YAML forms, blank issues disabled, PR checklist matching the project's pre-completion gates (`.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`)
- Added Codecov, CodeQL, and OpenSSF Scorecard badges to the README (`README.md`)

## [0.5.1] - 2026-05-04

### Internal

- Devtooling refresh. TypeScript `5.9.2` → `6.0.3`, Jest `30.2.0` → `30.3.0`, `@types/express` `5.0.3` → `5.0.6`, `ts-jest` `29.4.4` → `29.4.9`, `tsup` `8.5.0` → `8.5.1`, `eslint-config-prettier` `9.1.2` → `10.1.8`. Public API unchanged; bundle output unchanged (ESM 16.04 KB, CJS 17.18 KB, `.d.ts` 7.99 KB) (`package.json`)
- TypeScript 6 migration. Added `rootDir: "./src"` (TS6 no longer infers a common source directory when `include` is `["src"]` and ts-jest then loads `tests/`) and `ignoreDeprecations: "6.0"` (silences a TS5101 raised by tsup's DTS pass for the deprecated `baseUrl` option, the documented TS6→TS7 migration path) (`tsconfig.json`)
- `eslint-config-prettier` v10 migration. Switched the import from `"eslint-config-prettier"` to `"eslint-config-prettier/flat"`, the new flat-config entry that adds a `name` property for config-inspector. Functionally equivalent to the previous import (`eslint.config.mjs`)
- ESLint held at v9 (latest is v10). v10 requires Node `^20.19.0 || ^22.13.0 || >=24` and would drop the Node 18.x leg of the CI matrix and conflict with the package's `engines.node: ">=18.12"`. Hold reviewed when Node 18 support is intentionally dropped
- All transitive dev-only audit findings resolved via `npm audit fix` (minimatch, path-to-regexp, picomatch, rollup); production dependency tree continues to report 0 vulnerabilities
- All five checks green: `npm run build`, `npm run check-types-pack` (4/4 quadrants 🟢), `npm run type-check`, `npm run lint`, `npm test` (188/188 passing)

## [0.5.0] - 2026-05-04

### Added

- Every `handleCommonErrors` mapper branch now forwards the original error as `cause` on the returned `ErrorHandler`. Previously only the `AggregateError` branch did this. Structured loggers (Pino's `err` serializer, Sentry, Node 22+ `console.error`, OpenTelemetry exception attributes) can now walk `err.cause` from a normalized `ErrorHandler` back to the raw upstream error to inspect per-library detail (Mongoose `errors[*].value`, Axios `response.data`, Zod `issues[*].path`, JWT subclass, etc.) (`src/handleCommonErrors.ts`)
- Every `errorMiddleware` `err.code` branch (`ENOENT`, MongoDB `11000`, `EBADCSRFTOKEN`, `ECONNREFUSED` / `ECONNRESET` / `ETIMEDOUT`) now forwards the original error as `cause` on the constructed `ErrorHandler`, matching the mapper's behavior. The middleware's JSON response body intentionally still omits `cause` to avoid leaking upstream payloads (`src/errorMiddleware.ts`)
- `check-types-pack` npm script (`attw --pack .`) and a CI step that fails the build on any non-clean row, locking the dual-package types contract against future regressions (`package.json`, `.github/workflows/ci.yml`)
- `@arethetypeswrong/cli` added as a devDependency (`package.json`)

### Changed

- `package.json` `exports` map restructured so each `import` / `require` condition has a nested `types` first (`.d.mts` for ESM, `.d.ts` for CJS). Resolves the "Masquerading as CJS" warning under TypeScript `moduleResolution: NodeNext`, so strict ESM consumers get correctly-shaped types from `./dist/index.d.mts` while CJS consumers continue to resolve `./dist/index.d.ts`. Top-level `main` / `module` / `types` fields preserved for legacy resolvers — fully backward compatible (`package.json`)
- README documents the cause chain across `handleCommonErrors` and the `errorMiddleware` `err.code` mappings (`README.md`)

### Internal

- Total test count grew from 172 to 188 (+16) covering `cause` propagation across every `handleCommonErrors` branch (CastError, ValidationError, all three JWT subclasses, AxiosError on both upstream-status and 502-fallback paths, SyntaxError, ZodError, default fallback) and every `errorMiddleware` `err.code` branch, plus an end-to-end integration assertion that `cause` survives through Express to the headers-sent delegation path

## [0.4.0] - 2026-05-04

### Added

- `httpErrors.notImplemented()` factory (501 "Not implemented") closes the gap next to `internalServerError`/`badGateway` for stub endpoints and unimplemented routes (`src/httpErrors.ts`)
- `ErrorHandlerOptions` type is now re-exported from the package entry point — `import type { ErrorHandlerOptions } from "@hiprax/errors"` — so consumers wrapping `new ErrorHandler(...)` or building factories no longer need to redeclare the interface (`src/index.ts`)
- `handleCommonErrors` now maps the third `jsonwebtoken` subclass, `NotBeforeError` (token consumed before its `nbf` "not before" timestamp), to 401. Previously it fell through to the default case and surfaced as 500 (`src/handleCommonErrors.ts`)

### Changed

- Published bundle is no longer minified (`tsup.config.ts`). Variable names and line breaks are preserved to keep step-into debugging usable for consumers normalizing errors through this library. New sizes: ESM 15.73 KB, CJS 16.87 KB, `.d.ts` 7.99 KB. Source maps still ship.
- `package.json` `keywords` expanded from 4 generic tags to 16 specific ones (`error-handling`, `http-errors`, `mongoose`, `zod`, `jwt`, `axios`, `aggregate-error`, etc.) so the package surfaces for the searches that actually match its features
- README documents the third `options` parameter on `ErrorHandler` and every `httpErrors.*` factory (preserving the underlying error via `cause`), the new `notImplemented` factory row, the `NotBeforeError` JWT row, and the `AggregateError` mapper row (`README.md`)

### Fixed

- `.npmignore` reference updated from the never-existing `eslint.config.ts` to the glob `eslint.config.*`, matching the actual `eslint.config.mjs` file. Cosmetic — the positive `files: ["dist"]` allowlist already controlled packaging — but removes drift that would mislead future maintainers (`.npmignore`)

### Internal

- Total test count grew from 168 to 172 (+4) covering the new `notImplemented` factory (default + custom message + cause forwarding) and the `NotBeforeError` JWT mapping

## [0.3.0] - 2026-05-04

### Added

- `ErrorHandler` constructor now accepts an `options` bag with `cause` to carry an underlying error per the ES2022 `Error` cause spec: `new ErrorHandler(message, statusCode, { cause: originalErr })` (`src/ErrorHandler.ts`)
- All `httpErrors` factories now accept `(message?, options?)` and forward `cause` to the produced `ErrorHandler`; the `ErrorFactory` type was widened to match (`src/httpErrors.ts`)
- `ErrorPayload` interface describing the JSON body shape returned by `errorMiddleware`, exported from the package entry for consumers that type their fetch wrappers and error parsers (`src/errorMiddleware.ts`, `src/index.ts`)
- `ErrorFactory` type is now re-exported from the package entry — `import type { ErrorFactory } from "@hiprax/errors"` (`src/index.ts`)
- `handleCommonErrors` now maps `AggregateError`: joins sub-error messages with `, ` and attaches the original via `cause`. Falls back to "Multiple errors occurred" when `errors` is empty. 500 status by default (`src/handleCommonErrors.ts`)
- `catchAsync` now supports the TypeScript 5.x stage-3 ECMAScript decorator signature alongside the legacy/experimental signature; the same `@catchAsync class Foo {}` source compiles cleanly under either mode (`src/catchAsync.ts`)
- `lint`, `lint:fix`, and `type-check` npm scripts plus an ESLint v9 flat config (`eslint.config.mjs`) using `typescript-eslint` v8 and `eslint-config-prettier` (`package.json`, `eslint.config.mjs`)
- `default` fallback condition added to the `package.json` `exports` map for better compatibility with bundlers and resolvers that expect it (`package.json`)
- GitHub Actions CI workflow with a Node 18/20/22/24 matrix running `type-check`, `lint`, `test`, and `build` on push and pull request (`.github/workflows/ci.yml`)
- `tests/errorMiddleware.integration.test.ts` — 12 supertest scenarios exercising the full normalization pipeline end-to-end through a real Express app
- README "Caveats" section under `catchAsync` documenting decorator setup, the manual-call footgun (calling a wrapped method without `next` swallows errors), idempotence, inheritance isolation, and the arity contract (`README.md`)

### Fixed

- **Critical**: `catchAsync` class decorator no longer mutates parent-class prototypes. Inherited methods are now wrapped via shadowing on the child prototype, so a `BaseController` shared between decorated and undecorated subclasses keeps its original methods intact (`src/catchAsync.ts`)
- `errorMiddleware` is now hardened against hostile error objects: `message`, `statusText`, and `stack` are read through a `safeReadString` helper that catches throwing getters and circular references; the stack is truncated at 10 KB; `res.status().json()` failures fall back to a sanitized payload and finally to a plain-text response so the middleware never throws past Express (`src/errorMiddleware.ts`)
- `errorMiddleware` now delegates to the next error handler via `return next(err)` (forwarding the original error) when `res.headersSent` is true, matching Express's documented recommendation. Falls back to `res.end()` only when `next` is not a function (`src/errorMiddleware.ts`)
- `handleCommonErrors` now propagates `AxiosError.response.status` when it's a numeric value present in `errorCodes`, so an upstream `404` / `401` / `429` no longer collapses into a generic 502 (`src/handleCommonErrors.ts`)

### Changed

- `catchAsync` is now idempotent. A `Symbol.for("@hiprax/errors:catchAsync.wrapped")` marker on wrapped functions and decorated class constructors prevents double-wrapping when the helper is applied more than once (e.g., from a mixin or a router helper) (`src/catchAsync.ts`)
- `errorCodes` is now exported as a `ReadonlyMap<number, string>`. The exported instance still passes `instanceof Map` and supports `.has` / `.get` / iteration, but `set`, `delete`, and `clear` throw `TypeError` so a misbehaving consumer cannot silently break every `ErrorHandler` in the process (`src/errorCodes.ts`, `src/index.ts`)
- `errorMiddleware` is now typed as Express's `ErrorRequestHandler`, locking in the runtime length-4 contract Express depends on for routing and giving consumers first-class IntelliSense (`src/errorMiddleware.ts`)
- `errorMiddleware` payload is now typed as `ErrorPayload` instead of `Record<string, any>`, so a future field rename surfaces as a type error (`src/errorMiddleware.ts`)

### Internal

- Added arity-preservation tests for `catchAsync`: `length === 3` for request handlers and `length === 4` for error handlers, covering variadic and short-arity inputs as well (`tests/catchAsync.test.ts`)
- Total test count grew from 96 to 168 (+72) across new integration, idempotence, prototype-isolation, hardening, and `cause`-handling scenarios
- Iteration plan completed and removed

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
