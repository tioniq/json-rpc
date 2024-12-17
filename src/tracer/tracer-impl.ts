import { type EventObserver, EventSafeDispatcher } from "@tioniq/eventiq"
import type {
  EventTracer,
  IncomeNotificationEvent,
  IncomeRequestEvent,
  OutcomeErrorEvent,
  OutcomeNotificationEvent,
  OutcomeRequestEvent,
  OutcomeResponseEvent,
  Tracer,
} from "./tracer.ts"
import type { TimeProvider } from "../time/time-provider.ts"

export class TracerImpl implements Tracer {
  constructor(timeProvider: TimeProvider) {
    this.outcomeRequest = new EventTracerImpl<OutcomeRequestEvent>(timeProvider)
    this.outcomeNotification = new EventTracerImpl<OutcomeNotificationEvent>(
      timeProvider,
    )
    this.outcomeError = new EventTracerImpl<OutcomeErrorEvent>(timeProvider)
    this.outcomeResponse = new EventTracerImpl<OutcomeResponseEvent>(
      timeProvider,
    )
    this.incomeRequest = new EventTracerImpl<IncomeRequestEvent>(timeProvider)
    this.incomeNotification = new EventTracerImpl<IncomeNotificationEvent>(
      timeProvider,
    )
  }

  readonly outcomeRequest: EventTracerImpl<OutcomeRequestEvent>

  readonly outcomeNotification: EventTracerImpl<OutcomeNotificationEvent>

  readonly outcomeError: EventTracerImpl<OutcomeErrorEvent>

  readonly outcomeResponse: EventTracerImpl<OutcomeResponseEvent>

  readonly incomeRequest: EventTracerImpl<IncomeRequestEvent>

  readonly incomeNotification: EventTracerImpl<IncomeNotificationEvent>
}

class EventTracerImpl<T> implements EventTracer<T> {
  private readonly _onStart = new EventSafeDispatcher<T & EventStartData>()
  private readonly _onEnd = new EventSafeDispatcher<
    T & EventStartData & EventEndData
  >()
  private readonly _timeProvider: TimeProvider

  constructor(timeProvider: TimeProvider) {
    this._timeProvider = timeProvider
  }

  get onStart(): EventObserver<T & EventStartData> {
    return this._onStart
  }

  get onEnd(): EventObserver<T & EventStartData & EventEndData> {
    return this._onEnd
  }

  start<R>(event: T, runner: () => R): R {
    const eventData: T & EventStartData & EventEndData = {
      ...event,
      startTime: this._timeProvider(),
    } as T & EventStartData & EventEndData
    this._onStart.dispatch(eventData)
    let result: R
    try {
      result = runner()
    } catch (e) {
      eventData.endTime = this._timeProvider()
      eventData.exception = e
      this._onEnd.dispatch(eventData)
      throw e
    }
    if (!(result instanceof Promise)) {
      eventData.endTime = this._timeProvider()
      eventData.result = result
      this._onEnd.dispatch(eventData)
      return result
    }
    return (result as unknown as Promise<Awaited<R>>).then(
      (r) => {
        eventData.endTime = this._timeProvider()
        eventData.result = r
        this._onEnd.dispatch(eventData)
        return r
      },
      (e: unknown) => {
        eventData.endTime = this._timeProvider()
        eventData.exception = e
        this._onEnd.dispatch(eventData)
        throw e
      },
    ) as R
  }
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
