import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";
import { ErrorHandler, errorMiddleware } from "../src";

/**
 * Integration tests for `errorMiddleware` exercising the full pipeline:
 *   raw error -> handleCommonErrors -> err.code switch -> JSON response.
 *
 * Each test stands up a real `express` app, registers a route that throws the
 * scenario under test, mounts the middleware as the terminal handler, and
 * asserts the wire-level HTTP response with `supertest`.
 */

/**
 * Builds a small Express app whose `/throw` route invokes the supplied factory
 * to obtain an error, then forwards it through `next(err)`. The library's
 * `errorMiddleware` is registered last so it observes the same pipeline real
 * applications use.
 */
function buildApp(makeError: () => unknown): Express {
  const app = express();

  app.get("/throw", (_req: Request, _res: Response, next: NextFunction) => {
    next(makeError() as any);
  });

  app.use(errorMiddleware);
  return app;
}

/**
 * Restores `NODE_ENV` to its original value after each test. The middleware
 * branches on this variable to decide whether to include `stack`, so tests
 * mutate it temporarily — leaks would silently change downstream behavior.
 */
const originalNodeEnv = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("errorMiddleware integration (supertest + real express)", () => {
  it("formats a thrown ErrorHandler with the correct status and JSON shape", async () => {
    const app = buildApp(() => new ErrorHandler("not found", 404));
    const response = await request(app).get("/throw");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: "not found",
      statusCode: 404,
      statusText: "Not Found",
    });
  });

  it("maps a Mongoose-style CastError to 400 with the path in the message", async () => {
    const app = buildApp(() => {
      const err: any = new Error("Cast failed");
      err.name = "CastError";
      err.path = "userId";
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain("userId");
  });

  it("maps a Mongoose-style ValidationError to 400 joining all sub-error messages", async () => {
    const app = buildApp(() => {
      const err: any = new Error("Validation failed");
      err.name = "ValidationError";
      err.errors = {
        email: { message: "email is required" },
        password: { message: "password too short" },
      };
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain("email is required");
    expect(response.body.message).toContain("password too short");
  });

  it("maps a JsonWebTokenError to 401", async () => {
    const app = buildApp(() => {
      const err: any = new Error("invalid signature");
      err.name = "JsonWebTokenError";
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(401);
    expect(response.body.statusCode).toBe(401);
    expect(response.body.message).toMatch(/JSON Web Token/i);
  });

  it("maps a SyntaxError to 400 with the malformed JSON message", async () => {
    const app = buildApp(() => {
      const err: any = new SyntaxError("Unexpected token in JSON");
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain("Malformed JSON");
  });

  it("maps a fake ZodError to 400 joining all issue messages", async () => {
    const app = buildApp(() => {
      const err: any = new Error("zod failed");
      err.name = "ZodError";
      err.issues = [
        { message: "name is required" },
        { message: "age must be a number" },
      ];
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain("name is required");
    expect(response.body.message).toContain("age must be a number");
  });

  it("passes through an Axios upstream 404 (Task 7 behavior) as a 404 response", async () => {
    const app = buildApp(() => {
      const err: any = new Error("Request failed with status code 404");
      err.name = "AxiosError";
      err.response = { status: 404, statusText: "Not Found" };
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(404);
    expect(response.body.statusCode).toBe(404);
    expect(response.body.statusText).toBe("Not Found");
  });

  it("maps an AggregateError to 500 with the joined sub-error messages", async () => {
    const app = buildApp(() => {
      const err: any = new Error("All promises were rejected");
      err.name = "AggregateError";
      err.errors = [new Error("first failure"), new Error("second failure")];
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(500);
    expect(response.body.statusCode).toBe(500);
    expect(response.body.message).toContain("first failure");
    expect(response.body.message).toContain("second failure");
  });

  it("maps a MongoDB E11000 duplicate key error to 400 with key names in the message", async () => {
    const app = buildApp(() => {
      const err: any = new Error("E11000 duplicate key error");
      err.code = 11000;
      err.keyValue = { email: "a@b.com", username: "alice" };
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toContain("email");
    expect(response.body.message).toContain("username");
  });

  it("maps an ENOENT error to 404 with 'Resource not found'", async () => {
    const app = buildApp(() => {
      const err: any = new Error("file not found");
      err.code = "ENOENT";
      return err;
    });
    const response = await request(app).get("/throw");
    expect(response.status).toBe(404);
    expect(response.body.statusCode).toBe(404);
    expect(response.body.message).toBe("Resource not found");
  });

  it("does NOT include 'stack' in the JSON body when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    const app = buildApp(() => new ErrorHandler("hidden in prod", 500));
    const response = await request(app).get("/throw");
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      message: "hidden in prod",
      statusCode: 500,
    });
    expect(response.body.stack).toBeUndefined();
  });

  it("DOES include 'stack' in the JSON body when NODE_ENV=test", async () => {
    process.env.NODE_ENV = "test";
    const app = buildApp(() => new ErrorHandler("visible in test", 500));
    const response = await request(app).get("/throw");
    expect(response.status).toBe(500);
    expect(typeof response.body.stack).toBe("string");
    expect(response.body.stack.length).toBeGreaterThan(0);
  });
});
