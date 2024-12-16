import type { Channel } from "./channel.ts"
import type { Deserializer } from "./json-rpc.ts"
import { Disposable } from "@tioniq/disposiq"
import { EventDispatcher, type EventObserver } from "@tioniq/eventiq"
import type * as rpc from "./types.ts"

export interface RpcMessageReceiverOptions {
  channel: Channel<string>
  deserializer: Deserializer
  checkIncomingVersion?: boolean
}

export interface ParseMessageFailedEvent {
  message: string
  error: unknown
}

export interface InvalidRequestEvent {
  request: unknown
  error: unknown
}

type MessageObject = {
  id?: rpc.RequestId | null
  method?: string
  error?: rpc.Error
  params?: unknown
  result?: unknown
  response?: unknown
}

export class RpcMessageReceiver extends Disposable {
  private readonly _channel: Channel<string>
  private readonly _checkIncomingVersion: boolean
  private readonly _deserializer: Deserializer
  private readonly _onParseMessageFailed =
    new EventDispatcher<ParseMessageFailedEvent>()
  private readonly _onInvalidRequest =
    new EventDispatcher<InvalidRequestEvent>()
  private readonly _onGeneralError = new EventDispatcher<rpc.Error>()
  private readonly _onRequestError = new EventDispatcher<{
    id: rpc.RequestId
    error: rpc.Error
  }>()
  private readonly _onNotification = new EventDispatcher<rpc.Notification>()
  private readonly _onRequest = new EventDispatcher<rpc.Request>()
  private readonly _onResponse = new EventDispatcher<rpc.Response>()

  constructor(options: RpcMessageReceiverOptions) {
    super()
    this._channel = options.channel
    this._checkIncomingVersion = options.checkIncomingVersion ?? false
    this._deserializer = options.deserializer
    this.addDisposable(
      this._channel.onMessage.subscribe((m) => this._parseMessage(m)),
    )
  }

  get onParseMessageFailed(): EventObserver<ParseMessageFailedEvent> {
    return this._onParseMessageFailed
  }

  get onInvalidRequest(): EventObserver<InvalidRequestEvent> {
    return this._onInvalidRequest
  }

  get onGeneralError(): EventObserver<rpc.Error> {
    return this._onGeneralError
  }

  get onRequestError(): EventObserver<{ id: rpc.RequestId; error: rpc.Error }> {
    return this._onRequestError
  }

  get onNotification(): EventObserver<rpc.Notification> {
    return this._onNotification
  }

  get onRequest(): EventObserver<rpc.Request> {
    return this._onRequest
  }

  get onResponse(): EventObserver<rpc.Response> {
    return this._onResponse
  }

  private _parseMessage(message: string): void {
    let data: unknown
    try {
      data = this._deserializer(message)
    } catch (e) {
      this._onParseMessageFailed.dispatch({ message, error: e })
      return
    }
    if (!(data instanceof Promise)) {
      this._handleMessage(data)
      return
    }
    data.then(
      (d) => this._handleMessage(d),
      (e) => this._onParseMessageFailed.dispatch({ message, error: e }),
    )
  }

  private _handleMessage(data: unknown): void {
    if (typeof data !== "object" || data === null) {
      this._onInvalidRequest.dispatch({
        request: data,
        error: new Error("Invalid request"),
      })
      return
    }
    if (Array.isArray(data)) {
      for (const item of data) {
        this._handleMessageObject(item)
      }
      return
    }
    this._handleMessageObject(data)
  }

  private _handleMessageObject(data: MessageObject): void {
    if (typeof data !== "object" || data === null) {
      this._onInvalidRequest.dispatch({
        request: data,
        error: new Error("Response is not an object"),
      })
      return
    }
    if (this._checkIncomingVersion) {
      const version = (
        data as {
          jsonrpc?: string
        }
      ).jsonrpc
      if (version !== "2.0") {
        this._onInvalidRequest.dispatch({
          request: data,
          error: new Error("Invalid JSON-RPC version"),
        })
        return
      }
    }
    const id = data.id
    const error = data.error
    if (error != undefined) {
      if (!isRpcError(error)) {
        this._onInvalidRequest.dispatch({
          request: data,
          error: new Error("Error object is invalid"),
        })
        return
      }
      if (id == null) {
        this._handleGeneralError(error)
        return
      }
      this._handleRequestError(id, error)
      return
    }
    const result = data.result
    if (result != undefined) {
      if (id == null) {
        this._onInvalidRequest.dispatch({
          request: data,
          error: new Error("Result without id"),
        })
        return
      }
      this._handleRequestResult(id, result)
      return
    }
    const method = data.method
    if (typeof method !== "string") {
      this._onInvalidRequest.dispatch({
        request: data,
        error: new Error("Method is not a string"),
      })
      return
    }
    const params = data.params
    if (id == null) {
      this._handleNotification(method, params)
      return
    }
    this._handleRequest(method, id, params)
  }

  private _handleGeneralError(error: rpc.Error): void {
    this._onGeneralError.dispatch(error)
  }

  private _handleRequestError(id: rpc.RequestId, error: rpc.Error): void {
    this._onRequestError.dispatch({ id, error })
  }

  private _handleRequestResult(id: rpc.RequestId, result: unknown): void {
    this._onResponse.dispatch({ id, result })
  }

  private _handleNotification(method: string, params: unknown): void {
    this._onNotification.dispatch({ method, params })
  }

  private _handleRequest(
    method: string,
    id: rpc.RequestId,
    params: unknown,
  ): void {
    this._onRequest.dispatch({ method, id, params })
  }
}

function isRpcError(e: unknown): e is rpc.Error {
  return typeof e === "object" && e !== null && "code" in e && "message" in e
}
