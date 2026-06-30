import type { Request, Response, NextFunction } from "express";
import { errorMiddleware, createErrorMiddleware, ErrorHandler } from "../src";
import type { ErrorPayload } from "../src";

function createRes() {
  const res: Partial<Response> & {
    body?: any;
    code?: number;
    sent?: boolean;
    sentText?: string;
    contentType?: string;
  } = {
    headersSent: false,
    status(code: number) {
      this.code = code;
      return this as any;
    },
    json(payload: any) {
      this.body = payload;
      this.sent = true;
      return this as any;
    },
    end() {
      this.sent = true;
      return this as any;
    },
    type(t: string) {
      this.contentType = t;
      return this as any;
    },
    send(body: any) {
      this.sentText = String(body);
      this.sent = true;
      return this as any;
    },
  };
  return res as Response;
}

describe("errorMiddleware", () => {
  const req = {} as Request;
  const next = (() => {}) as NextFunction;

  it("formats ErrorHandler instances", () => {
    const res = createRes();
    const err = new ErrorHandler("Bad", 400);
    errorMiddleware(err, req, res, next);
    expect((res as any).code).toBe(400);
    expect((res as any).body.message).toBe("Bad");
  });

  it("maps duplicate key 11000 to 400", () => {
    const res = createRes();
    const err = { code: 11000, keyValue: { email: "a@b.com" } } as any;
    errorMiddleware(err, req, res, next);
    expect((res as any).code).toBe(400);
    expect((res as any).body.message).toContain("email");
  });

  it("maps duplicate key 11000 with empty keyValue to 400 with 'unknown'", () => {
    const res = createRes();
    const err = { code: 11000, keyValue: {} } as any;
    errorMiddleware(err, req, res, next);
    expect((res as any).code).toBe(400);
    expect((res as any).body.message).toContain("unknown");
  });

  it("maps duplicate key 11000 with undefined keyValue to 400 with 'unknown'", () => {
    const res = createRes();
    const err = { code: 11000 } as any;
    errorMiddleware(err, req, res, next);
    expect((res as any).code).toBe(400);
    expect((res as any).body.message).toContain("unknown");
  });

  it("handles CSRF token error to 403", () => {
    const res = createRes();
    const err = { code: "EBADCSRFTOKEN" } as any;
    errorMiddleware(err, req, res, next);
    expect((res as any).code).toBe(403);
    expect((res as any).body.message).toContain("CSRF");
  });

  it("normalizes network errors to 502", () => {
    for (const code of ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"]) {
      const res = createRes();
      const err = { code } as any;
      errorMiddleware(err, req, res, next);
      expect((res as any).code).toBe(502);
      expect((res as any).body.message).toContain("network");
    }
  });

  it("delegates to next(err) when headers are already sent", () => {
    const res = createRes();
    (res as any).headersSent = true;
    const err = new Error("oops");
    const nextSpy = jest.fn();
    errorMiddleware(err, req, res, nextSpy as unknown as NextFunction);
    // Default Express handler should be invoked with the *original* error so
    // it can log the real cause; we should not have written a JSON body.
    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(nextSpy).toHaveBeenCalledWith(err);
    expect((res as any).body).toBeUndefined();
    expect((res as any).sent).toBeFalsy();
  });

  it("forwards the original error (not the normalized one) to next when headers sent", () => {
    const res = createRes();
    (res as any).headersSent = true;
    // Use a recognizable shape that handleCommonErrors would normalize.
    const original: any = {
      name: "ValidationError",
      errors: { a: { message: "A" } },
    };
    const nextSpy = jest.fn();
    errorMiddleware(original, req, res, nextSpy as unknown as NextFunction);
    expect(nextSpy).toHaveBeenCalledTimes(1);
    // The argument must be the very same reference, not the normalized
    // ErrorHandler instance.
    expect(nextSpy.mock.calls[0][0]).toBe(original);
  });

  it("falls back to res.end() when headers are already sent and next is not a function", () => {
    const res = createRes();
    (res as any).headersSent = true;
    const err = new Error("oops");
    // Pass a non-function next to exercise the defensive fallback branch.
    errorMiddleware(err, req, res, undefined as unknown as NextFunction);
    expect((res as any).sent).toBe(true);
    expect((res as any).body).toBeUndefined();
  });

  it("maps ENOENT error to 404 with 'Resource not found'", () => {
    const res = createRes();
    const err = { code: "ENOENT" } as any;
    errorMiddleware(err, req, res, next);
    expect((res as any).code).toBe(404);
    expect((res as any).body.message).toBe("Resource not found");
  });

  it("excludes stack trace in production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = createRes();
      const err = new Error("prod error");
      errorMiddleware(err, req, res, next);
      expect((res as any).body.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("includes stack trace in non-production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const res = createRes();
      const err = new Error("dev error");
      errorMiddleware(err, req, res, next);
      expect((res as any).body.stack).toBeDefined();
      expect(typeof (res as any).body.stack).toBe("string");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("does not propagate when res.end() throws in the headersSent fallback path (no next provided)", () => {
    const res = createRes();
    (res as any).headersSent = true;
    (res as any).end = () => {
      throw new Error("end() failed");
    };
    const err = new Error("oops");
    // No next provided -> fallback branch runs; res.end() throws but the
    // middleware must swallow it.
    expect(() =>
      errorMiddleware(err, req, res, undefined as unknown as NextFunction)
    ).not.toThrow();
  });

  it("does not swallow exceptions thrown by next(err) itself", () => {
    const res = createRes();
    (res as any).headersSent = true;
    const err = new Error("oops");
    const nextThatThrows = (() => {
      throw new Error("next blew up");
    }) as unknown as NextFunction;
    // Per Task 6 spec: errors raised by next() are real bugs and should
    // surface, not be silently swallowed.
    expect(() => errorMiddleware(err, req, res, nextThatThrows)).toThrow(
      "next blew up"
    );
  });

  it("returns full payload structure with success, message, statusCode, and statusText", () => {
    const res = createRes();
    const err = new ErrorHandler("Test error", 422);
    errorMiddleware(err, req, res, next);
    const body = (res as any).body;
    expect(body).toHaveProperty("success", false);
    expect(body).toHaveProperty("message", "Test error");
    expect(body).toHaveProperty("statusCode", 422);
    expect(body).toHaveProperty("statusText", "Unprocessable Content");
  });

  it("does not throw when err.message getter throws", () => {
    const res = createRes();
    const err: any = {};
    Object.defineProperty(err, "message", {
      get() {
        throw new Error("hostile message getter");
      },
    });
    Object.defineProperty(err, "stack", {
      get() {
        return "stack-line-1\nstack-line-2";
      },
    });
    expect(() => errorMiddleware(err, req, res, next)).not.toThrow();
    expect((res as any).code).toBe(500);
    // Either the safe fallback message or the generic 500 message is acceptable.
    expect(typeof (res as any).body.message).toBe("string");
    expect((res as any).body.success).toBe(false);
  });

  it("does not throw when err.stack getter throws", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const res = createRes();
      const err: any = new Error("boom");
      Object.defineProperty(err, "stack", {
        get() {
          throw new Error("hostile stack getter");
        },
      });
      expect(() => errorMiddleware(err, req, res, next)).not.toThrow();
      expect((res as any).sent).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("falls back to sanitized payload when res.json throws on the first attempt", () => {
    const res = createRes();
    let calls = 0;
    (res as any).json = function (payload: any) {
      calls += 1;
      if (calls === 1) {
        throw new TypeError("Converting circular structure to JSON");
      }
      this.body = payload;
      this.sent = true;
      return this;
    };
    const err = new ErrorHandler("Bad payload", 400);
    expect(() => errorMiddleware(err, req, res, next)).not.toThrow();
    expect(calls).toBe(2);
    expect((res as any).code).toBe(400);
    expect((res as any).body.message).toBe("Bad payload");
  });

  it("falls back to plain text when res.json keeps throwing", () => {
    const res = createRes();
    (res as any).json = () => {
      throw new TypeError("res.json always fails");
    };
    const err = new ErrorHandler("Forbidden", 403);
    expect(() => errorMiddleware(err, req, res, next)).not.toThrow();
    expect((res as any).code).toBe(403);
    expect((res as any).contentType).toBe("text/plain");
    expect((res as any).sentText).toBe("Forbidden");
  });

  it("truncates excessively long stack traces in non-production", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const res = createRes();
      const err = new Error("long");
      err.stack = "x".repeat(50_000);
      errorMiddleware(err, req, res, next);
      const stack: string = (res as any).body.stack;
      expect(typeof stack).toBe("string");
      // Cap is 10_000 + a short truncation marker.
      expect(stack.length).toBeLessThanOrEqual(10_000 + 64);
      expect(stack.endsWith("[stack truncated]")).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("is recognized by Express as an error middleware (length === 4)", () => {
    expect(errorMiddleware.length).toBe(4);
  });

  it("ErrorPayload type is exported and assignable from a typed body", () => {
    const res = createRes();
    const err = new ErrorHandler("Typed body", 409);
    errorMiddleware(err, req, res, next);
    const body: ErrorPayload = (res as any).body;
    expect(body.success).toBe(false);
    expect(body.message).toBe("Typed body");
    expect(body.statusCode).toBe(409);
  });

  describe("cause propagation in err.code switch (Task 2)", () => {
    // Each code-mapped branch constructs a fresh ErrorHandler that should
    // carry the original error as `.cause` so structured loggers can walk
    // back to the raw upstream cause (Mongo duplicate-key, FS ENOENT, network
    // failure, etc.). The middleware does not include `cause` in the JSON
    // response (by design — avoids leaking upstream payloads). To assert it
    // we observe the constructed ErrorHandler by patching res.status to
    // capture the live `error.statusCode` call (uninteresting) and instead
    // intercept ErrorHandler construction via a temporary patch on its
    // prototype's internal property descriptor list.
    //
    // Since the middleware is built around `import ErrorHandler from
    // "./ErrorHandler"` and the imported binding is a class, we register a
    // short-lived listener on the prototype's `[Symbol.for('cause')]` via a
    // lightweight subclass capture: we wrap the response's `json` to fish
    // the matching ErrorHandler back out of a per-test buffer that
    // ErrorHandler appends itself to whenever a global capture flag is set.
    // To avoid touching production code, we use a different tactic: we
    // exercise each switch branch and assert via a `beforeAll` hook that
    // walks every ErrorHandler instance constructed during the test using
    // a tracking Set populated by listening on the prototype.
    //
    // Practically, the cleanest way that does not require modifying source
    // is to (a) install a global ErrorHandler-construction tracker via the
    // `Error` superclass `cause` setter, and (b) walk the recent
    // constructions after the middleware call. Implemented below.

    const originalCaptureStackTrace = Error.captureStackTrace;
    let constructedErrors: ErrorHandler[] = [];
    let captureActive = false;

    beforeAll(() => {
      // Hook Error.captureStackTrace — ErrorHandler calls this in its
      // constructor, after `this.statusCode` and `this.cause` are set, so we
      // capture the just-constructed instance reliably without altering
      // production source. We only record when capture is active to avoid
      // polluting unrelated tests in the same suite.
      Error.captureStackTrace = function (
        targetObject: object,
        constructorOpt?: Function
      ): void {
        if (captureActive && targetObject instanceof ErrorHandler) {
          constructedErrors.push(targetObject);
        }
        return originalCaptureStackTrace.call(
          Error,
          targetObject,
          constructorOpt
        );
      };
    });

    afterAll(() => {
      Error.captureStackTrace = originalCaptureStackTrace;
    });

    beforeEach(() => {
      constructedErrors = [];
      captureActive = true;
    });

    afterEach(() => {
      captureActive = false;
    });

    it("forwards cause for ENOENT (404) branch", () => {
      const res = createRes();
      const original = { code: "ENOENT" };
      errorMiddleware(original, req, res, next);
      expect((res as any).code).toBe(404);
      // The middleware constructs (1) an ErrorHandler from handleCommonErrors'
      // default branch, then (2) a fresh ErrorHandler in the switch branch.
      // The last one is the one that actually drives the response.
      const last = constructedErrors[constructedErrors.length - 1];
      expect(last).toBeDefined();
      expect(last.statusCode).toBe(404);
      expect(last.cause).toBe(original);
    });

    it("forwards cause for 11000 (Mongo duplicate) branch", () => {
      const res = createRes();
      const original = { code: 11000, keyValue: { email: "a@b.com" } };
      errorMiddleware(original, req, res, next);
      expect((res as any).code).toBe(400);
      const last = constructedErrors[constructedErrors.length - 1];
      expect(last).toBeDefined();
      expect(last.statusCode).toBe(400);
      expect(last.cause).toBe(original);
    });

    it("forwards cause for EBADCSRFTOKEN (403) branch", () => {
      const res = createRes();
      const original = { code: "EBADCSRFTOKEN" };
      errorMiddleware(original, req, res, next);
      expect((res as any).code).toBe(403);
      const last = constructedErrors[constructedErrors.length - 1];
      expect(last).toBeDefined();
      expect(last.statusCode).toBe(403);
      expect(last.cause).toBe(original);
    });

    it("forwards cause for ECONNREFUSED (502) branch", () => {
      const res = createRes();
      const original = { code: "ECONNREFUSED" };
      errorMiddleware(original, req, res, next);
      expect((res as any).code).toBe(502);
      const last = constructedErrors[constructedErrors.length - 1];
      expect(last).toBeDefined();
      expect(last.statusCode).toBe(502);
      expect(last.cause).toBe(original);
    });
  });

  describe("normalization pipeline precedence (Phase 3)", () => {
    // errorMiddleware runs handleCommonErrors(err) (switch on err.name) and
    // THEN a switch(err?.code) that can override the result. These tests pin
    // the contract that the err.code switch wins when an error matches both
    // stages — a refactor that silently swapped which stage wins would
    // otherwise pass the rest of the suite unnoticed.

    it("err.code switch wins over handleCommonErrors when both match (AxiosError + ECONNREFUSED)", () => {
      const res = createRes();
      // Both stages resolve to 502: handleCommonErrors' AxiosError branch (no
      // response → 502 fallback) and the ECONNREFUSED switch branch. The
      // message is the discriminator that proves the switch ran last.
      const err = { name: "AxiosError", code: "ECONNREFUSED" } as any;
      errorMiddleware(err, req, res, next);
      expect((res as any).code).toBe(502);
      // Switch branch message, NOT the handleCommonErrors AxiosError-fallback message.
      expect((res as any).body.message).toBe("Upstream network error");
      expect((res as any).body.message).not.toBe(
        "Error communicating with an external service"
      );
    });

    it("err.code switch wins at the status level (CastError name + ENOENT code → 404)", () => {
      const res = createRes();
      // handleCommonErrors: CastError → 400 "Resource not found. Invalid id"
      // err.code switch:    ENOENT    → 404 "Resource not found"  (this must win)
      const err = { name: "CastError", path: "id", code: "ENOENT" } as any;
      errorMiddleware(err, req, res, next);
      expect((res as any).code).toBe(404);
      expect((res as any).body.message).toBe("Resource not found");
    });
  });

  describe("createErrorMiddleware factory (Phase 4)", () => {
    it("returns a length-4 handler that behaves identically to the default export", () => {
      const mw = createErrorMiddleware();
      expect(typeof mw).toBe("function");
      // Express identifies error middleware by arity; the factory must keep it.
      expect(mw.length).toBe(4);

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const res = createRes();
        const err = new ErrorHandler("still shown by default", 500);
        mw(err, req, res, next);
        expect((res as any).code).toBe(500);
        // Default exposeServerErrors=true preserves the message even in prod —
        // the zero-config factory is identical to the default export.
        expect((res as any).body.message).toBe("still shown by default");
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("honours an explicit exposeServerErrors: true the same as the default", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const mw = createErrorMiddleware({ exposeServerErrors: true });
        const res = createRes();
        const err = new ErrorHandler("explicitly exposed", 500);
        mw(err, req, res, next);
        expect((res as any).code).toBe(500);
        expect((res as any).body.message).toBe("explicitly exposed");
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    describe("exposeServerErrors: false", () => {
      it("redacts a 500 message to the generic status text in production", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
          const mw = createErrorMiddleware({ exposeServerErrors: false });
          const res = createRes();
          const err = new ErrorHandler("secret db dsn", 500);
          mw(err, req, res, next);
          expect((res as any).code).toBe(500);
          expect((res as any).body.message).toBe("Internal Server Error");
          expect((res as any).body.statusCode).toBe(500);
          expect((res as any).body.statusText).toBe("Internal Server Error");
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it("redacts a 502 message to 'Bad Gateway' in production", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
          const mw = createErrorMiddleware({ exposeServerErrors: false });
          const res = createRes();
          const err = new ErrorHandler("upstream boom", 502);
          mw(err, req, res, next);
          expect((res as any).code).toBe(502);
          expect((res as any).body.message).toBe("Bad Gateway");
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it("leaves 4xx messages untouched in production", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
          const mw = createErrorMiddleware({ exposeServerErrors: false });
          const res = createRes();
          const err = new ErrorHandler("bad field", 400);
          mw(err, req, res, next);
          expect((res as any).code).toBe(400);
          expect((res as any).body.message).toBe("bad field");
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it("keeps the real 5xx message (and stack) outside production", () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "development";
        try {
          const mw = createErrorMiddleware({ exposeServerErrors: false });
          const res = createRes();
          const err = new ErrorHandler("secret db dsn", 500);
          mw(err, req, res, next);
          expect((res as any).code).toBe(500);
          // Dev keeps the real message and includes the stack.
          expect((res as any).body.message).toBe("secret db dsn");
          expect(typeof (res as any).body.stack).toBe("string");
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it("redacts a switch-derived 5xx (ECONNREFUSED → 502) to the generic status text in production", () => {
        // Unlike the other redaction tests, the 502 here is assigned INSIDE the
        // middleware by the err.code switch, not pre-built on the ErrorHandler. This
        // pins that redaction reads the SWITCH-FINAL statusCode — a refactor that
        // moved the redaction above the switch would leak the pre-switch message and
        // fail this test.
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "production";
        try {
          const mw = createErrorMiddleware({ exposeServerErrors: false });
          const res = createRes();
          const err = { code: "ECONNREFUSED" } as any;
          mw(err, req, res, next);
          expect((res as any).code).toBe(502);
          // "Bad Gateway" is the 502 status text — the input carried no message of
          // its own, so this proves redaction ran on the switch-derived 502 object.
          expect((res as any).body.message).toBe("Bad Gateway");
          expect((res as any).body.statusText).toBe("Bad Gateway");
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });
    });
  });
});
