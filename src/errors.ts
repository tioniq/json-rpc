// biome-ignore lint/suspicious/noShadowRestrictedNames: This is a false positive
import type { Error } from "./types.ts"
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
  SERVER_ERROR,
} from "./error-codes.ts"

type DefaultErrors =
  | "parseError"
  | "invalidRequest"
  | "methodNotFound"
  | "invalidParams"
  | "internalError"
  | "serverError"

export const Errors: Readonly<{
  [key in DefaultErrors]: Error
}> = {
  parseError: {
    code: PARSE_ERROR,
    message: "Parse error",
  },
  invalidRequest: {
    code: INVALID_REQUEST,
    message: "Invalid request",
  },
  methodNotFound: {
    code: METHOD_NOT_FOUND,
    message: "Method not found",
  },
  invalidParams: {
    code: INVALID_PARAMS,
    message: "Invalid params",
  },
  internalError: {
    code: INTERNAL_ERROR,
    message: "Internal error",
  },
  serverError: {
    code: SERVER_ERROR,
    message: "Server error",
  },
}

export class ConnectionClosedException extends globalThis.Error {
  constructor() {
    super("Connection closed")
    this.name = "ConnectionClosedException"
  }
}

export class RpcException extends globalThis.Error implements Error {
  readonly code: number
  readonly data?: unknown

  constructor(error: Error) {
    super(error.message)
    this.name = "RpcException"
    this.code = error.code
    this.data = error.data
  }
}
