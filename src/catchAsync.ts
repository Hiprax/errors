/* eslint-disable @typescript-eslint/no-explicit-any --
 * `any` is used throughout this file by design: Express handler signatures
 * (err: any), variadic Function.apply payloads (...args: any[]), and the
 * generic class-constructor type (new (...args: any[]) => any) all require
 * `any` to remain compatible with arbitrary user-defined controllers and
 * middleware shapes.
 */
import type {
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
  Request,
  Response,
} from "express";

/**
 * Union type for any Express request or error handler.
 * More specific than the previous implementation.
 */
type AnyRequestHandler =
  | RequestHandler
  | ErrorRequestHandler
  | ((req: Request, res: Response, next: NextFunction) => Promise<any>)
  | ((
      err: any,
      req: Request,
      res: Response,
      next: NextFunction
    ) => Promise<any>);

/**
 * Symbol marker used to detect functions/classes already wrapped by catchAsync.
 * `Symbol.for(...)` ensures the marker is shared across realms / multiple loaded
 * copies of the package (e.g., in monorepos), so the idempotence guard remains
 * effective even when more than one instance of `@hiprax/errors` is present in
 * the same process.
 */
const WRAPPED: symbol = Symbol.for("@hiprax/errors:catchAsync.wrapped");

/**
 * Returns true when the given value has already been wrapped by catchAsync.
 *
 * @param value Any value (typically a function or class).
 * @returns True if the value carries the WRAPPED marker.
 */
function isAlreadyWrapped(value: unknown): boolean {
  /* istanbul ignore next -- defensive: every internal call site
   * (`wrapHandler`, `wrapControllerClass`, public `catchAsync` entry) has
   * already filtered null/undefined and primitive values before reaching
   * this helper. */
  if (value == null) return false;
  /* istanbul ignore next -- defensive: same reason as above; primitives
   * never reach this helper through the public API. */
  if (typeof value !== "function" && typeof value !== "object") return false;
  try {
    return (value as Record<symbol, unknown>)[WRAPPED] === true;
  } catch {
    return false;
  }
}

/**
 * Marks a function or class as wrapped by catchAsync. Used by the idempotence
 * guard in `wrapHandler` and `wrapControllerClass` so subsequent calls become
 * no-ops instead of producing nested wrappers.
 *
 * @param value The function or class to mark.
 */
function markWrapped(value: object): void {
  try {
    Object.defineProperty(value, WRAPPED, {
      value: true,
      enumerable: false,
      configurable: true,
      writable: false,
    });
  } catch {
    // Frozen/sealed targets cannot be marked. The guard simply degrades
    // gracefully by performing the wrap again on subsequent calls.
  }
}

/**
 * Checks if a value is a function.
 * @param fn The value to check.
 * @returns True if the value is a function, false otherwise.
 */
function isFunction(fn: unknown): fn is Function {
  return typeof fn === "function";
}

/**
 * Checks if a function is a class constructor by inspecting its string representation.
 * This is the reliable ES2022+ way to detect class constructors, since duck-typing
 * (checking for .prototype) is true for ALL regular (non-arrow) functions.
 *
 * The pattern `/^class[\s{]/` matches both the spaced form (`class Foo {`, `class {`)
 * and the name-stripped/whitespace-free anonymous form (`class{`) that minifiers such
 * as terser emit for controller class expressions.
 *
 * @param fn The function to check.
 * @returns True if the function is a class constructor, false otherwise.
 */
function isClassConstructor(fn: Function): boolean {
  try {
    return /^class[\s{]/.test(Function.prototype.toString.call(fn));
  } catch {
    /* istanbul ignore next -- defensive: Function.prototype.toString.call
     * uses internal slots and does not throw for any value that passed the
     * caller's `isFunction` check. Kept for safety against monkey-patched
     * Function.prototype.toString in exotic realms. */
    return false;
  }
}

/**
 * Wraps an Express middleware function (sync or async) so that any thrown errors
 * or rejected promises are automatically passed to the next() function.
 * Preserves function arity and name for Express routing compatibility.
 *
 * This wrapper handles both RequestHandler (3 args: req, res, next)
 * and ErrorRequestHandler (4 args: err, req, res, next).
 *
 * @param fn The original Express request or error handler.
 * @returns The wrapped handler function.
 */
function wrapHandler<Fn extends AnyRequestHandler>(fn: Fn): Fn {
  /* istanbul ignore if -- defensive: every public call site (`catchAsync`,
   * `wrapControllerClass`) checks `isFunction` before calling wrapHandler. */
  if (!isFunction(fn)) {
    return fn;
  }

  // Idempotence guard: if the input is already a catchAsync-wrapped handler,
  // returning it unchanged avoids producing nested wrappers (which would cost
  // an extra stack frame per call and run two error normalizations on every
  // throw — see Task 10 in FIX.md).
  if (isAlreadyWrapped(fn)) {
    return fn;
  }

  const createInvoker = () => {
    return function invoke(this: unknown, ...args: unknown[]) {
      let hasCalledNext = false;
      const maybeNext = args[args.length - 1];
      if (!isFunction(maybeNext)) {
        // If there is no valid next function (e.g., method invoked directly),
        // do nothing to avoid throwing and to prevent accidental recursion.
        return undefined;
      }
      const next = maybeNext as NextFunction;

      const wrappedNext = (...nextArgs: any[]) => {
        if (hasCalledNext) {
          return;
        }
        hasCalledNext = true;
        return next(...nextArgs);
      };

      // Replace the original next with our wrapped version
      args[args.length - 1] = wrappedNext;

      try {
        const result = (fn as Function).apply(this, args);
        if (result && typeof (result as any).then === "function") {
          return (result as Promise<any>).catch((err) => {
            if (!hasCalledNext) {
              const errorToPass =
                err instanceof Error
                  ? err
                  : new Error(`Non-Error thrown/rejected: ${String(err)}`);
              wrappedNext(errorToPass);
            }
            return undefined;
          });
        }
        return result;
      } catch (err) {
        if (!hasCalledNext) {
          const errorToPass =
            err instanceof Error
              ? err
              : new Error(`Non-Error thrown synchronously: ${String(err)}`);
          wrappedNext(errorToPass);
        }
        return undefined;
      }
    };
  };

  const invoker = createInvoker();

  // Preserve Express arity by creating wrappers with 3 or 4 parameters
  let wrapped: Function;
  if (fn.length >= 4) {
    wrapped = function (
      this: unknown,
      err: any,
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      return (invoker as any).call(this, err, req, res, next);
    };
  } else {
    wrapped = function (
      this: unknown,
      req: Request,
      res: Response,
      next: NextFunction
    ) {
      return (invoker as any).call(this, req, res, next);
    };
  }

  // Preserve function name from the original
  try {
    Object.defineProperty(wrapped, "name", {
      value: fn.name || "handler",
      configurable: true,
    });
  } catch {}

  // Copy any other properties from the original function
  const skipProps = new Set(["length", "name", "prototype", "arguments", "caller"]);
  const originalProps = Object.getOwnPropertyNames(fn);
  for (const prop of originalProps) {
    if (!skipProps.has(prop)) {
      const descriptor = Object.getOwnPropertyDescriptor(fn, prop);
      /* istanbul ignore else -- Object.getOwnPropertyDescriptor returns a
       * descriptor for any key listed by Object.getOwnPropertyNames on a
       * regular object. The else-branch only fires for exotic Proxy targets
       * whose `getOwnPropertyDescriptor` trap disagrees with `ownKeys`. */
      if (descriptor) {
        try {
          Object.defineProperty(wrapped, prop, {
            ...descriptor,
            configurable: true,
          });
        } catch {}
      }
    }
  }

  // Tag the wrapper so a subsequent `catchAsync(wrapped)` becomes a no-op.
  markWrapped(wrapped);

  return wrapped as Fn;
}

/**
 * Wraps all own methods on the prototype of a controller class with the
 * async handler wrapper. This is intended for use as a class decorator.
 *
 * Inheritance behavior:
 *  - Methods defined directly on the decorated class' prototype are wrapped
 *    in place (shadowing is unnecessary because they already live on the
 *    target prototype).
 *  - Methods inherited from a parent class are NOT modified on the parent
 *    prototype. Instead, a wrapped version is installed as an own property on
 *    the decorated child's prototype, where it shadows the inherited method.
 *    This keeps the parent class — and any sibling subclasses sharing it —
 *    untouched.
 *
 * @param constructor The class constructor function.
 * @returns The same constructor function, with methods modified.
 */
function wrapControllerClass<T extends new (...args: any[]) => any>(
  constructor: T
): T {
  /* istanbul ignore if -- defensive: only reached via the public `catchAsync`
   * after `isClassConstructor` returned true, which implies `isFunction`. */
  if (!isFunction(constructor)) {
    return constructor;
  }

  /* istanbul ignore if -- defensive: ES class constructors always have a
   * prototype object. Guard preserves safety if a future refactor allows
   * non-class callables through. */
  if (!constructor.prototype) {
    return constructor;
  }

  // Idempotence guard: re-decorating the same class is a no-op (Task 10).
  if (isAlreadyWrapped(constructor)) {
    return constructor;
  }

  const targetPrototype = constructor.prototype as object;

  // ---- Step 1: wrap own methods on the target prototype in place. ----
  const ownNames = Object.getOwnPropertyNames(targetPrototype);
  for (const key of ownNames) {
    if (key === "constructor") continue;
    const descriptor = Object.getOwnPropertyDescriptor(targetPrototype, key);
    if (!descriptor || !isFunction(descriptor.value)) continue;
    const originalMethod = descriptor.value as AnyRequestHandler;
    if (isAlreadyWrapped(originalMethod)) continue;
    const wrappedMethod = wrapHandler(originalMethod);
    Object.defineProperty(targetPrototype, key, {
      ...descriptor,
      value: wrappedMethod,
    });
  }

  // ---- Step 2: walk parent prototypes and SHADOW inherited methods on
  // the child's prototype. Parent prototypes are read-only here. ----
  // The WeakSet protects against pathological prototype chains that loop
  // back on themselves; it is per-decoration, not a global "I touched this
  // prototype" guard, so unrelated decorations do not interfere.
  const visitedParents = new WeakSet<object>();
  let parentPrototype: object | null = Object.getPrototypeOf(targetPrototype);

  while (
    parentPrototype &&
    parentPrototype !== Object.prototype &&
    !visitedParents.has(parentPrototype)
  ) {
    visitedParents.add(parentPrototype);

    const parentNames = Object.getOwnPropertyNames(parentPrototype);
    for (const key of parentNames) {
      if (key === "constructor") continue;
      // Don't shadow if the child (or a closer ancestor we already shadowed
      // onto the child) already has its own descriptor for this key.
      if (Object.prototype.hasOwnProperty.call(targetPrototype, key)) continue;

      const descriptor = Object.getOwnPropertyDescriptor(
        parentPrototype,
        key
      );
      if (!descriptor || !isFunction(descriptor.value)) continue;

      const originalMethod = descriptor.value as AnyRequestHandler;
      // Inherited method is already wrapped (e.g., parent was decorated):
      // copy the same reference onto the child without re-wrapping.
      const wrappedMethod = isAlreadyWrapped(originalMethod)
        ? originalMethod
        : wrapHandler(originalMethod);

      // Install the wrapped version on the CHILD prototype only.
      Object.defineProperty(targetPrototype, key, {
        ...descriptor,
        value: wrappedMethod,
      });
    }

    parentPrototype = Object.getPrototypeOf(parentPrototype);
  }

  // Tag the constructor so re-decorating becomes a no-op (Task 10).
  markWrapped(constructor);

  return constructor;
}

/**
 * Function overloads for catchAsync.
 * This allows using catchAsync as a function wrapper or a class decorator.
 */

/**
 * Use as a legacy / experimental (TS `experimentalDecorators: true`) class
 * decorator to wrap all own methods on the prototype of an Express controller
 * class. This overload also covers the manual call-site
 * `catchAsync(MyClass)`.
 *
 * @example
 * import { Request, Response } from 'express';
 * import { catchAsync } from './catchAsync'; // Adjust path
 *
 * // Apply the decorator to the class
 * @catchAsync
 * class UserController {
 *   // Methods will automatically be wrapped
 *   async getUsers(req: Request, res: Response) {
 *     // Simulate an async operation that might fail
 *     if (Math.random() > 0.5) {
 *        throw new Error("Failed to fetch users!");
 *     }
 *     res.json([{ id: 1, name: 'User 1' }]);
 *   }
 *
 *   // Sync methods are also handled
 *   getUserById(req: Request, res: Response) {
 *      // Simulate a sync error
 *      if (!req.params.id) {
 *         throw new Error("User ID is required");
 *      }
 *      res.json({ id: req.params.id, name: 'User ' + req.params.id });
 *   }
 * }
 * // To use in Express, you'd typically instantiate the class
 * // and use its methods as middleware/handlers:
 * // const userController = new UserController();
 * // router.get('/users', userController.getUsers);
 * // router.get('/users/:id', userController.getUserById);
 *
 * @param constructor The class constructor function.
 */
export function catchAsync<T extends new (...args: any[]) => any>(
  constructor: T
): T;

/**
 * Use as a stage-3 ECMAScript class decorator (TypeScript 5.x default,
 * `experimentalDecorators: false`). The runtime ignores `context` — the
 * second argument exists only to satisfy the modern decorator contract:
 * `(value, context: ClassDecoratorContext) => value`.
 *
 * The same `@catchAsync class Foo {}` syntax compiles cleanly under both
 * legacy and stage-3 decorator modes thanks to this overload.
 *
 * @param value The class constructor function being decorated.
 * @param context The stage-3 ClassDecoratorContext supplied by the runtime.
 */
export function catchAsync<T extends new (...args: any[]) => any>(
  value: T,
  context: ClassDecoratorContext
): T;

/**
 * Use as a function wrapper for a single Express middleware or error handler.
 * Ensures that rejected promises or thrown errors are passed to `next()`.
 *
 * @example
 * import { Request, Response, NextFunction } from 'express';
 * import { catchAsync } from './catchAsync'; // Adjust path
 *
 * router.get('/posts/:id', catchAsync(async (req: Request, res: Response, next: NextFunction) => {
 *   const post = await PostModel.findById(req.params.id);
 *   if (!post) {
 *     // Standard way to pass errors to next
 *     return next(new Error('Post not found'));
 *   }
 *   // Simulate an async operation that might reject
 *   await Promise.reject(new Error('Database connection failed'));
 *   res.json(post); // This line won't be reached if promise rejects
 * }));
 *
 * router.use(catchAsync((err: Error, req: Request, res: Response, next: NextFunction) => {
 *    console.error("Caught by error handler:", err);
 *    res.status(500).send('An error occurred');
 * }));
 *
 * @param fn The Express request handler or error handler function.
 */
export function catchAsync<Fn extends AnyRequestHandler>(fn: Fn): Fn;

/**
 * Dual-purpose utility that wraps Express middleware functions to handle
 * async errors, or is used as a class decorator to wrap controller methods.
 *
 * The correct usage is inferred from the type of the first argument provided.
 *
 * The optional second argument (`_context`) is accepted to satisfy the
 * stage-3 ECMAScript class decorator contract — TypeScript 5.x calls a class
 * decorator as `decorator(value, context: ClassDecoratorContext)`. The
 * runtime ignores it; the same code path drives legacy decorators
 * (`experimentalDecorators: true`), stage-3 decorators, and manual
 * `catchAsync(MyClass)` calls.
 *
 * @param target The function (middleware/handler) or class constructor to wrap.
 * @param _context Optional decorator context (stage-3 only); ignored at runtime.
 * @returns The wrapped function or class.
 * @throws {TypeError} If the target is neither a function nor a class constructor.
 */
export function catchAsync(
  target: Function | (new (...args: any[]) => any),
  _context?: unknown
): any {
  // Handle null/undefined inputs
  if (target == null) {
    return target;
  }

  // Use string-based detection to reliably distinguish class constructors
  // from regular functions. Duck-typing (checking .prototype) fails because
  // all regular (non-arrow) functions also have a prototype object.
  if (isFunction(target) && isClassConstructor(target)) {
    return wrapControllerClass(target as new (...args: any[]) => any);
  }

  // If it's not a class constructor, it must be a function.
  if (isFunction(target)) {
    return wrapHandler(target as AnyRequestHandler);
  }

  throw new TypeError("Target must be a function or a class constructor");
}
