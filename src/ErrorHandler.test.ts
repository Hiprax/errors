import ErrorHandler from "./ErrorHandler";
import errorCodes from "./errorCodes";

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

  it("normalizes unknown status codes to 500", () => {
    const err = new ErrorHandler("Weird", 499 as any);
    expect(err.statusCode).toBe(500);
    expect(err.statusText).toBe("Internal Server Error");
  });
});
