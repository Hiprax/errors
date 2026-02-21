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
});
