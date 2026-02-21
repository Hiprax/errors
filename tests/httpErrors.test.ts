import { httpErrors, ErrorHandler } from "../src";

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
});
