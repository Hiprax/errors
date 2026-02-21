import { ErrorHandler, errorCodes } from "../src";

describe("ErrorHandler", () => {
  it("creates a default 500 error when no args provided", () => {
    const err = new ErrorHandler();
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(500);
    expect(err.statusText).toBe(errorCodes.get(500));
    expect(err.message).toContain("Something went wrong");
  });

  it("uses provided valid status code and message", () => {
    const err = new ErrorHandler("Missing", 404);
    expect(err.statusCode).toBe(404);
    expect(err.statusText).toBe("Not Found");
    expect(err.message).toBe("Missing");
  });

  it("has name set to 'ErrorHandler'", () => {
    const err = new ErrorHandler("Test", 400);
    expect(err.name).toBe("ErrorHandler");
  });

  it("has a clean stack trace without constructor frame", () => {
    const err = new ErrorHandler("Stack test", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).not.toContain("new ErrorHandler");
  });

  it("normalizes unknown status codes to 500", () => {
    const err = new ErrorHandler("Weird", 499 as any);
    expect(err.statusCode).toBe(500);
    expect(err.statusText).toBe("Internal Server Error");
  });

  it("is instanceof both Error and ErrorHandler", () => {
    const err = new ErrorHandler();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ErrorHandler);
  });

  it("works when captureStackTrace is unavailable", () => {
    const original = Error.captureStackTrace;
    try {
      // Remove captureStackTrace to simulate non-V8 environments
      (Error as any).captureStackTrace = undefined;

      const err = new ErrorHandler("No stack capture", 400);
      expect(err.message).toBe("No stack capture");
      expect(err.statusCode).toBe(400);
      expect(err.statusText).toBe("Bad Request");
      expect(err.name).toBe("ErrorHandler");
    } finally {
      // Restore captureStackTrace
      Error.captureStackTrace = original;
    }
  });

  it("resolves correct statusText for various status codes", () => {
    const cases: Array<[number, string]> = [
      [401, "Unauthorized"],
      [403, "Forbidden"],
      [502, "Bad Gateway"],
      [503, "Service Unavailable"],
      [429, "Too Many Requests"],
    ];

    for (const [code, expectedText] of cases) {
      const err = new ErrorHandler("test", code);
      expect(err.statusCode).toBe(code);
      expect(err.statusText).toBe(expectedText);
    }
  });
});
