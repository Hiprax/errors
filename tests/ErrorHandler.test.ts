import { ErrorHandler, errorCodes } from "../src";
import type { ErrorHandlerOptions } from "../src";

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

  describe("cause option (Task 14b)", () => {
    it("preserves cause when provided", () => {
      const original = new Error("original failure");
      const err = new ErrorHandler("wrapped", 500, { cause: original });
      expect(err.cause).toBe(original);
      expect(err.message).toBe("wrapped");
      expect(err.statusCode).toBe(500);
    });

    it("preserves cause for non-Error values (string, object)", () => {
      const errString = new ErrorHandler("wrapped", 400, {
        cause: "raw string cause",
      });
      expect(errString.cause).toBe("raw string cause");

      const opaque = { code: "EX", reason: "test" };
      const errObj = new ErrorHandler("wrapped", 400, { cause: opaque });
      expect(errObj.cause).toBe(opaque);
    });

    it(".cause is undefined when not provided", () => {
      const err = new ErrorHandler("no cause", 400);
      expect(err.cause).toBeUndefined();
    });

    it(".cause is undefined when empty options bag is provided", () => {
      const err = new ErrorHandler("no cause", 400, {});
      expect(err.cause).toBeUndefined();
    });

    it("works with options but no message/statusCode (uses defaults)", () => {
      const original = new Error("root");
      const err = new ErrorHandler(undefined, undefined, { cause: original });
      expect(err.cause).toBe(original);
      expect(err.statusCode).toBe(500);
      expect(err.message).toContain("Something went wrong");
    });

    it("normalizes unknown status codes to 500 even when cause is provided", () => {
      const err = new ErrorHandler("x", 999 as any, { cause: new Error("c") });
      expect(err.statusCode).toBe(500);
      expect(err.cause).toBeInstanceOf(Error);
    });
  });

  it("re-exports ErrorHandlerOptions type from package entry point", () => {
    // Compile-time assertion: the type is importable from the package entry
    // point and assignable to a concrete options bag value passed to the
    // ErrorHandler constructor.
    const opts: ErrorHandlerOptions = { cause: new Error("x") };
    const err = new ErrorHandler("msg", 500, opts);
    expect(err.cause).toBe(opts.cause);
  });
});
