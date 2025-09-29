import { handleCommonErrors } from "./handleCommonErrors";

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

  it("maps JWT related errors to 400", () => {
    expect(handleCommonErrors({ name: "JsonWebTokenError" }).statusCode).toBe(
      400
    );
    expect(handleCommonErrors({ name: "TokenExpiredError" }).statusCode).toBe(
      400
    );
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
});
