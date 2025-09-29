import { httpErrors } from "../src";

describe("httpErrors utilities", () => {
  it("creates 400 by default with message override", () => {
    const err = httpErrors.badRequest("Nope");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Nope");
  });

  it("exposes namespaced factories only", () => {
    const e1 = httpErrors.notFound();
    expect(e1.statusCode).toBe(404);
  });

  it("creates 500 by default for internalServerError", () => {
    const err = httpErrors.internalServerError();
    expect(err.statusCode).toBe(500);
  });
});
