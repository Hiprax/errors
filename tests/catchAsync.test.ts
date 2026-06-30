import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../src";

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

    it("should wrap regular named functions (not treat as class)", async () => {
      const handler = catchAsync(
        function myHandler(req: Request, res: Response, next: NextFunction) {
          throw new Error("Named function error");
        }
      );

      handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe("Named function error");
    });

    it("should wrap async regular named functions", async () => {
      const handler = catchAsync(
        async function myAsyncHandler(req: Request, res: Response, next: NextFunction) {
          throw new Error("Async named function error");
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe("Async named function error");
    });

    it("should preserve function properties", () => {
      const testFn = function testHandler() {} as any;
      Object.defineProperty(testFn, "name", { value: "testHandler" });
      testFn.customProp = "test";

      const wrapped = catchAsync(testFn);
      expect(wrapped.name).toBe("testHandler");
      expect((wrapped as any).customProp).toBe("test");
    });

    it("should return result from successful sync handler without calling next with error", () => {
      const handler = catchAsync(
        (req: Request, res: Response, next: NextFunction) => {
          res.json({ ok: true });
          return "sync-result";
        }
      );

      const result = handler(mockReq as Request, mockRes as Response, mockNext);
      expect(result).toBe("sync-result");
      expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should not call next with error when async handler resolves successfully", async () => {
      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          await Promise.resolve();
          res.json({ ok: true });
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith({ ok: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should wrap sync non-Error throw with descriptive message", () => {
      const handler = catchAsync(
        (req: Request, res: Response, next: NextFunction) => {
          throw "a string value";
        }
      );

      handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      const passedError = mockNext.mock.calls[0][0] as Error;
      expect(passedError).toBeInstanceOf(Error);
      expect(passedError.message).toContain("Non-Error thrown synchronously");
      expect(passedError.message).toContain("a string value");
    });

    it("should return undefined and not throw when called without a next function", () => {
      const handler = catchAsync(
        (req: Request, res: Response, next: NextFunction) => {
          res.json({ ok: true });
        }
      );

      // Call with a non-function as the last argument
      const result = (handler as any)(mockReq, mockRes, "not-a-function");
      expect(result).toBeUndefined();
    });

    it("should default function name to 'handler' for anonymous arrow functions", () => {
      const wrapped = catchAsync(
        ((_req: Request, _res: Response, _next: NextFunction) => {}) as any
      );
      expect(wrapped.name).toBe("handler");
    });

    it("should only call next once when sync handler calls next explicitly then throws", () => {
      const handler = catchAsync(
        (req: Request, res: Response, next: NextFunction) => {
          next(new Error("Explicit next call"));
          throw new Error("Subsequent throw");
        }
      );

      handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext.mock.calls[0][0].message).toBe("Explicit next call");
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

    it("should safely handle wrapped methods called without a next function (e.g. mutual calls)", () => {
      @catchAsync
      class TestController {
        method1() {
          return this.method2();
        }
        method2() {
          return "result";
        }
      }

      const controller = new TestController();
      // Wrapped methods called without next() as last arg return undefined
      const result = controller.method1();
      expect(result).toBeUndefined();
    });

    it("should skip getter properties on prototype and leave them functional", () => {
      @catchAsync
      class TestController {
        private _value = 42;

        get myGetter() {
          return this._value;
        }

        async testMethod(req: Request, res: Response, next: NextFunction) {
          throw new Error("Test error");
        }
      }

      const controller = new TestController();
      // The getter should still work correctly (not wrapped as a handler)
      expect(controller.myGetter).toBe(42);
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

    it("routes a name-stripped / whitespace-free anonymous class to the class wrapper (minified-controller case)", async () => {
      // `eval` is the only way to produce source that serializes WITHOUT the
      // space after `class` (a formatter would always insert it). This mirrors
      // what terser `-c -m` emits for an anonymous controller class expression.
      const NoSpaceController = eval(
        "(class{ async handle(req, res, next) { throw new Error('boom'); } })"
      ) as new () => {
        handle: (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
      };
      expect(Function.prototype.toString.call(NoSpaceController).startsWith("class{")).toBe(true);

      const Wrapped = catchAsync(NoSpaceController);
      const instance = new Wrapped();

      // (a) The method survived: it was wrapped on the prototype (class branch),
      //     not stripped by being mis-routed to wrapHandler.
      expect(typeof instance.handle).toBe("function");

      // (b) The wrapped method forwards the thrown error to next() exactly once,
      //     and does NOT throw "Class constructors cannot be invoked without 'new'".
      await instance.handle(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe("boom");
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

    it("should throw TypeError for non-function non-null input", () => {
      // @ts-expect-error Testing invalid input
      expect(() => catchAsync(42)).toThrow(TypeError);
      // @ts-expect-error Testing invalid input
      expect(() => catchAsync(42)).toThrow(
        "Target must be a function or a class constructor"
      );
      // @ts-expect-error Testing invalid input
      expect(() => catchAsync("not a function")).toThrow(TypeError);
      // @ts-expect-error Testing invalid input
      expect(() => catchAsync({ key: "value" })).toThrow(TypeError);
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
      const passedError = mockNext.mock.calls[0][0] as any as CustomError;
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
      const passedError = mockNext.mock.calls[0][0] as any;
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
      const passedError = mockNext.mock.calls[0][0] as any;
      expect(passedError.dynamicProp).toBe("private");
    });

    it("should handle errors with Symbol properties", async () => {
      const error = new Error("Test error") as Error & {
        [key: symbol]: string;
      };
      const sym = Symbol("test");
      (error as any)[sym] = "symbol value";

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw error;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0] as Error & {
        [key: symbol]: string;
      };
      expect((passedError as any)[sym]).toBe("symbol value");
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
      const passedError = mockNext.mock.calls[0][0] as any;
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
          return (target as any)[prop as keyof Error];
        },
      });

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          throw proxy as any;
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      const passedError = mockNext.mock.calls[0][0] as any;
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
      const passedError = mockNext.mock.calls[0][0] as Error;
      expect(String(passedError.stack)).toContain("throwError");
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
      } as any;

      const handler = catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
          for await (const _item of asyncIterable) {
            // iterate
          }
        }
      );

      await handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("Class decorator inheritance isolation (Task 2)", () => {
    it("does not mutate the parent class prototype when a subclass is decorated", () => {
      class BaseController {
        async list(req: Request, res: Response, next: NextFunction) {
          return "base-original";
        }
      }

      // Snapshot the original method reference before decoration.
      const originalListRef = BaseController.prototype.list;

      @catchAsync
      class ChildController extends BaseController {}
      // Reference the class so the linter sees a use without disabling rules.
      void ChildController;

      // The parent prototype's method must be unchanged (=== original ref).
      expect(BaseController.prototype.list).toBe(originalListRef);

      // A direct call to the parent class instance method behaves normally
      // (returns the original value, not undefined from the wrapper).
      const baseInstance = new BaseController();
      const directReturn = baseInstance.list(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      // The original async method returns a Promise that resolves to "base-original".
      return Promise.resolve(directReturn).then((value) => {
        expect(value).toBe("base-original");
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    it("does not affect a sibling subclass that shares the same parent", async () => {
      class BaseController {
        async list(_req: Request, _res: Response, _next: NextFunction) {
          return "base-list-result";
        }
      }

      const originalListRef = BaseController.prototype.list;

      @catchAsync
      class DecoratedChild extends BaseController {}
      void DecoratedChild;

      class SiblingChild extends BaseController {
        async show(_req: Request, _res: Response, _next: NextFunction) {
          return "sibling-show";
        }
      }

      // Sibling inherits the *original* method, not a wrapped version.
      expect(SiblingChild.prototype.list).toBe(originalListRef);
      expect(BaseController.prototype.list).toBe(originalListRef);

      // Calling on a sibling instance returns the original value.
      const sibling = new SiblingChild();
      const value = await sibling.list(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(value).toBe("base-list-result");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("wraps inherited methods on the decorated child via shadowing", async () => {
      class BaseController {
        async inheritedAsync(
          _req: Request,
          _res: Response,
          _next: NextFunction
        ) {
          throw new Error("inherited boom");
        }
      }

      @catchAsync
      class ChildController extends BaseController {
        async ownAsync(_req: Request, _res: Response, _next: NextFunction) {
          throw new Error("own boom");
        }
      }

      const child = new ChildController();

      // Inherited method should now route the rejection to next().
      await child.inheritedAsync(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext.mock.calls[0][0]).toBeInstanceOf(Error);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe(
        "inherited boom"
      );

      // Reset and verify own method also still wrapped.
      mockNext.mockReset();
      await child.ownAsync(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe("own boom");

      // Critically: the inherited method on the parent prototype is NOT the
      // same function as the shadow on the child prototype. The child has
      // its own (wrapped) descriptor; the parent retains the original.
      const childOwn = Object.getOwnPropertyDescriptor(
        ChildController.prototype,
        "inheritedAsync"
      );
      const parentOwn = Object.getOwnPropertyDescriptor(
        BaseController.prototype,
        "inheritedAsync"
      );
      expect(childOwn).toBeDefined();
      expect(parentOwn).toBeDefined();
      expect(childOwn!.value).not.toBe(parentOwn!.value);
    });
  });

  describe("Idempotence guard (Task 10)", () => {
    it("returns the same wrapper when catchAsync is applied twice to a function", () => {
      const handler = (req: Request, res: Response, next: NextFunction) => {
        next();
      };
      const once = catchAsync(handler);
      const twice = catchAsync(once);
      expect(twice).toBe(once);
    });

    it("does not add a second wrapper layer (call still produces single next call)", async () => {
      const inner = jest.fn(
        async (_req: Request, _res: Response, _next: NextFunction) => {
          throw new Error("once-only");
        }
      );
      const wrappedOnce = catchAsync(inner);
      const wrappedTwice = catchAsync(wrappedOnce);
      // Idempotence: re-wrapping should yield the same reference.
      expect(wrappedTwice).toBe(wrappedOnce);

      await wrappedTwice(mockReq as Request, mockRes as Response, mockNext);
      // Underlying handler runs exactly once.
      expect(inner).toHaveBeenCalledTimes(1);
      // next() is invoked exactly once with the error.
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe("once-only");
    });

    it("does not double-wrap class methods when the decorator is applied twice", async () => {
      @catchAsync
      class TwiceDecoratedController {
        async work(_req: Request, _res: Response, _next: NextFunction) {
          throw new Error("twice-decorated boom");
        }
      }

      const firstMethodRef = TwiceDecoratedController.prototype.work;

      // Re-apply the decorator function-style to the same class.
      const SameClass = catchAsync(TwiceDecoratedController);
      expect(SameClass).toBe(TwiceDecoratedController);

      // Method reference must be unchanged after the second decoration.
      expect(TwiceDecoratedController.prototype.work).toBe(firstMethodRef);

      const instance = new TwiceDecoratedController();
      await instance.work(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Single call to next() with the original error — no double-wrap echo.
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe(
        "twice-decorated boom"
      );
    });
  });

  describe("Decorator signature compatibility (Task 14c)", () => {
    it("legacy decorator call (single argument) wraps the class", async () => {
      class LegacyController {
        async legacyMethod(_req: Request, _res: Response, _next: NextFunction) {
          throw new Error("legacy boom");
        }
      }

      // Manual / legacy call shape: catchAsync(MyClass)
      const Wrapped = catchAsync(LegacyController);
      expect(Wrapped).toBe(LegacyController);

      const instance = new LegacyController();
      await instance.legacyMethod(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe("legacy boom");
    });

    it("stage-3 decorator call shape wraps methods", async () => {
      class Stage3Controller {
        async stage3Method(_req: Request, _res: Response, _next: NextFunction) {
          throw new Error("stage-3 boom");
        }
      }

      // Simulate the stage-3 decorator call shape that TS 5.x emits when
      // `experimentalDecorators` is false. The runtime ignores `context`,
      // but the call must be type-compatible with the new overload.
      const fakeContext: ClassDecoratorContext = {
        kind: "class",
        name: "Stage3Controller",
        addInitializer: () => {},
        metadata: {},
      } as unknown as ClassDecoratorContext;

      const Wrapped = catchAsync(Stage3Controller, fakeContext);
      expect(Wrapped).toBe(Stage3Controller);

      const instance = new Stage3Controller();
      await instance.stage3Method(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      // Method was wrapped: the throw was forwarded to next() once.
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe("stage-3 boom");
    });

    it("stage-3 call ignores the context argument", () => {
      class IgnoresContext {
        async ping(_req: Request, _res: Response, _next: NextFunction) {
          /* no-op */
        }
      }

      // Pass an arbitrary value as context; runtime must not consult it.
      const result = catchAsync(IgnoresContext, {
        kind: "class",
        name: "IgnoresContext",
        addInitializer: () => {},
      } as any);

      expect(result).toBe(IgnoresContext);
      // Method on the prototype was replaced with a wrapped version.
      expect(typeof IgnoresContext.prototype.ping).toBe("function");
    });

    it("stage-3 decorator double-application stays idempotent", () => {
      class DoubleStage3 {
        async run(_req: Request, _res: Response, _next: NextFunction) {
          /* no-op */
        }
      }

      const ctx = {
        kind: "class",
        name: "DoubleStage3",
        addInitializer: () => {},
      } as any;

      const first = catchAsync(DoubleStage3, ctx);
      const firstMethodRef = DoubleStage3.prototype.run;
      const second = catchAsync(first, ctx);

      expect(second).toBe(first);
      // Method reference is unchanged after the second decoration.
      expect(DoubleStage3.prototype.run).toBe(firstMethodRef);
    });
  });

  describe("Arity preservation (Task 9)", () => {
    // Express's `app.use` distinguishes a normal request handler from an error
    // handler purely by `Function.length` (3 vs 4). The wrapper produced by
    // `catchAsync` MUST report the correct arity or registering
    // `catchAsync(errorHandler)` silently breaks every consumer's error
    // routing. These tests lock that contract in.

    it("preserves arity 3 for a (req, res, next) request handler", () => {
      const handler = catchAsync(
        (_req: Request, _res: Response, _next: NextFunction) => {
          /* no-op */
        }
      );
      expect(handler.length).toBe(3);
    });

    it("preserves arity 3 for an async (req, res, next) request handler", () => {
      const handler = catchAsync(
        async (_req: Request, _res: Response, _next: NextFunction) => {
          /* no-op */
        }
      );
      expect(handler.length).toBe(3);
    });

    it("preserves arity 4 for an (err, req, res, next) error handler", () => {
      const handler = catchAsync(
        (
          _err: any,
          _req: Request,
          _res: Response,
          _next: NextFunction
        ) => {
          /* no-op */
        }
      );
      expect(handler.length).toBe(4);
    });

    it("preserves arity 4 for an async (err, req, res, next) error handler", () => {
      const handler = catchAsync(
        async (
          _err: any,
          _req: Request,
          _res: Response,
          _next: NextFunction
        ) => {
          /* no-op */
        }
      );
      expect(handler.length).toBe(4);
    });

    it("normalizes arity to 3 for a (req, res) handler whose declared length is 2", () => {
      const inputFn = ((_req: Request, _res: Response) => {
        /* no-op */
      }) as any;
      // Sanity-check the input arity so the test fails informatively if the
      // TS compiler ever transforms parameters in a way that changes .length.
      expect(inputFn.length).toBe(2);
      const handler = catchAsync(inputFn);
      expect(handler.length).toBe(3);
    });

    it("normalizes arity to 3 for a variadic (...args) handler whose declared length is 0", () => {
      const inputFn = ((..._args: any[]) => {
        /* no-op */
      }) as any;
      // A rest parameter contributes 0 to Function.length per the spec.
      expect(inputFn.length).toBe(0);
      const handler = catchAsync(inputFn);
      expect(handler.length).toBe(3);
    });

    it("preserves arity 4 for a handler with a leading positional then rest (declared length 1)", () => {
      // (err, ...rest) reports length === 1, but it is *not* a length>=4 case,
      // so the wrapper falls into the 3-arg branch. This test documents that
      // exact behavior so anyone widening arity detection knows the contract.
      const inputFn = ((_err: any, ..._rest: any[]) => {
        /* no-op */
      }) as any;
      expect(inputFn.length).toBe(1);
      const handler = catchAsync(inputFn);
      // Per the implementation, only fn.length >= 4 yields a 4-arg wrapper.
      expect(handler.length).toBe(3);
    });
  });

  describe("Defensive coverage (hostile inputs)", () => {
    it("ignores a second next() call from the user handler (hasCalledNext guard)", async () => {
      // Locks in the `if (hasCalledNext) return;` early-return inside the
      // wrapped next. A buggy handler that calls next twice must not result
      // in two next() invocations downstream.
      const handler = catchAsync(
        (req: Request, res: Response, next: NextFunction) => {
          next(new Error("first"));
          next(new Error("second"));
        }
      );

      handler(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe("first");
    });

    it("skips a child's own method that was already wrapped before decoration", async () => {
      // Lock in the early-`continue` branch in the own-prototype loop:
      // when a method on the decorated class is already catchAsync-wrapped,
      // the decorator must leave it alone rather than wrap it twice.
      class Controller {}
      const inner = jest.fn(
        async (_req: Request, _res: Response, _next: NextFunction) => {
          throw new Error("pre-wrapped boom");
        }
      );
      const preWrapped = catchAsync(inner);
      (Controller.prototype as any).preWrapped = preWrapped;

      const Decorated = catchAsync(Controller);
      // The reference on the prototype is preserved (no re-wrap occurred).
      expect((Decorated.prototype as any).preWrapped).toBe(preWrapped);

      const instance = new (Decorated as any)();
      await instance.preWrapped(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      // Single call to next — the handler ran exactly once, no double dispatch.
      expect(inner).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe(
        "pre-wrapped boom"
      );
    });

    it("does not shadow a parent method when the child overrides it with the same name", async () => {
      // Locks the `if (targetPrototype.hasOwnProperty(key)) continue;`
      // branch in the parent-walk loop. Without it, a child override would
      // be replaced by a wrapped copy of the parent method.
      class Parent {
        async shared(_req: Request, _res: Response, _next: NextFunction) {
          return "parent-shared";
        }
      }

      @catchAsync
      class Child extends Parent {
        async shared(_req: Request, _res: Response, _next: NextFunction) {
          return "child-shared";
        }
      }

      const child = new Child();
      const value = await child.shared(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
      expect(value).toBe("child-shared");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("reuses a parent-wrapped method by reference when the child is decorated", async () => {
      // The parent class is NOT decorated, but one of its prototype methods
      // was wrapped manually (e.g., a router helper applied catchAsync to
      // it before installing it on the prototype). When the decorator on
      // the child walks the parent's prototype, the inherited method is
      // already WRAPPED — the shadow must reuse the same reference rather
      // than wrap it a second time. Locks the "already wrapped" arm of
      // `isAlreadyWrapped(originalMethod) ? originalMethod : wrapHandler(...)`.
      class Parent {}
      const preWrappedParentMethod = catchAsync(
        async function work(
          _req: Request,
          _res: Response,
          _next: NextFunction
        ) {
          throw new Error("parent pre-wrapped boom");
        }
      );
      (Parent.prototype as any).work = preWrappedParentMethod;

      @catchAsync
      class Child extends Parent {}

      // Child should now have its own shadowed descriptor for `work`,
      // pointing at the EXACT same wrapped function (no extra wrap layer).
      const childOwn = Object.getOwnPropertyDescriptor(
        Child.prototype,
        "work"
      );
      expect(childOwn).toBeDefined();
      expect(childOwn!.value).toBe(preWrappedParentMethod);

      const child = new (Child as any)();
      await child.work(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect((mockNext.mock.calls[0][0] as Error).message).toBe(
        "parent pre-wrapped boom"
      );
    });

    it("skips non-function properties on the parent prototype during the parent walk", async () => {
      // The parent walk only shadows callable members. Data properties on
      // the parent prototype (constants, accessors backing fields, etc.)
      // must NOT be copied onto the child as own properties. Locks the
      // `!isFunction(descriptor.value)` branch in the parent-walk filter.
      class Parent {
        async work(_req: Request, _res: Response, _next: NextFunction) {
          throw new Error("inherited boom");
        }
      }
      (Parent.prototype as any).version = "1.0";
      (Parent.prototype as any).config = { debug: true };

      @catchAsync
      class Child extends Parent {}

      // Function methods are shadowed onto child:
      expect(
        Object.getOwnPropertyDescriptor(Child.prototype, "work")
      ).toBeDefined();
      // Data properties are NOT shadowed:
      expect(
        Object.getOwnPropertyDescriptor(Child.prototype, "version")
      ).toBeUndefined();
      expect(
        Object.getOwnPropertyDescriptor(Child.prototype, "config")
      ).toBeUndefined();

      // Sanity: the child still sees the inherited data via prototype lookup.
      const child = new Child() as any;
      expect(child.version).toBe("1.0");
      expect(child.config.debug).toBe(true);
    });

    it("treats a Proxy whose WRAPPED-symbol read throws as not-yet-wrapped", () => {
      // Triggers the catch in `isAlreadyWrapped` when `value[WRAPPED]` throws.
      // Without the guard, `catchAsync` would propagate a hostile getter
      // throw out of the wrapper construction step.
      const WRAPPED = Symbol.for("@hiprax/errors:catchAsync.wrapped");
      const inner = function hostile(
        _req: Request,
        _res: Response,
        next: NextFunction
      ) {
        next();
      };
      const proxy = new Proxy(inner, {
        get(target, prop, receiver) {
          if (prop === WRAPPED) {
            throw new Error("hostile WRAPPED getter");
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      expect(() => catchAsync(proxy as any)).not.toThrow();
      const wrapped = catchAsync(proxy as any) as any;
      expect(typeof wrapped).toBe("function");
      // The wrapper itself behaves normally: invoking it forwards to next.
      wrapped(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});
