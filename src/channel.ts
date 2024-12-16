import type { EventObserver } from "@tioniq/eventiq"
import type { PromiseOrValue } from "./utils/async.ts"

export interface ChannelMinimal<T> {
  get onMessage(): EventObserver<T>

  send(message: T): PromiseOrValue<void>
}

export interface ClosableChannel {
  get onClose(): EventObserver

  get onOpen(): EventObserver

  get isOpen(): boolean

  close(): PromiseOrValue<void>

  open(): PromiseOrValue<void>
}

export type Channel<T> = ChannelMinimal<T> & Partial<ClosableChannel>
