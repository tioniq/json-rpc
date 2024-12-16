import type { PromiseOrValue } from "./utils/async.ts"

export type RequestHandler<T> = (
  request: unknown,
  requestId: RequestId,
  method: string,
) => PromiseOrValue<T>

/**
 * A JSON-RPC 2.0 error object.
 * The error codes from and including -32768 to -32000 are reserved for pre-defined errors.
 * Any code within this range, but not defined explicitly below is reserved for future use.
 * @see {@link Errors}
 * @see {@link PARSE_ERROR}
 * @see {@link INVALID_REQUEST}
 * @see {@link METHOD_NOT_FOUND}
 * @see {@link INVALID_PARAMS}
 * @see {@link INTERNAL_ERROR}
 * @see {@link SERVER_ERROR}
 */
export interface Error {
  /**
   * A Number that indicates the error type that occurred.
   * This MUST be an integer.
   */
  readonly code: number
  /**
   * A String providing a short description of the error.
   * The message SHOULD be limited to a concise single sentence.
   */
  readonly message: string
  /**
   * A Primitive or Structured value that contains additional information about the error.
   * This may be omitted.
   * The value of this member is defined by the Server (e.g. detailed error information, nested errors etc.).
   */
  readonly data?: unknown
}

export type RequestId = string | number

/**
 * A rpc call is represented by sending a Request object to a Server.
 */
export interface Request {
  /**
   * An identifier established by the Client that MUST contain a String, Number,
   * or NULL value if included. If it is not included it is assumed to be a
   * notification. The value SHOULD normally not be Null and Numbers
   * SHOULD NOT contain fractional parts
   */
  readonly id: RequestId
  /**
   * A String containing the name of the method to be invoked. Method names that
   * begin with the word rpc followed by a period character (U+002E or ASCII 46)
   * are reserved for rpc-internal methods and extensions and MUST NOT be used
   * for anything else.
   */
  readonly method: string

  /**
   * A Structured value that holds the parameter values to be used during the
   * invocation of the method. This member MAY be omitted.
   */
  readonly params?: unknown
}

/**
 * When a rpc call is made, the Server MUST reply with a Response, except for in
 * the case of Notifications.
 */
export interface Response {
  /**
   * This member is REQUIRED.
   * It MUST be the same as the value of the id member in the Request Object.
   * If there was an error in detecting the id in the Request object (e.g. Parse
   * error/Invalid Request), it MUST be Null.
   */
  readonly id: RequestId

  /**
   * This member is REQUIRED on success.
   * This member MUST NOT exist if there was an error invoking the method.
   * The value of this member is determined by the method invoked on the Server.
   */
  readonly result: unknown
}

/**
 * A Notification is a Request object without an "id" member. A Request object
 * that is a Notification signifies the Client's lack of interest in the
 * corresponding Response object, and as such no Response object needs to be
 * returned to the client. The Server MUST NOT reply to a Notification,
 * including those that are within a batch request.
 *
 * Notifications are not confirmable by definition, since they do not have
 * a Response object to be returned. As such, the Client would not be aware of
 * any errors (like e.g. "Invalid params","Internal error").
 */
export interface Notification {
  /**
   * A String containing the name of the method to be invoked. Method names that
   * begin with the word rpc followed by a period character (U+002E or ASCII 46)
   * are reserved for rpc-internal methods and extensions and MUST NOT be used
   * for anything else.
   */
  method: string

  /**
   * A Structured value that holds the parameter values to be used during the
   * invocation of the method. This member MAY be omitted.
   */
  params?: unknown
}
