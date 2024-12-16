import { EventDispatcher, type EventObserver } from "@tioniq/eventiq"
import {
  DisposableAction,
  DisposableStore,
  type Disposiq,
  type IDisposable,
} from "@tioniq/disposiq"
import type { Channel } from "./channel.ts"
import { Completer } from "./utils/completer.ts"
import { uuid } from "./utils/uuid.ts"
import type * as rpc from "./types.ts"
import type { RequestId } from "./types.ts"
import type { Logger } from "./logger/logger.ts"
import { ConnectionClosedException, Errors } from "./errors.ts"
import { noopLogger } from "./logger/noop-logger.ts"
import {
  handlePromiseOrValueFunction,
  type PromiseOrValue,
} from "./utils/async.ts"
import type { Tracer } from "./tracer/tracer.ts"
import type { TimeProvider } from "./time/time-provider.ts"
import { defaultTimeProvider } from "./time/default-time-provider.ts"
import { TracerImpl } from "./tracer/tracer-impl.ts"
import { RpcMessageSender } from "./sender.ts"
import { RpcMessageReceiver } from "./receiver.ts"

export type Deserializer = (data: string) => PromiseOrValue<unknown>
export type Serializer = (data: unknown) => PromiseOrValue<string>

export interface PeerOptions {
  /**
   * Peer identifier. If not provided, the random UUID will be generated
   */
  id?: string

  /**
   * Logger instance. If not provided, the no-op logger will be used
   */
  logger?: Logger

  /**
   * Time provider. If not provided, the default time provider will be used
   */
  timeProvider?: TimeProvider

  /**
   * Serializer function. If not provided, the JSON.stringify will be used
   */
  serializer?: Serializer

  /**
   * Deserializer function. If not provided, the JSON.parse will be used
   */
  deserializer?: Deserializer

  /**
   * Whenever the messages should be batched before sending. If the value is
   * provided, the messages will be batched and sent with the specified delay
   * in milliseconds. If the value is not provided, the messages will be sent
   * immediately. If the value is 0, the messages will be sent in the next
   * event loop iteration
   * @default undefined
   */
  batchDelay?: number

  /**
   * Whether to include the Json-RPC version in the messages
   * @default true
   */
  includeVersion?: boolean

  /**
   * Whether to check the incoming Json-RPC version. If the version is not
   * provided or not equal to 2.0, the message will be ignored and an error will
   * be sent
   */
  checkIncomingVersion?: boolean

  /**
   * Whether to close the channel when the Peer instance is disposed
   * @default false
   * @see {@link Channel.close}
   */
  closeChannelOnDispose?: boolean

  /**
   * Exception details provider. If provided, the details of the exception will
   * be passed to this function and the result will be sent as the error data.
   * If the result is undefined, the error data will be omitted
   * @example
   * ```ts
   * const peer = new Peer(channel, {
   *   exceptionDetailsProvider: (e) => {
   *     if (e instanceof Error) {
   *       return {
   *         name: e.name,
   *         message: e.message,
   *         stack: e.stack
   *       }
   *     }
   *     return {
   *        message: e.toString()
   *     }
   *   }
   * })
   * ```
   *
   * @param e
   */
  exceptionDetailsProvider?: (e: unknown) => unknown
}

let ordinal = 0

/**
 * Json-RPC 2.0 Duplex Peer implementation. Can be used for both client and server sides.
 *
 * {@link https://www.jsonrpc.org/specification}
 */
export class Peer implements IDisposable {
  /**
   * @internal
   */
  private readonly _disposables = new DisposableStore()
  /**
   * @internal
   */
  private readonly _onClose = new EventDispatcher()
  /**
   * @internal
   */
  private readonly _onOpen = new EventDispatcher()
  /**
   * @internal
   */
  private readonly _onGeneralError = new EventDispatcher<rpc.Error>()
  /**
   * @internal
   */
  private readonly _onNotification = new Map<string, EventDispatcher<unknown>>()
  /**
   * @internal
   */
  private readonly _pendingRequests = new Map<
    rpc.RequestId,
    Completer<unknown>
  >()
  /**
   * @internal
   */
  private readonly _requestHandlers = new Map<
    string,
    (request: unknown, requestId: RequestId, method: string) => void
  >()
  /**
   * @internal
   */
  private readonly _sender: RpcMessageSender
  /**
   * @internal
   */
  private readonly _receiver: RpcMessageReceiver
  /**
   * @internal
   */
  private readonly _tracer: TracerImpl
  /**
   * @internal
   */
  private readonly _channel: Channel<string>
  /**
   * @internal
   */
  private readonly _logger: Logger
  /**
   * @internal
   */
  private readonly _timeProvider: TimeProvider
  /**
   * @internal
   */
  private readonly _exceptionDetailsProvider: (e: unknown) => unknown
  /**
   * @internal
   */
  private readonly _id: string
  /**
   * @internal
   */
  private readonly _ordinal = ++ordinal
  /**
   * @internal
   */
  private _closed = false
  /**
   * @internal
   */
  private _idCounter = 0

  constructor(channel: Channel<string>, options?: PeerOptions) {
    this._channel = channel
    this._id = options?.id ?? uuid()
    this._logger = options?.logger ?? noopLogger
    this._sender = new RpcMessageSender({
      serializer: options?.serializer ?? JSON.stringify,
      channel: channel,
      batchDelay: options?.batchDelay,
      includeVersion: options?.includeVersion,
    })
    this._receiver = new RpcMessageReceiver({
      deserializer: options?.deserializer ?? JSON.parse,
      channel: channel,
    })
    this._timeProvider = options?.timeProvider ?? defaultTimeProvider
    this._exceptionDetailsProvider =
      options?.exceptionDetailsProvider ?? (() => undefined)
    this._tracer = new TracerImpl(this._timeProvider)
    this._disposables.add(
      this._receiver.onParseMessageFailed.subscribe((e) => {
        this._logger.error("Failed to parse message", e)
        this.sendError(Errors.parseError)
      }),
      this._receiver.onInvalidRequest.subscribe((e) => {
        this._logger.error("Invalid request", e)
        this.sendError({
          ...Errors.invalidRequest,
          data: {
            details:
              (e.error as { message: string })?.message ??
              e.error?.toString() ??
              "Unknown",
          },
        })
      }),
    )
    this._disposables.add(
      this._receiver.onGeneralError.subscribe((e) =>
        this._handleGeneralError(e),
      ),
      this._receiver.onNotification.subscribe((n) =>
        this._handleNotification(n),
      ),
      this._receiver.onRequestError.subscribe((r) => {
        this._handleRequestError(r.id, r.error)
      }),
      this._receiver.onResponse.subscribe((r) => {
        this._handleResponse(r)
      }),
      this._receiver.onRequest.subscribe((r) => {
        this._handleRequest(r)
      }),
    )
    this._disposables.add(
      this._receiver,
      channel.onClose?.subscribe(() => this._handleClose()),
      channel.onOpen?.subscribe(() => this._handleOpen()),
      () => this._handleClose(),
    )
    if (options?.closeChannelOnDispose && typeof channel.close === "function") {
      this._disposables.add(() => channel.close?.())
    }
    if (this._channel.isOpen === false) {
      this._closed = true
    }
  }

  /**
   * Peer identifier
   */
  get id(): string {
    return this._id
  }

  /**
   * Peer ordinal. The ordinal is a unique number that is assigned to each
   * instance of the Peer class. The number is incremented for each new instance.
   * The ordinal is useful for debugging and logging purposes, especially when
   * multiple instances of the Peer class are used.
   */
  get ordinal(): number {
    return this._ordinal
  }

  /**
   * Check if the connection is closed
   */
  get closed(): boolean {
    return this._closed
  }

  /**
   * Connection close event. Fired only once when connection closed or the Peer
   * instance disposed
   * @example
   * ```ts
   * const peer = new Peer(channel)
   * peer.onClose.subscribe(() => {
   *  console.debug("Peer was closed")
   * })
   * ```
   */
  get onClose(): EventObserver {
    return this._onClose
  }

  /**
   * General error event. Fired when received an error that is not related to the specific request
   * @example
   * ```ts
   * const peer = new Peer(channel)
   * peer.onGeneralError.subscribe((e) => {
   *  console.error("Peer general error", e)
   * })
   * ```
   */
  get onGeneralError(): EventObserver<rpc.Error> {
    return this._onGeneralError
  }

  get tracer(): Tracer {
    return this._tracer
  }

  /**
   * Dispose the Peer instance. Will unsubscribe from all events.
   * The connection will be closed if the option
   * `closeChannelOnDispose` is set to true.
   * Will throw {@link ConnectionClosedException} to all pending requests even
   * if `closeChannelOnDispose` is set to false.
   */
  dispose() {
    this._disposables.dispose()
  }

  /**
   * Send a request with the method and specified params
   * @param method request method
   * @param params request payload data. Must be provided
   * @return a response value if the request completed successfully
   * @throws RpcException when returned an error from the other side
   * @throws ConnectionClosedException when connection closed during the request
   * @example
   * ```ts
   * const peer = new Peer(channel)
   * // ...
   * const response = await peer.sendRequest("cart.add", {
   *  productId: productId
   * })
   * console.info("Product", productId, "is added to the card with response", response)
   * ```
   */
  sendRequest(method: string, params?: unknown): Promise<unknown> {
    this._disposables.throwIfDisposed()
    this._checkConnection()
    const id = ++this._idCounter
    const completer = new Completer<unknown>()
    this._pendingRequests.set(id, completer)
    const request: rpc.Request = {
      id: id,
      method: method,
      params: params,
    }
    return this._tracer.outcomeRequest.start(
      {
        peer: this,
        request: request,
      },
      async () => {
        handlePromiseOrValueFunction(
          () => this._sendMessage(request),
          noop,
          (e) => {
            completer.completeError(e)
            this._pendingRequests.delete(id)
          },
        )
        return await completer.promise
      },
    )
  }

  /**
   * Send a notification with the method and specified params
   * @param method
   * @param params
   */
  sendNotification(method: string, params?: unknown): void {
    this._disposables.throwIfDisposed()
    this._checkConnection()
    const notification: rpc.Notification = {
      method: method,
      params: params,
    }
    this._tracer.outcomeNotification.start(
      {
        peer: this,
        notification: notification,
      },
      () => this._sendMessage(notification),
    )
  }

  /**
   * Send an error
   * @param error
   * @param requestId if provided the error will associate with the request, otherwise - it will be sent as a general error
   */
  sendError(error: rpc.Error, requestId?: rpc.RequestId | undefined): void {
    this._disposables.throwIfDisposed()
    this._checkConnection()
    this._tracer.outcomeError.start(
      {
        peer: this,
        error: error,
        requestId: requestId,
      },
      () =>
        this._sendMessage({
          error: error,
          id: requestId,
        }),
    )
  }

  /**
   * Send a response in a custom way
   * @param response response data. The request id and the result must be provided
   */
  sendResponse(response: rpc.Response): void {
    this._disposables.throwIfDisposed()
    this._checkConnection()
    this._tracer.outcomeResponse.start(
      {
        peer: this,
        response: response,
      },
      () =>
        handlePromiseOrValueFunction(
          () =>
            this._sendMessage({
              id: response.id,
              result: response.result,
            }),
          noop,
          (e) => {
            this._logger.error("Failed to send response", {
              response,
              error: e,
            })
          },
        ),
    )
  }

  /**
   * Get an event observer for the specific method
   * @param method notification method
   */
  onNotification(method: string): EventObserver<unknown> {
    let dispatcher = this._onNotification.get(method)
    if (dispatcher === undefined) {
      dispatcher = new EventDispatcher<unknown>()
      this._onNotification.set(method, dispatcher)
    }
    return dispatcher
  }

  /**
   * Set request handler for the method. If the handler returns an undefined
   * value, the response will not be sent and the handler MUST send the
   * response manually, see {@link sendResponse}, {@link sendError}.
   * @param method request method
   * @param handler request handler
   * @returns disposable object that will unset the handler on dispose
   */
  setRequestHandler<T>(
    method: string,
    handler: rpc.RequestHandler<T>,
  ): Disposiq {
    const internalHandler = (
      request: unknown,
      requestId: RequestId,
      method: string,
    ) => {
      handlePromiseOrValueFunction(
        () => handler(request, requestId, method),
        (response) => {
          if (response === undefined) {
            return
          }
          this.sendResponse({
            id: requestId,
            result: response,
          })
        },
        (e) => {
          let error: rpc.Error
          if (isRpcError(e)) {
            error = {
              code: e.code,
              message: e.message,
              data: e.data,
            }
          } else {
            const details = this._exceptionDetailsProvider(e)
            if (details !== undefined) {
              error = {
                ...Errors.serverError,
                data: details,
              }
            } else {
              error = Errors.serverError
            }
          }
          this.sendError(error, requestId)
        },
      )
    }
    this._requestHandlers.set(method, internalHandler)
    return new DisposableAction(() => {
      const currentHandler = this._requestHandlers.get(method)
      if (currentHandler === internalHandler) {
        this._requestHandlers.delete(method)
      }
    })
  }

  /**
   * Close the connection. Will throw {@link ConnectionClosedException} to all
   * pending requests
   */
  close(): PromiseOrValue<void> {
    return this._channel.close?.()
  }

  /**
   * @internal
   */
  private _sendMessage(message: JsonRpcMessage): PromiseOrValue<void> {
    return this._sender.sendMessage(message)
  }

  /**
   * @internal
   */
  private _checkConnection(): void {
    if (this._closed) {
      throw new ConnectionClosedException()
    }
  }

  /**
   * @internal
   */
  private _handleGeneralError(error: rpc.Error) {
    this._onGeneralError.dispatch(error)
  }

  /**
   * @internal
   */
  private _handleNotification(notification: rpc.Notification) {
    const dispatcher = this._onNotification.get(notification.method)
    if (!dispatcher) {
      this._logger.debug("Unhandled notification", notification.method)
      return
    }
    dispatcher.dispatch(notification.params)
  }

  /**
   * @internal
   */
  private _handleRequestError(requestId: rpc.RequestId, error: rpc.Error) {
    const completer = this._pendingRequests.get(requestId)
    if (completer == undefined) {
      const details = `Request ${requestId} not found`
      this._logger.error(details)
      this.sendError({
        ...Errors.invalidRequest,
        data: {
          details: details,
        },
      })
      return
    }
    this._pendingRequests.delete(requestId)
    completer.completeError(error)
  }

  /**
   * @internal
   */
  private _handleResponse(response: rpc.Response) {
    const completer = this._pendingRequests.get(response.id)
    if (completer == null) {
      const details = `Request ${response.id} not found`
      this._logger.error(details)
      this.sendError({
        ...Errors.invalidRequest,
        data: {
          details: details,
        },
      })
      return
    }
    this._pendingRequests.delete(response.id)
    completer.complete(response.result)
  }

  /**
   * @internal
   */
  private _handleRequest(request: rpc.Request) {
    const handler = this._requestHandlers.get(request.method)
    if (!handler) {
      this._logger.error(`No request handler for ${request.method}`)
      this.sendError(Errors.methodNotFound, request.id)
      return
    }
    handler(request.params, request.id, request.method)
  }

  /**
   * @internal
   */
  private _handleClose() {
    if (this._closed) {
      return
    }
    this._closed = true
    this._onClose.dispatch()
    if (this._pendingRequests.size == 0) {
      return
    }
    const pendingRequests = Array.from(this._pendingRequests.values())
    this._pendingRequests.clear()
    for (const completer of pendingRequests) {
      completer.completeError(new ConnectionClosedException())
    }
  }

  /**
   * @internal
   */
  private _handleOpen() {
    if (!this._closed) {
      return
    }
    this._closed = false
    this._onOpen.dispatch()
  }
}

export type JsonRpcErrorMessage = {
  error: rpc.Error
  id?: rpc.RequestId
}

export type JsonRpcResponseMessage = {
  id: rpc.RequestId
  result: unknown
}

export type JsonRpcRequestMessage = {
  id: rpc.RequestId
  method: string
  params?: unknown
}

export type JsonRpcNotificationMessage = {
  method: string
  params?: unknown
}

export type JsonRpcMessage =
  | JsonRpcErrorMessage
  | JsonRpcResponseMessage
  | JsonRpcRequestMessage
  | JsonRpcNotificationMessage

export function isRpcError(e: unknown): e is rpc.Error {
  return typeof e === "object" && e !== null && "code" in e && "message" in e
}

function noop() {}
