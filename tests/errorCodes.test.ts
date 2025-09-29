import { errorCodes } from "../src";

describe("errorCodes map", () => {
  it("is a Map with common HTTP codes", () => {
    expect(errorCodes instanceof Map).toBe(true);
    expect(errorCodes.get(400)).toBe("Bad Request");
    expect(errorCodes.get(404)).toBe("Not Found");
    expect(errorCodes.get(500)).toBe("Internal Server Error");
  });
});
