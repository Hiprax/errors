# Security Policy

## Supported Versions

`@hiprax/errors` follows semantic versioning. Security fixes are applied to the
latest minor release line on the `main` branch. Older minor lines are not
patched separately; please upgrade to the latest version published on
[npm](https://www.npmjs.com/package/@hiprax/errors).

| Version | Supported          |
| ------- | ------------------ |
| Latest minor on `main` | :white_check_mark: |
| Older minors           | :x:                |

## Reporting a Vulnerability

If you believe you have found a security vulnerability in `@hiprax/errors`,
please report it privately. **Do not open a public GitHub issue** for security
problems.

You can choose either of the following channels:

1. **GitHub private vulnerability report (preferred):**
   <https://github.com/Hiprax/errors/security/advisories/new>

   This opens a private advisory visible only to maintainers. GitHub will
   notify the reporter as the report is triaged.

2. **Email:** `sajadkhmz@gmail.com` with the subject `SECURITY: @hiprax/errors`.

When reporting, please include as much of the following as you can:

- A description of the issue and its impact.
- The affected versions of `@hiprax/errors` (and Node.js / Express versions
  used to reproduce, if relevant).
- A minimal reproduction (code snippet, repository, or steps).
- Any suggested mitigation, if known.

## What to Expect

- We aim to acknowledge new reports within **5 business days**.
- We will work with the reporter on a timeline for the fix and coordinated
  disclosure.
- Once a fix is ready, we publish a patched version to npm and a GitHub
  Security Advisory crediting the reporter (unless they ask to remain
  anonymous).

## Out of Scope

The following are not considered vulnerabilities for this package:

- Misconfiguration in a consumer's Express application (for example, failing
  to register `errorMiddleware` last, or leaking sensitive data through a
  custom `cause` in production logs).
- Denial of service caused by extremely large payloads passed into helpers;
  upstream input validation is the consumer's responsibility.
- Issues that require modifying the package's internal exports at runtime.

Thank you for helping keep `@hiprax/errors` and its users safe.
