import { handleCommonErrors } from "../src";

describe("handleCommonErrors", () => {
  it("maps CastError to 400 with path", () => {
    const err = handleCommonErrors({ name: "CastError", path: "id" });
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("id");
  });

  it("maps ValidationError and joins messages", () => {
    const err = handleCommonErrors({
      name: "ValidationError",
      errors: { a: { message: "A" }, b: { message: "B" } },
    });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("A, B");
  });

  it("maps JWT related errors to 401", () => {
    expect(handleCommonErrors({ name: "JsonWebTokenError" }).statusCode).toBe(
      401
    );
    expect(handleCommonErrors({ name: "TokenExpiredError" }).statusCode).toBe(
      401
    );
    expect(handleCommonErrors({ name: "NotBeforeError" }).statusCode).toBe(401);
  });

  it("maps NotBeforeError to 401 with the JWT message", () => {
    // jsonwebtoken throws `NotBeforeError` when the token's `nbf` claim has
    // not yet elapsed. It should map to 401 alongside the other JWT errors,
    // not fall through to the generic 500 default.
    const err = handleCommonErrors({
      name: "NotBeforeError",
      message: "jwt not active",
    });
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe(
      "JSON Web Token is invalid or expired. Please try again"
    );
  });

  it("handles ValidationError with missing errors property", () => {
    const err = handleCommonErrors({ name: "ValidationError" });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Validation error");
  });

  it("handles ValidationError with null errors property", () => {
    const err = handleCommonErrors({ name: "ValidationError", errors: null });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Validation error");
  });

  it("maps AxiosError to 502", () => {
    const err = handleCommonErrors({ name: "AxiosError" });
    expect(err.statusCode).toBe(502);
  });

  it("maps AxiosError with upstream 404 response to 404", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Request failed with status code 404",
      response: { status: 404, statusText: "Not Found" },
    });
    expect(err.statusCode).toBe(404);
    expect(err.statusText).toBe("Not Found");
    expect(err.message).toContain("Request failed with status code 404");
  });

  it("maps AxiosError with upstream 503 response to 503", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Request failed with status code 503",
      response: { status: 503, statusText: "Service Unavailable" },
    });
    expect(err.statusCode).toBe(503);
    expect(err.statusText).toBe("Service Unavailable");
  });

  it("falls back to 502 for AxiosError with non-error upstream status (e.g., 200)", () => {
    // 200 is not in `errorCodes` (it tracks 4xx/5xx only), so we must fall
    // back to the historical 502 behavior rather than propagating a success
    // status as the response code.
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Some weird axios failure",
      response: { status: 200, statusText: "OK" },
    });
    expect(err.statusCode).toBe(502);
    expect(err.message).toBe("Error communicating with an external service");
  });

  it("falls back to 502 for AxiosError with no response object", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Network Error",
    });
    expect(err.statusCode).toBe(502);
    expect(err.message).toBe("Error communicating with an external service");
  });

  it("falls back to 502 for AxiosError with non-numeric response.status", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Bad shape",
      response: { status: "404" },
    });
    expect(err.statusCode).toBe(502);
  });

  it("propagates upstream status without enrichment when response.statusText is missing", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Request failed with status code 410",
      response: { status: 410 },
    });
    expect(err.statusCode).toBe(410);
    // No "( ... )" suffix because statusText is absent.
    expect(err.message).toBe("Request failed with status code 410");
  });

  it("ignores an empty-string response.statusText when enriching the AxiosError message", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Request failed with status code 410",
      response: { status: 410, statusText: "" },
    });
    expect(err.statusCode).toBe(410);
    // Empty statusText is treated as absent — no parenthetical.
    expect(err.message).toBe("Request failed with status code 410");
  });

  it("ignores a non-string response.statusText when enriching the AxiosError message", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Request failed with status code 410",
      response: { status: 410, statusText: 410 },
    });
    expect(err.statusCode).toBe(410);
    expect(err.message).toBe("Request failed with status code 410");
  });

  it("includes upstream statusText in the message when available", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      message: "Request failed with status code 401",
      response: { status: 401, statusText: "Unauthorized" },
    });
    expect(err.statusCode).toBe(401);
    expect(err.message).toContain("Unauthorized");
  });

  it("uses fallback message for AxiosError when err.message is missing and upstream status passes through", () => {
    const err = handleCommonErrors({
      name: "AxiosError",
      response: { status: 429, statusText: "Too Many Requests" },
    });
    expect(err.statusCode).toBe(429);
    expect(err.message).toContain("Error communicating with an external service");
  });

  it("maps SyntaxError to 400", () => {
    const err = handleCommonErrors(new SyntaxError("bad"));
    expect(err.statusCode).toBe(400);
  });

  it("maps ZodError issues to 400 and joins messages", () => {
    const err = handleCommonErrors({
      name: "ZodError",
      issues: [{ message: "Oops" }, { message: "Nope" }],
    });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Oops, Nope");
  });

  it("passes through message and statusCode when provided", () => {
    const err = handleCommonErrors({ message: "Teapot", statusCode: 418 });
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe("Teapot");
  });

  it("defaults unknown errors to 500 with generic message", () => {
    const err = handleCommonErrors({});
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Unhandled server error");
  });

  it("returns 500 with generic message for null input", () => {
    const err = handleCommonErrors(null);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Unexpected error occurred");
  });

  it("returns 500 with generic message for undefined input", () => {
    const err = handleCommonErrors(undefined);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Unexpected error occurred");
  });

  it("returns 500 with generic message for string input", () => {
    const err = handleCommonErrors("error string");
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Unexpected error occurred");
  });

  it("returns 500 with generic message for number input", () => {
    const err = handleCommonErrors(42);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Unexpected error occurred");
  });

  it("handles ZodError with empty issues array", () => {
    const err = handleCommonErrors({ name: "ZodError", issues: [] });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Validation error");
  });

  it("handles ZodError with missing issues property", () => {
    const err = handleCommonErrors({ name: "ZodError" });
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Validation error");
  });

  it("defaults to 'Unhandled server error' when message is a non-string type", () => {
    const err = handleCommonErrors({ message: 123 });
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Unhandled server error");
  });

  it("defaults to 'Unhandled server error' when message is an empty string", () => {
    const err = handleCommonErrors({ message: "" });
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Unhandled server error");
  });

  it("defaults statusCode to 500 when statusCode is not a number", () => {
    const err = handleCommonErrors({ message: "some error", statusCode: "bad" });
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("some error");
  });

  describe("cause propagation (Task 2)", () => {
    // Each mapper branch in handleCommonErrors should forward the original
    // error as `.cause` so structured loggers (Pino, Sentry, Node 22+
    // console.error) that walk the cause chain can recover the underlying
    // library-specific error shape.
    it("forwards cause for CastError", () => {
      const original = { name: "CastError", path: "id" };
      const err = handleCommonErrors(original);
      expect(err.cause).toBe(original);
    });

    it("forwards cause for ValidationError", () => {
      const original = {
        name: "ValidationError",
        errors: { a: { message: "A" } },
      };
      const err = handleCommonErrors(original);
      expect(err.cause).toBe(original);
    });

    it("forwards cause for JsonWebTokenError", () => {
      const original = { name: "JsonWebTokenError", message: "jwt malformed" };
      const err = handleCommonErrors(original);
      expect(err.cause).toBe(original);
    });

    it("forwards cause for TokenExpiredError", () => {
      const original = { name: "TokenExpiredError", message: "jwt expired" };
      const err = handleCommonErrors(original);
      expect(err.cause).toBe(original);
    });

    it("forwards cause for NotBeforeError", () => {
      const original = { name: "NotBeforeError", message: "jwt not active" };
      const err = handleCommonErrors(original);
      expect(err.cause).toBe(original);
    });

    it("forwards cause for AxiosError on the upstream-status pass-through path", () => {
      const original = {
        name: "AxiosError",
        message: "Request failed with status code 404",
        response: { status: 404, statusText: "Not Found" },
      };
      const err = handleCommonErrors(original);
      expect(err.statusCode).toBe(404);
      expect(err.cause).toBe(original);
    });

    it("forwards cause for AxiosError on the 502 fallback path", () => {
      const original = {
        name: "AxiosError",
        message: "Network Error",
      };
      const err = handleCommonErrors(original);
      expect(err.statusCode).toBe(502);
      expect(err.cause).toBe(original);
    });

    it("forwards cause for SyntaxError", () => {
      const original = new SyntaxError("bad token");
      const err = handleCommonErrors(original);
      expect(err.cause).toBe(original);
    });

    it("forwards cause for ZodError", () => {
      const original = {
        name: "ZodError",
        issues: [{ message: "Required" }],
      };
      const err = handleCommonErrors(original);
      expect(err.cause).toBe(original);
    });

    it("forwards cause from the default branch when input is an Error object", () => {
      const original = new Error("something broke");
      const err = handleCommonErrors(original);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("something broke");
      expect(err.cause).toBe(original);
    });

    it("forwards cause from the default branch when input is a plain object with statusCode", () => {
      const original = { message: "Teapot", statusCode: 418 };
      const err = handleCommonErrors(original);
      expect(err.statusCode).toBe(418);
      expect(err.cause).toBe(original);
    });

    it("does NOT set cause when input is a primitive (null/undefined/string/number)", () => {
      // Primitives are short-circuited at the top of the function, so cause is
      // never wired up. Verify each primitive path leaves `.cause` undefined.
      expect(handleCommonErrors(null).cause).toBeUndefined();
      expect(handleCommonErrors(undefined).cause).toBeUndefined();
      expect(handleCommonErrors("string error").cause).toBeUndefined();
      expect(handleCommonErrors(42).cause).toBeUndefined();
    });
  });

  describe("AggregateError mapping (Task 14d)", () => {
    it("maps AggregateError with multiple sub-errors to 500 with joined messages", () => {
      const sub1 = new Error("first failure");
      const sub2 = new Error("second failure");
      const sub3 = new Error("third failure");
      const aggregate = new AggregateError(
        [sub1, sub2, sub3],
        "All promises were rejected"
      );
      const err = handleCommonErrors(aggregate);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("first failure; second failure; third failure");
      expect(err.cause).toBe(aggregate);
    });

    it("maps AggregateError with empty errors array to 500 with fallback message", () => {
      const aggregate = new AggregateError([], "Empty aggregate");
      const err = handleCommonErrors(aggregate);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Multiple errors occurred");
      expect(err.cause).toBe(aggregate);
    });

    it("maps AggregateError-shaped object (not real AggregateError) by name", () => {
      // Some libraries throw AggregateError-shaped plain objects; we match by
      // err.name so they should get the same mapping.
      const fake = {
        name: "AggregateError",
        message: "All promises were rejected",
        errors: [
          { message: "first" },
          { message: "second" },
        ],
      };
      const err = handleCommonErrors(fake);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("first; second");
      expect(err.cause).toBe(fake);
    });

    it("handles AggregateError with non-Error entries (strings, numbers, null)", () => {
      // Spec allows AggregateError to carry any iterable; non-Error entries
      // should be coerced via String() and `null` should be filtered out
      // (since it stringifies to "null" but has no .message — we accept it
      // through the fallback path).
      const aggregate = {
        name: "AggregateError",
        errors: [
          "raw string error",
          42,
          { message: "object with message" },
          null,
        ],
      };
      const err = handleCommonErrors(aggregate);
      expect(err.statusCode).toBe(500);
      // Each non-empty entry should be present (order preserved); the mapping
      // is implementation-flexible (could be "raw string error; 42; object with message; null"
      // depending on filtering choice). Assert each non-empty token is included.
      expect(err.message).toContain("raw string error");
      expect(err.message).toContain("42");
      expect(err.message).toContain("object with message");
      // Joined with semicolon
      expect(err.message).toMatch(/;/);
    });

    it("handles AggregateError with missing errors property", () => {
      const fake = { name: "AggregateError" };
      const err = handleCommonErrors(fake);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Multiple errors occurred");
    });

    it("handles AggregateError with non-array errors property", () => {
      const fake = { name: "AggregateError", errors: "not-an-array" };
      const err = handleCommonErrors(fake);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Multiple errors occurred");
    });

    it("attaches the original AggregateError as the cause", () => {
      const aggregate = new AggregateError(
        [new Error("a"), new Error("b")],
        "agg"
      );
      const err = handleCommonErrors(aggregate);
      expect(err.cause).toBe(aggregate);
    });

    it("falls back to empty string for sub-errors that throw on String coercion", () => {
      // Sub-error has no `message` property and every primitive-coercion
      // hook throws. This exercises the catch in the AggregateError mapper
      // that turns a String() failure into "" so the bad entry drops out
      // instead of crashing the mapper.
      const evil: Record<symbol | string, unknown> = {
        [Symbol.toPrimitive]() {
          throw new Error("hostile Symbol.toPrimitive");
        },
        toString() {
          throw new Error("hostile toString");
        },
        valueOf() {
          throw new Error("hostile valueOf");
        },
      };
      const aggregate = {
        name: "AggregateError",
        errors: [evil, new Error("survivor")],
      };
      const err = handleCommonErrors(aggregate);
      expect(err.statusCode).toBe(500);
      // Hostile entry collapses to "" and is filtered; only the survivor remains.
      expect(err.message).toBe("survivor");
    });
  });
});
