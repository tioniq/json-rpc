import {
  type ChannelMinimal,
  type Channel,
  Peer,
  isRpcError,
  ConnectionClosedException,
  METHOD_NOT_FOUND,
} from "../src"
import { EventDispatcher, type EventObserver } from "@tioniq/eventiq"
import { ObjectDisposedException } from "@tioniq/disposiq"

describe("peer", () => {
  beforeEach(() => {
    jest.useFakeTimers({
      advanceTimers: true,
    })
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it("should create peer instance with minimal channel", () => {
    const messageDispatcher = new EventDispatcher<string>()
    const channel: ChannelMinimal<string> = {
      get onMessage() {
        return messageDispatcher
      },
      send(): Promise<void> {
        return Promise.resolve()
      },
    }
    const peer = new Peer(channel)
    expect(peer).toBeDefined()
  })

  it("should throw ConnectionClosedException when sending message to closed channel", async () => {
    const channel = new ManagedChannel()
    const peer = new Peer(channel)
    channel.dispatchClose()
    try {
      await peer.sendRequest("test", {})
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(ConnectionClosedException)
    }
  })

  it("should generate peer id", () => {
    const channel = new ManagedChannel()
    const peer = new Peer(channel)
    expect(peer.id).toBeDefined()

    const channel2 = new ManagedChannel()
    const peer2 = new Peer(channel2)
    expect(peer2.id).toBeDefined()

    expect(peer.id).not.toEqual(peer2.id)
  })

  it("should peer use provided id", () => {
    const channel = new ManagedChannel()
    const peer = new Peer(channel, { id: "test" })
    expect(peer.id).toBe("test")
  })

  it("should ordinal update for every instance", () => {
    const channel = new ManagedChannel()
    const peer = new Peer(channel)
    expect(peer.ordinal).toBeDefined()

    const channel2 = new ManagedChannel()
    const peer2 = new Peer(channel2)
    expect(peer2.ordinal).toBe(peer.ordinal + 1)
  })

  it("should return closed state", () => {
    const channel = new ManagedChannel()
    const peer = new Peer(channel)
    expect(peer.closed).toBe(false)

    channel.dispatchClose()
    expect(peer.closed).toBe(true)
  })

  it("should return closed state from options", () => {
    const channel = new ManagedChannel()
    channel.isOpen = false
    const peer = new Peer(channel)
    expect(peer.closed).toBe(true)
  })

  it("should dispatch close event", () => {
    const channel = new ManagedChannel()
    const peer = new Peer(channel)
    const closeHandler = jest.fn()
    peer.onClose.subscribe(closeHandler)
    channel.dispatchClose()
    expect(closeHandler).toHaveBeenCalledTimes(1)
  })

  it("should throw ObjectDisposedException when sending message to disposed peer", async () => {
    const channel = new ManagedChannel()
    const peer = new Peer(channel)
    peer.dispose()
    try {
      await peer.sendRequest("test", {})
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(ObjectDisposedException)
    }
  })

  it("request should rethrow channel error", async () => {
    const error = new Error("Test")
    const channel: ChannelMinimal<string> = {
      get onMessage() {
        return new EventDispatcher<string>()
      },
      send(): never {
        throw error
      },
    }
    const peer = new Peer(channel)
    try {
      await peer.sendRequest("test", {})
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBe(error)
    }
  })

  it("sendResponse should not fail if channel is closed", async () => {
    const channel: ChannelMinimal<string> = {
      get onMessage() {
        return new EventDispatcher<string>()
      },
      send(): Promise<void> {
        return Promise.reject(new Error("Channel closed"))
      },
    }
    const peer = new Peer(channel)
    peer.sendResponse({
      id: 1,
      result: {},
    })
    await new Promise((resolve) => setTimeout(resolve, 1))
  })

  it("request handler should provide custom response", async () => {
    const channel = new ManagedChannel()
    const server = new Peer(channel)
    server.setRequestHandler("test", async (_, requestId) => {
      setTimeout(() => {
        server.sendResponse({
          id: requestId,
          result: { success: true },
        })
      }, 1)
    })
    const clientChannel = new ManagedChannel()
    bindChannels(channel, clientChannel)
    const client = new Peer(clientChannel)
    const response = await client.sendRequest("test", {})
    expect(response).toEqual({ success: true })
  })

  it("should dispose request handler", async () => {
    const serverChannel = new ManagedChannel()
    const server = new Peer(serverChannel)
    const clientChannel = new ManagedChannel()
    const client = new Peer(clientChannel)
    bindChannels(serverChannel, clientChannel)

    const func = jest.fn(() => {
      return {
        success: true,
      }
    })
    const handler = server.setRequestHandler("test", func)

    await client.sendRequest("test", {})

    expect(func).toHaveBeenCalledTimes(1)

    handler.dispose()
    try {
      await client.sendRequest("test", {})
      expect(true).toBe(false)
    } catch (e) {
      expect(isRpcError(e) && e.code).toBe(METHOD_NOT_FOUND)
    }
  })

  it("should trigger channel close", () => {
    const channel = new ManagedChannel()
    const peer = new Peer(channel)
    const closeHandler = jest.fn()
    peer.onClose.subscribe(closeHandler)
    peer.close()
    expect(closeHandler).toHaveBeenCalledTimes(1)
  })

  it("should not fail on unhandled notification", () => {
    const serverChannel = new ManagedChannel()
    const server = new Peer(serverChannel)
    const clientChannel = new ManagedChannel()
    new Peer(clientChannel)
    bindChannels(serverChannel, clientChannel)
    server.sendNotification("test")
    jest.advanceTimersByTime(2)
    jest.advanceTimersByTime(2)
  })

  it("should not fail on unhandled request", async () => {
    const serverChannel = new ManagedChannel()
    new Peer(serverChannel)
    const clientChannel = new ManagedChannel()
    const client = new Peer(clientChannel)
    bindChannels(serverChannel, clientChannel)
    try {
      await client.sendRequest("test", {})
    } catch (e) {
      expect(isRpcError(e) && e.code).toBe(METHOD_NOT_FOUND)
    }
  })

  it("should send general error on not existing request response", () => {
    const serverChannel = new ManagedChannel()
    const server = new Peer(serverChannel)
    const clientChannel = new ManagedChannel()
    new Peer(clientChannel)
    bindChannels(serverChannel, clientChannel)
    const generalErrorHandler = jest.fn()
    server.onGeneralError.subscribe(generalErrorHandler)
    server.sendResponse({
      id: 1,
      result: {},
    })
    jest.advanceTimersByTime(2)
    jest.advanceTimersByTime(2)
    expect(generalErrorHandler).toHaveBeenCalledTimes(1)
  })
})

describe("duplex", () => {
  beforeEach(() => {
    jest.useFakeTimers({
      advanceTimers: true,
    })
  })
  afterEach(() => {
    jest.useRealTimers()
  })
  it("should communicate between two peers", async () => {
    const serverChannel = new ManagedChannel()
    const server = new Peer(serverChannel, {
      logger: console,
      exceptionDetailsProvider: (e) => {
        if (e instanceof Error) {
          return {
            message: e.message,
            stack: e.stack,
          }
        }
        return undefined
      },
    })

    const clientChannel = new ManagedChannel()
    const client = new Peer(clientChannel, {
      logger: console,
    })

    bindChannels(serverChannel, clientChannel)

    server.setRequestHandler("auth.signIn", async (params) => {
      if (typeof params !== "object") {
        throw new Error("Invalid params")
      }
      const payload = params as Record<string, unknown>
      if (payload.accessToken !== "123") {
        throw new Error("Invalid access token")
      }
      return { success: true }
    })

    try {
      await client.sendRequest("auth.signIn", {
        accessToken: "asdasd",
      })
      expect(true).toBe(false)
    } catch (e) {
      // biome-ignore lint/suspicious/noExplicitAny: This is a test
      expect(isRpcError(e) && (e.data as any)?.message).toBe(
        "Invalid access token",
      )
    }
    const response = await client.sendRequest("auth.signIn", {
      accessToken: "123",
    })
    expect(response).toEqual({ success: true })

    const pingHandler = jest.fn()
    client.onNotification("ping").subscribe(pingHandler)
    server.sendNotification("ping")
    jest.advanceTimersByTime(2)
    expect(pingHandler).toHaveBeenCalledTimes(1)
  })
})

function bindChannels(a: ManagedChannel, b: ManagedChannel): void {
  a.onSend.subscribe((message) => {
    // Simulate network delay
    setTimeout(() => {
      b.dispatchMessage(message)
    }, 1)
  })
  b.onSend.subscribe((message) => {
    // Simulate network delay
    setTimeout(() => {
      a.dispatchMessage(message)
    }, 1)
  })
}

class ManagedChannel implements Channel<string> {
  private readonly _onMessage = new EventDispatcher<string>()
  private readonly _onSend = new EventDispatcher<string>()
  private readonly _onClose = new EventDispatcher()

  get onMessage(): EventObserver<string> {
    return this._onMessage
  }

  get onSend(): EventObserver<string> {
    return this._onSend
  }

  get onClose(): EventObserver<void> {
    return this._onClose
  }

  close(): void {
    this._onClose.dispatch()
  }

  send(message: string): void {
    this._onSend.dispatch(message)
  }

  dispatchMessage(message: string) {
    this._onMessage.dispatch(message)
  }

  dispatchClose(): void {
    this._onClose.dispatch()
  }

  isOpen: boolean | undefined
}
