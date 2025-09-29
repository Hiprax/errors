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
 * Checks if a value is a function.
 * @param fn The value to check.
 * @returns True if the value is a function, false otherwise.
 */
function isFunction(fn: unknown): fn is Function {
  return typeof fn === "function";
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
  if (!isFunction(fn)) {
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
  const originalProps = Object.getOwnPropertyNames(fn);
  for (const prop of originalProps) {
    if (prop !== "length" && prop !== "name") {
      const descriptor = Object.getOwnPropertyDescriptor(fn, prop);
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

  return wrapped as Fn;
}

/**
 * Wraps all own methods on the prototype of a controller class with the
 * async handler wrapper. This is intended for use as a class decorator.
 *
 * @param constructor The class constructor function.
 * @returns The same constructor function, with methods modified.
 */
function wrapControllerClass<T extends new (...args: any[]) => any>(
  constructor: T
): T {
  // Check if target is actually a function (a class constructor is a function)
  if (!isFunction(constructor)) {
    return constructor;
  }

  // Check if it has a prototype (typical for classes/constructors)
  if (!constructor.prototype) {
    return constructor;
  }

  // Track processed prototypes to avoid circular dependencies
  const processedPrototypes = new WeakSet();

  function processPrototype(prototype: object) {
    if (processedPrototypes.has(prototype)) {
      return;
    }
    processedPrototypes.add(prototype);

    // Get all property names including non-enumerable ones
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const key of propertyNames) {
      // Skip the constructor itself
      if (key === "constructor") continue;

      const descriptor = Object.getOwnPropertyDescriptor(prototype, key);

      // Skip properties that don't exist, aren't functions, or are getters/setters
      if (descriptor && isFunction(descriptor.value)) {
        // Wrap the method using the handler wrapper
        const originalMethod = descriptor.value as AnyRequestHandler;
        const wrappedMethod = wrapHandler(originalMethod);

        // Replace the original method on the prototype with the wrapped version
        Object.defineProperty(prototype, key, {
          ...descriptor,
          value: wrappedMethod,
        });
      }
    }

    // Process the prototype chain
    const parentPrototype = Object.getPrototypeOf(prototype);
    if (parentPrototype && parentPrototype !== Object.prototype) {
      processPrototype(parentPrototype);
    }
  }

  processPrototype(constructor.prototype);

  return constructor;
}

/**
 * Function overloads for catchAsync.
 * This allows using catchAsync as a function wrapper or a class decorator.
 */

/**
 * Use as a class decorator to wrap all own methods on the prototype
 * of an Express controller class.
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
 * The correct usage is inferred from the type of the single argument provided.
 *
 * @param target The function (middleware/handler) or class constructor to wrap.
 * @returns The wrapped function or class.
 * @throws {TypeError} If the target is neither a function nor a class constructor.
 */
export function catchAsync(
  target: Function | (new (...args: any[]) => any)
): any {
  // Handle null/undefined inputs
  if (target == null) {
    return target;
  }

  // Duck typing to determine if 'target' is likely a class constructor.
  // A class constructor is a function, and typically has a 'prototype' property
  // which is an object. This is the standard way to detect old-style decorators.
  if (
    isFunction(target) &&
    target.prototype &&
    typeof target.prototype === "object"
  ) {
    return wrapControllerClass(target as new (...args: any[]) => any);
  }

  // If it's not a class constructor, it must be a function.
  if (isFunction(target)) {
    return wrapHandler(target as AnyRequestHandler);
  }

  throw new TypeError("Target must be a function or a class constructor");
}
