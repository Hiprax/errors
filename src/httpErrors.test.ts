import {
  httpErrors,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  internalServerError,
} from "./httpErrors";

describe("httpErrors utilities", () => {
  it("creates 400 by default with message override", () => {
    const err = badRequest("Nope");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Nope");
  });

  it("exposes collection and individual factories", () => {
    const e1 = httpErrors.notFound();
    const e2 = notFound();
    expect(e1.statusCode).toBe(404);
    expect(e2.statusCode).toBe(404);
  });

  it("creates 500 by default for internalServerError", () => {
    const err = internalServerError();
    expect(err.statusCode).toBe(500);
  });
});
