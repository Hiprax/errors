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

  it("ends if headers already sent", () => {
    const res = createRes();
    (res as any).headersSent = true;
    const err = new Error("oops");
    errorMiddleware(err, req, res, next);
    expect((res as any).sent).toBe(true);
  });
});
