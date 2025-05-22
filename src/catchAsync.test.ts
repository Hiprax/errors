import { Request, Response, NextFunction } from "express";
import { catchAsync } from "./catchAsync";

describe("catchAsync", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe("Function wrapper", () => {
    it("should handle async errors", async () => {
      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw new Error("Test error");
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should handle sync errors", () => {
      const handler = catchAsync(
        (req: Request, res: Response, next: NextFunction) => {
          throw new Error("Test error");
        }
      );

      handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should handle non-Error objects", async () => {
      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw "String error";
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toContain("String error");
    });

    it("should prevent multiple next() calls", async () => {
      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          next(new Error("First error"));
          throw new Error("Second error");
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should preserve function properties", () => {
      const testFn = function testHandler() {};
      Object.defineProperty(testFn, "name", { value: "testHandler" });
      testFn.customProp = "test";

      const wrapped = catchAsync(testFn);
      expect(wrapped.name).toBe("testHandler");
      expect(wrapped.customProp).toBe("test");
    });
  });

  describe("Class decorator", () => {
    it("should wrap class methods", async () => {
      @catchAsync
      class TestController {
        async testMethod(req: Request, res: Response, next: NextFunction) {
          throw new Error("Test error");
        }
      }

      const controller = new TestController();
      await controller.testMethod(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle inherited methods", async () => {
      class BaseController {
        async baseMethod(req: Request, res: Response, next: NextFunction) {
          throw new Error("Base error");
        }
      }

      @catchAsync
      class TestController extends BaseController {
        async testMethod(req: Request, res: Response, next: NextFunction) {
          throw new Error("Test error");
        }
      }

      const controller = new TestController();
      await controller.baseMethod(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle circular dependencies", () => {
      @catchAsync
      class TestController {
        method1() {
          this.method2();
        }
        method2() {
          this.method1();
        }
      }

      const controller = new TestController();
      expect(() => controller.method1()).not.toThrow();
    });

    it("should handle bound methods", async () => {
      @catchAsync
      class TestController {
        constructor() {
          this.boundMethod = this.boundMethod.bind(this);
        }

        async boundMethod(req: Request, res: Response, next: NextFunction) {
          throw new Error("Test error");
        }
      }

      const controller = new TestController();
      await controller.boundMethod(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("Error handling", () => {
    it("should handle error middleware", async () => {
      const errorHandler = catchAsync(
        (err: Error, req: Request, res: Response, next: NextFunction) => {
          throw new Error("Error in error handler");
        }
      );

      await errorHandler(
        new Error("Original error"),
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle invalid inputs", () => {
      // @ts-expect-error Testing invalid input
      const result = catchAsync(null);
      expect(result).toBe(null);

      // @ts-expect-error Testing invalid input
      const result2 = catchAsync(undefined);
      expect(result2).toBe(undefined);
    });

    it("should handle error objects with custom properties", async () => {
      class CustomError extends Error {
        constructor(message: string, public code: number) {
          super(message);
          this.name = "CustomError";
        }
      }

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw new CustomError("Test error", 500);
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(CustomError);
      expect(passedError.code).toBe(500);
    });

    it("should handle errors with circular references", async () => {
      const circularError = new Error("Circular error") as Error & {
        circularRef?: any;
      };
      const circularObj = { error: circularError };
      circularError.circularRef = circularObj;

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw circularError;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle errors with non-enumerable properties", async () => {
      const error = new Error("Test error");
      Object.defineProperty(error, "hiddenProp", {
        value: "hidden",
        enumerable: false,
      });

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw error;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0];
      expect(passedError.hiddenProp).toBe("hidden");
    });

    it("should handle errors with getters and setters", async () => {
      const error = new Error("Test error");
      let privateValue = "private";
      Object.defineProperty(error, "dynamicProp", {
        get: () => privateValue,
        set: (value) => {
          privateValue = value;
        },
      });

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw error;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0];
      expect(passedError.dynamicProp).toBe("private");
    });

    it("should handle errors with Symbol properties", async () => {
      const error = new Error("Test error") as Error & {
        [key: symbol]: string;
      };
      const sym = Symbol("test");
      error[sym] = "symbol value";

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw error;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0] as Error & {
        [key: symbol]: string;
      };
      expect(passedError[sym]).toBe("symbol value");
    });

    it("should handle errors with prototype chain properties", async () => {
      class BaseError extends Error {
        baseProp = "base";
      }
      class DerivedError extends BaseError {
        derivedProp = "derived";
      }

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw new DerivedError("Test error");
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0];
      expect(passedError).toBeInstanceOf(DerivedError);
      expect(passedError.baseProp).toBe("base");
      expect(passedError.derivedProp).toBe("derived");
    });

    it("should handle errors with frozen objects", async () => {
      const error = new Error("Test error");
      Object.freeze(error);

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw error;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle errors with sealed objects", async () => {
      const error = new Error("Test error");
      Object.seal(error);

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw error;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle errors with proxy objects", async () => {
      const error = new Error("Test error");
      const proxy = new Proxy(error, {
        get: (target, prop) => {
          if (prop === "message") {
            return "Proxied message";
          }
          return target[prop as keyof Error];
        },
      });

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw proxy;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0];
      expect(passedError.message).toBe("Proxied message");
    });

    it("should handle errors with async stack traces", async () => {
      async function throwError() {
        throw new Error("Async error");
      }

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          await throwError();
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0];
      expect(passedError.stack).toContain("throwError");
    });

    it("should handle errors with multiple async operations", async () => {
      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          await Promise.resolve();
          await Promise.resolve();
          throw new Error("Multi-async error");
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle errors with rejected promises", async () => {
      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          await Promise.reject(new Error("Rejected promise"));
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle errors with multiple rejected promises", async () => {
      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          await Promise.all([
            Promise.reject(new Error("First rejection")),
            Promise.reject(new Error("Second rejection")),
          ]);
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle errors with async generators", async () => {
      async function* asyncGenerator() {
        yield await Promise.resolve(1);
        throw new Error("Generator error");
      }

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          const gen = asyncGenerator();
          await gen.next();
          await gen.next();
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle errors with async iterators", async () => {
      const asyncIterable = {
        [Symbol.asyncIterator]: async function* () {
          yield await Promise.resolve(1);
          throw new Error("Iterator error");
        },
      };

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          for await (const item of asyncIterable) {
            // Just iterate
          }
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
