import type { JsonRpcMessage, Serializer } from "./json-rpc.ts"
import type { PromiseOrValue } from "./utils/async.ts"
import type { Channel } from "./channel.ts"
import { Completer } from "./utils/completer.ts"

export interface RpcMessageSenderOptions {
  channel: Channel<string>
  serializer: Serializer
  batchDelay?: number
  includeVersion?: boolean
}

export class RpcMessageSender {
  private readonly _serializer: Serializer
  private readonly _channel: Channel<string>
  private readonly _batchDelay: number | undefined
  private readonly _includeVersion: boolean
  private _batch:
    | {
        message: string
        completer: Completer<void>
      }[]
    | undefined

  constructor(options: RpcMessageSenderOptions) {
    this._serializer = options.serializer
    this._channel = options.channel
    this._batchDelay = options.batchDelay
    this._includeVersion = options.includeVersion ?? true
  }

  /**
   * Send a JSON-RPC message. Can throw an exception during serialization or
   * sending (e.g. if the channel is closed).
   * @param message The message to send.
   */
  sendMessage(message: JsonRpcMessage): PromiseOrValue<void> {
    if (this._includeVersion) {
      ;(
        message as {
          jsonrpc?: string
        }
      ).jsonrpc = "2.0"
    }
    const serialized = this._serializer(message)
    if (serialized instanceof Promise) {
      return serialized.then((r) => this._send(r))
    }
    return this._send(serialized)
  }

  private _send(data: string): PromiseOrValue<void> {
    if (this._batchDelay == undefined) {
      return this._channel.send(data)
    }
    let startBatch = false
    if (!this._batch) {
      startBatch = true
      this._batch = []
    }
    const completer = new Completer<void>()
    this._batch.push({
      message: data,
      completer,
    })
    if (startBatch) {
      setTimeout(() => this._sendBatch(), this._batchDelay)
    }
    return completer.promise
  }

  private _sendBatch(): void {
    if (!this._batch) {
      return
    }
    const batch = this._batch
    this._batch = undefined
    const messages = batch.map((b) => b.message)
    const message = `[${messages.join(",")}]`
    let sendResult: void | Promise<void>
    try {
      sendResult = this._channel.send(message)
    } catch (e) {
      for (const b of batch) {
        b.completer.completeError(e)
      }
      return
    }
    if (!(sendResult instanceof Promise)) {
      for (const b of batch) {
        b.completer.complete()
      }
      return
    }
    sendResult.then(
      () => {
        for (const b of batch) {
          b.completer.complete()
        }
      },
      (e: unknown) => {
        for (const b of batch) {
          b.completer.completeError(e)
        }
      },
    )
  }
}
