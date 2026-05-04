/**
 * A mapping of common HTTP status codes to their respective descriptions.
 * Used for consistent error messages throughout the application.
 *
 * The exported value is a frozen, mutation-rejecting facade over a real `Map`.
 * It is typed as `ReadonlyMap<number, string>` so TypeScript consumers cannot
 * call `.set/.delete/.clear`. At runtime the same three mutation methods are
 * overridden to throw, preventing a misbehaving downstream package from
 * corrupting the library's single source of truth for HTTP status codes.
 *
 * Read-only operations (`.get`, `.has`, `.size`, iteration, `.keys`, `.values`,
 * `.entries`, `.forEach`) continue to work exactly like a normal `Map`.
 *
 * @constant
 * @type {ReadonlyMap<number, string>}
 */
const internalErrorCodes = new Map<number, string>([
  [400, "Bad Request"],
  [401, "Unauthorized"],
  [402, "Payment Required"],
  [403, "Forbidden"],
  [404, "Not Found"],
  [405, "Method Not Allowed"],
  [406, "Not Acceptable"],
  [407, "Proxy Authentication Required"],
  [408, "Request Timeout"],
  [409, "Conflict"],
  [410, "Gone"],
  [411, "Length Required"],
  [412, "Precondition Failed"],
  [413, "Payload Too Large"],
  [414, "URI Too Long"],
  [415, "Unsupported Media Type"],
  [416, "Range Not Satisfiable"],
  [417, "Expectation Failed"],
  [418, "I'm a teapot"],
  [421, "Misdirected Request"],
  [422, "Unprocessable Content"],
  [423, "Locked"],
  [424, "Failed Dependency"],
  [425, "Too Early"],
  [426, "Upgrade Required"],
  [428, "Precondition Required"],
  [429, "Too Many Requests"],
  [431, "Request Header Fields Too Large"],
  [451, "Unavailable For Legal Reasons"],
  [500, "Internal Server Error"],
  [501, "Not Implemented"],
  [502, "Bad Gateway"],
  [503, "Service Unavailable"],
  [504, "Gateway Timeout"],
  [505, "HTTP Version Not Supported"],
  [506, "Variant Also Negotiates"],
  [507, "Insufficient Storage"],
  [508, "Loop Detected"],
  [510, "Not Extended"],
  [511, "Network Authentication Required"],
]);

const MUTATION_ERROR_MESSAGE =
  "@hiprax/errors: errorCodes is read-only. Mutating it would corrupt every " +
  "ErrorHandler instance in the process. Build your own Map if you need a " +
  "mutable lookup.";

// Override the three mutation methods in place so that even consumers who
// reach past TypeScript and access the runtime `set`/`delete`/`clear` methods
// cannot corrupt the shared map. We deliberately keep the original `Map`
// prototype chain so that `instanceof Map` continues to hold and existing
// users relying on `.has`/`.get`/iteration are not affected.
const rejectMutation = (method: string): never => {
  throw new TypeError(`${MUTATION_ERROR_MESSAGE} (attempted: ${method})`);
};

Object.defineProperties(internalErrorCodes, {
  set: {
    value: function set(): never {
      return rejectMutation("set");
    },
    writable: false,
    configurable: false,
    enumerable: false,
  },
  delete: {
    value: function deleteMethod(): never {
      return rejectMutation("delete");
    },
    writable: false,
    configurable: false,
    enumerable: false,
  },
  clear: {
    value: function clear(): never {
      return rejectMutation("clear");
    },
    writable: false,
    configurable: false,
    enumerable: false,
  },
});

const errorCodes: ReadonlyMap<number, string> = internalErrorCodes;

export default errorCodes;
