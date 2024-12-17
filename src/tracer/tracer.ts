import type * as rpc from "../types.ts"
import type { Peer } from "../json-rpc.ts"
import type { EventObserver } from "@tioniq/eventiq"

export interface Tracer {
  get outcomeRequest(): EventTracer<OutcomeRequestEvent>

  get outcomeNotification(): EventTracer<OutcomeNotificationEvent>

  get outcomeError(): EventTracer<OutcomeErrorEvent>

  get outcomeResponse(): EventTracer<OutcomeResponseEvent>

  get incomeRequest(): EventTracer<IncomeRequestEvent>

  get incomeNotification(): EventTracer<IncomeNotificationEvent>
}

export interface EventTracer<T> {
  get onStart(): EventObserver<T & EventStartData>

  get onEnd(): EventObserver<T & EventStartData & EventEndData>
}

export interface EventStartData {
  startTime: number
}

export interface EventEndData {
  endTime: number
  exception?: unknown
  error?: unknown
  result?: unknown
}

export interface OutcomeRequestEvent {
  readonly peer: Peer
  readonly request: rpc.Request
}

export interface OutcomeNotificationEvent {
  readonly peer: Peer
  readonly notification: rpc.Notification
}

export interface OutcomeErrorEvent {
  readonly peer: Peer
  readonly error: rpc.Error
  readonly requestId?: rpc.RequestId
}

export interface OutcomeResponseEvent {
  readonly peer: Peer
  readonly response: rpc.Response
}

export interface IncomeRequestEvent {
  readonly peer: Peer
  readonly request: rpc.Request
}

export interface IncomeNotificationEvent {
  readonly peer: Peer
  readonly notification: rpc.Notification
}
