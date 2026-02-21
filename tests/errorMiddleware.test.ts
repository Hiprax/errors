import type { Request, Response, NextFunction } from "express";
import { errorMiddleware, ErrorHandler } from "../src";

function createRes() {
  const res: Partial<Response> & { body?: any; code?: number; sent?: boolean } =
    {
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

  it("ends if headers already sent without sending a JSON body", () => {
    const res = createRes();
    (res as any).headersSent = true;
    const err = new Error("oops");
    errorMiddleware(err, req, res, next);
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

  it("does not propagate when res.end() throws after headersSent", () => {
    const res = createRes();
    (res as any).headersSent = true;
    (res as any).end = () => {
      throw new Error("end() failed");
    };
    const err = new Error("oops");
    expect(() => errorMiddleware(err, req, res, next)).not.toThrow();
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
});
