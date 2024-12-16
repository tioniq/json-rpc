/// Error codes defined in the [JSON-RPC 2.0 specification][spec].
///
/// These codes are generally used for protocol-level communication. Most of
/// them shouldn't be used by the application. Those that should have
/// convenience constructors in [RpcException].
///
/// [spec]: http://www.jsonrpc.org/specification#error_object

/**
 * An error code indicating that invalid JSON was received by the server.
 */
export const PARSE_ERROR = -32700

/**
 * An error code indicating that the request JSON was invalid according to the JSON-RPC 2.0 spec.
 */
export const INVALID_REQUEST = -32600

/**
 * An error code indicating that the requested method does not exist or is unavailable.
 */
export const METHOD_NOT_FOUND = -32601

/**
 * An error code indicating that the request parameters are invalid for the requested method.
 */
export const INVALID_PARAMS = -32602

/**
 * An internal JSON-RPC error.
 */
export const INTERNAL_ERROR = -32603

/**
 * An unexpected error occurred on the server.
 * The spec reserves the range from -32000 to -32099 for implementation-defined
 * server exceptions, but for now we only use one of those values.
 */
export const SERVER_ERROR = -32000 // 32000 to -32099

/**
 * Returns a human-readable name for [errorCode] if it's one specified by the JSON-RPC 2.0 spec.
 * If {@link errorCode} isn't defined in the JSON-RPC 2.0 spec, returns null.
 */
export function errorName(errorCode: number): string | null {
  switch (errorCode) {
    case PARSE_ERROR:
      return "Parse error"
    case INVALID_REQUEST:
      return "Invalid request"
    case METHOD_NOT_FOUND:
      return "Method not found"
    case INVALID_PARAMS:
      return "Invalid parameters"
    case INTERNAL_ERROR:
      return "Internal error"
  }
  if (errorCode >= -32099 && errorCode <= -32000) {
    return "Server error"
  }
  return null
}
