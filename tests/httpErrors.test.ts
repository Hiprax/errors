import { httpErrors, ErrorHandler } from "../src";
import type { ErrorFactory } from "../src";

describe("httpErrors utilities", () => {
  it("creates 400 for badRequest with default message", () => {
    const err = httpErrors.badRequest();
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Bad request");
  });

  it("creates 400 for badRequest with custom message override", () => {
    const err = httpErrors.badRequest("Nope");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Nope");
  });

  it("creates 404 for notFound with default message", () => {
    const e1 = httpErrors.notFound();
    expect(e1.statusCode).toBe(404);
    expect(e1.message).toBe("Not found");
  });

  it("creates 500 for internalServerError with default message", () => {
    const err = httpErrors.internalServerError();
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Internal server error");
  });

  it("creates 405 for methodNotAllowed", () => {
    const err = httpErrors.methodNotAllowed();
    expect(err.statusCode).toBe(405);
    expect(err.message).toBe("Method not allowed");
  });

  it("creates 408 for requestTimeout", () => {
    const err = httpErrors.requestTimeout();
    expect(err.statusCode).toBe(408);
    expect(err.message).toBe("Request timeout");
  });

  it("creates 410 for gone", () => {
    const err = httpErrors.gone();
    expect(err.statusCode).toBe(410);
    expect(err.message).toBe("Gone");
  });

  it("creates 413 for payloadTooLarge", () => {
    const err = httpErrors.payloadTooLarge();
    expect(err.statusCode).toBe(413);
    expect(err.message).toBe("Payload too large");
  });

  it("creates 415 for unsupportedMediaType", () => {
    const err = httpErrors.unsupportedMediaType();
    expect(err.statusCode).toBe(415);
    expect(err.message).toBe("Unsupported media type");
  });

  it("creates 422 for unprocessableEntity", () => {
    const err = httpErrors.unprocessableEntity();
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe("Unprocessable entity");
  });

  it("allows custom messages on new factories", () => {
    const err = httpErrors.methodNotAllowed("GET not supported");
    expect(err.statusCode).toBe(405);
    expect(err.message).toBe("GET not supported");
  });

  it("creates 401 for unauthorized with default message", () => {
    const err = httpErrors.unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Unauthorized");
  });

  it("creates 403 for forbidden with default message", () => {
    const err = httpErrors.forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe("Forbidden");
  });

  it("creates 409 for conflict with default message", () => {
    const err = httpErrors.conflict();
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("Conflict");
  });

  it("creates 429 for tooManyRequests with default message", () => {
    const err = httpErrors.tooManyRequests();
    expect(err.statusCode).toBe(429);
    expect(err.message).toBe("Too many requests");
  });

  it("creates 501 for notImplemented with default message", () => {
    const err = httpErrors.notImplemented();
    expect(err.statusCode).toBe(501);
    expect(err.message).toBe("Not implemented");
    expect(err.statusText).toBe("Not Implemented");
  });

  it("allows custom message override on notImplemented", () => {
    const err = httpErrors.notImplemented("Stub endpoint");
    expect(err.statusCode).toBe(501);
    expect(err.message).toBe("Stub endpoint");
  });

  it("creates 502 for badGateway with default message", () => {
    const err = httpErrors.badGateway();
    expect(err.statusCode).toBe(502);
    expect(err.message).toBe("Bad gateway");
  });

  it("creates 503 for serviceUnavailable with default message", () => {
    const err = httpErrors.serviceUnavailable();
    expect(err.statusCode).toBe(503);
    expect(err.message).toBe("Service unavailable");
  });

  it("creates 504 for gatewayTimeout with default message", () => {
    const err = httpErrors.gatewayTimeout();
    expect(err.statusCode).toBe(504);
    expect(err.message).toBe("Gateway timeout");
  });

  it("all factories return instances of ErrorHandler and Error", () => {
    const factories = [
      httpErrors.badRequest,
      httpErrors.unauthorized,
      httpErrors.forbidden,
      httpErrors.notFound,
      httpErrors.methodNotAllowed,
      httpErrors.requestTimeout,
      httpErrors.conflict,
      httpErrors.gone,
      httpErrors.payloadTooLarge,
      httpErrors.unsupportedMediaType,
      httpErrors.unprocessableEntity,
      httpErrors.tooManyRequests,
      httpErrors.internalServerError,
      httpErrors.notImplemented,
      httpErrors.badGateway,
      httpErrors.serviceUnavailable,
      httpErrors.gatewayTimeout,
    ];

    for (const factory of factories) {
      const err = factory();
      expect(err).toBeInstanceOf(ErrorHandler);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("allows custom message override on unauthorized", () => {
    const err = httpErrors.unauthorized("Custom");
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Custom");
  });

  it("re-exports ErrorFactory type from package entry point and matches httpErrors factory shape", () => {
    // Compile-time assertion: factory values are assignable to ErrorFactory type
    const f: ErrorFactory = httpErrors.notFound;
    const g: ErrorFactory = httpErrors.badRequest;
    expect(typeof f).toBe("function");
    expect(typeof g).toBe("function");
    const err = f("custom not found");
    expect(err).toBeInstanceOf(ErrorHandler);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("custom not found");
  });

  describe("cause option (Task 14b)", () => {
    it("forwards cause to the produced ErrorHandler from notFound", () => {
      const original = new Error("db row missing");
      const err = httpErrors.notFound("User not found", { cause: original });
      expect(err).toBeInstanceOf(ErrorHandler);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("User not found");
      expect(err.cause).toBe(original);
    });

    it("forwards cause when message is omitted (uses default message)", () => {
      const original = new Error("driver-level failure");
      const err = httpErrors.conflict(undefined, { cause: original });
      expect(err.statusCode).toBe(409);
      expect(err.message).toBe("Conflict");
      expect(err.cause).toBe(original);
    });

    it(".cause is undefined when options not provided", () => {
      const err = httpErrors.badRequest("nope");
      expect(err.cause).toBeUndefined();
    });

    it("supports cause across all factories", () => {
      const original = new Error("source");
      const factories: Array<[ErrorFactory, number]> = [
        [httpErrors.badRequest, 400],
        [httpErrors.unauthorized, 401],
        [httpErrors.forbidden, 403],
        [httpErrors.notFound, 404],
        [httpErrors.methodNotAllowed, 405],
        [httpErrors.requestTimeout, 408],
        [httpErrors.conflict, 409],
        [httpErrors.gone, 410],
        [httpErrors.payloadTooLarge, 413],
        [httpErrors.unsupportedMediaType, 415],
        [httpErrors.unprocessableEntity, 422],
        [httpErrors.tooManyRequests, 429],
        [httpErrors.internalServerError, 500],
        [httpErrors.notImplemented, 501],
        [httpErrors.badGateway, 502],
        [httpErrors.serviceUnavailable, 503],
        [httpErrors.gatewayTimeout, 504],
      ];

      for (const [factory, expectedCode] of factories) {
        const err = factory(undefined, { cause: original });
        expect(err.statusCode).toBe(expectedCode);
        expect(err.cause).toBe(original);
      }
    });
  });
});
