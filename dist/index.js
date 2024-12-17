var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/json-rpc.ts
import { EventDispatcher as EventDispatcher2 } from "@tioniq/eventiq";
import {
  DisposableAction,
  DisposableStore
} from "@tioniq/disposiq";

// src/utils/completer.ts
var Completer = class {
  constructor(executor) {
    __publicField(this, "promise");
    __publicField(this, "resolve", null);
    __publicField(this, "reject", null);
    __publicField(this, "completed", false);
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      if (executor) {
        executor();
      }
    });
  }
  complete(value) {
    if (this.completed) {
      return;
    }
    this.completed = true;
    this.resolve(value);
  }
  completeError(error) {
    if (this.completed) {
      return;
    }
    this.completed = true;
    this.reject(error);
  }
};

// src/utils/uuid.ts
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

// src/error-codes.ts
var PARSE_ERROR = -32700;
var INVALID_REQUEST = -32600;
var METHOD_NOT_FOUND = -32601;
var INVALID_PARAMS = -32602;
var INTERNAL_ERROR = -32603;
var SERVER_ERROR = -32e3;
function errorName(errorCode) {
  switch (errorCode) {
    case PARSE_ERROR:
      return "Parse error";
    case INVALID_REQUEST:
      return "Invalid request";
    case METHOD_NOT_FOUND:
      return "Method not found";
    case INVALID_PARAMS:
      return "Invalid parameters";
    case INTERNAL_ERROR:
      return "Internal error";
  }
  if (errorCode >= -32099 && errorCode <= -32e3) {
    return "Server error";
  }
  return null;
}

// src/errors.ts
var Errors = {
  parseError: {
    code: PARSE_ERROR,
    message: "Parse error"
  },
  invalidRequest: {
    code: INVALID_REQUEST,
    message: "Invalid request"
  },
  methodNotFound: {
    code: METHOD_NOT_FOUND,
    message: "Method not found"
  },
  invalidParams: {
    code: INVALID_PARAMS,
    message: "Invalid params"
  },
  internalError: {
    code: INTERNAL_ERROR,
    message: "Internal error"
  },
  serverError: {
    code: SERVER_ERROR,
    message: "Server error"
  }
};
var ConnectionClosedException = class extends globalThis.Error {
  constructor() {
    super("Connection closed");
    this.name = "ConnectionClosedException";
  }
};
var RpcException = class extends globalThis.Error {
  constructor(error) {
    super(error.message);
    __publicField(this, "code");
    __publicField(this, "data");
    this.name = "RpcException";
    this.code = error.code;
    this.data = error.data;
  }
};

// src/logger/noop-logger.ts
var NoopLogger = class {
  error() {
  }
  warn() {
  }
  info() {
  }
  debug() {
  }
};
var noopLogger = new NoopLogger();

// src/utils/async.ts
function handlePromiseOrValueFunction(func, callback, errorCallback) {
  if (typeof errorCallback === "function") {
    let result2;
    try {
      result2 = func();
    } catch (e) {
      errorCallback(e);
      return;
    }
    if (result2 instanceof Promise) {
      result2.then(
        (r) => callback(r),
        (e) => errorCallback(e)
      );
    } else {
      callback(result2);
    }
    return;
  }
  const result = func();
  if (result instanceof Promise) {
    result.then((r) => callback(r));
  } else {
    callback(result);
  }
}
function runPromiseOrValue(action, callback, errorCallback) {
  let result;
  try {
    result = action();
  } catch (e) {
    errorCallback(e);
    throw e;
  }
  if (!(result instanceof Promise)) {
    callback(result);
    return result;
  }
  return result.then(
    (r) => {
      callback(r);
      return r;
    },
    (e) => {
      errorCallback(e);
      throw e;
    }
  );
}

// src/time/default-time-provider.ts
function defaultTimeProvider() {
  return globalThis.performance?.now() ?? Date.now();
}

// src/tracer/tracer-impl.ts
import { EventSafeDispatcher } from "@tioniq/eventiq";
var TracerImpl = class {
  constructor(timeProvider) {
    __publicField(this, "outcomeRequest");
    __publicField(this, "outcomeNotification");
    __publicField(this, "outcomeError");
    __publicField(this, "outcomeResponse");
    __publicField(this, "incomeRequest");
    __publicField(this, "incomeNotification");
    this.outcomeRequest = new EventTracerImpl(timeProvider);
    this.outcomeNotification = new EventTracerImpl(
      timeProvider
    );
    this.outcomeError = new EventTracerImpl(timeProvider);
    this.outcomeResponse = new EventTracerImpl(
      timeProvider
    );
    this.incomeRequest = new EventTracerImpl(timeProvider);
    this.incomeNotification = new EventTracerImpl(
      timeProvider
    );
  }
};
var EventTracerImpl = class {
  constructor(timeProvider) {
    __publicField(this, "_onStart", new EventSafeDispatcher());
    __publicField(this, "_onEnd", new EventSafeDispatcher());
    __publicField(this, "_timeProvider");
    this._timeProvider = timeProvider;
  }
  get onStart() {
    return this._onStart;
  }
  get onEnd() {
    return this._onEnd;
  }
  start(event, runner) {
    const eventData = {
      ...event,
      startTime: this._timeProvider()
    };
    this._onStart.dispatch(eventData);
    let result;
    try {
      result = runner();
    } catch (e) {
      eventData.endTime = this._timeProvider();
      eventData.exception = e;
      this._onEnd.dispatch(eventData);
      throw e;
    }
    if (!(result instanceof Promise)) {
      eventData.endTime = this._timeProvider();
      eventData.result = result;
      this._onEnd.dispatch(eventData);
      return result;
    }
    return result.then(
      (r) => {
        eventData.endTime = this._timeProvider();
        eventData.result = r;
        this._onEnd.dispatch(eventData);
        return r;
      },
      (e) => {
        eventData.endTime = this._timeProvider();
        eventData.exception = e;
        this._onEnd.dispatch(eventData);
        throw e;
      }
    );
  }
};

// src/sender.ts
var RpcMessageSender = class {
  constructor(options) {
    __publicField(this, "_serializer");
    __publicField(this, "_channel");
    __publicField(this, "_batchDelay");
    __publicField(this, "_includeVersion");
    __publicField(this, "_batch");
    this._serializer = options.serializer;
    this._channel = options.channel;
    this._batchDelay = options.batchDelay;
    this._includeVersion = options.includeVersion ?? true;
  }
  /**
   * Send a JSON-RPC message. Can throw an exception during serialization or
   * sending (e.g. if the channel is closed).
   * @param message The message to send.
   */
  sendMessage(message) {
    if (this._includeVersion) {
      ;
      message.jsonrpc = "2.0";
    }
    const serialized = this._serializer(message);
    if (serialized instanceof Promise) {
      return serialized.then((r) => this._send(r));
    }
    return this._send(serialized);
  }
  _send(data) {
    if (this._batchDelay == void 0) {
      return this._channel.send(data);
    }
    let startBatch = false;
    if (!this._batch) {
      startBatch = true;
      this._batch = [];
    }
    const completer = new Completer();
    this._batch.push({
      message: data,
      completer
    });
    if (startBatch) {
      setTimeout(() => this._sendBatch(), this._batchDelay);
    }
    return completer.promise;
  }
  _sendBatch() {
    if (!this._batch) {
      return;
    }
    const batch = this._batch;
    this._batch = void 0;
    const messages = batch.map((b) => b.message);
    const message = `[${messages.join(",")}]`;
    let sendResult;
    try {
      sendResult = this._channel.send(message);
    } catch (e) {
      for (const b of batch) {
        b.completer.completeError(e);
      }
      return;
    }
    if (!(sendResult instanceof Promise)) {
      for (const b of batch) {
        b.completer.complete();
      }
      return;
    }
    sendResult.then(
      () => {
        for (const b of batch) {
          b.completer.complete();
        }
      },
      (e) => {
        for (const b of batch) {
          b.completer.completeError(e);
        }
      }
    );
  }
};

// src/receiver.ts
import { Disposable } from "@tioniq/disposiq";
import { EventDispatcher } from "@tioniq/eventiq";
var RpcMessageReceiver = class extends Disposable {
  constructor(options) {
    super();
    __publicField(this, "_channel");
    __publicField(this, "_checkIncomingVersion");
    __publicField(this, "_deserializer");
    __publicField(this, "_onParseMessageFailed", new EventDispatcher());
    __publicField(this, "_onInvalidRequest", new EventDispatcher());
    __publicField(this, "_onGeneralError", new EventDispatcher());
    __publicField(this, "_onRequestError", new EventDispatcher());
    __publicField(this, "_onNotification", new EventDispatcher());
    __publicField(this, "_onRequest", new EventDispatcher());
    __publicField(this, "_onResponse", new EventDispatcher());
    this._channel = options.channel;
    this._checkIncomingVersion = options.checkIncomingVersion ?? false;
    this._deserializer = options.deserializer;
    this.addDisposable(
      this._channel.onMessage.subscribe((m) => this._parseMessage(m))
    );
  }
  get onParseMessageFailed() {
    return this._onParseMessageFailed;
  }
  get onInvalidRequest() {
    return this._onInvalidRequest;
  }
  get onGeneralError() {
    return this._onGeneralError;
  }
  get onRequestError() {
    return this._onRequestError;
  }
  get onNotification() {
    return this._onNotification;
  }
  get onRequest() {
    return this._onRequest;
  }
  get onResponse() {
    return this._onResponse;
  }
  _parseMessage(message) {
    let data;
    try {
      data = this._deserializer(message);
    } catch (e) {
      this._onParseMessageFailed.dispatch({ message, error: e });
      return;
    }
    if (!(data instanceof Promise)) {
      this._handleMessage(data);
      return;
    }
    data.then(
      (d) => this._handleMessage(d),
      (e) => this._onParseMessageFailed.dispatch({ message, error: e })
    );
  }
  _handleMessage(data) {
    if (typeof data !== "object" || data === null) {
      this._onInvalidRequest.dispatch({
        request: data,
        error: new Error("Invalid request")
      });
      return;
    }
    if (Array.isArray(data)) {
      for (const item of data) {
        this._handleMessageObject(item);
      }
      return;
    }
    this._handleMessageObject(data);
  }
  _handleMessageObject(data) {
    if (typeof data !== "object" || data === null) {
      this._onInvalidRequest.dispatch({
        request: data,
        error: new Error("Response is not an object")
      });
      return;
    }
    if (this._checkIncomingVersion) {
      const version = data.jsonrpc;
      if (version !== "2.0") {
        this._onInvalidRequest.dispatch({
          request: data,
          error: new Error("Invalid JSON-RPC version")
        });
        return;
      }
    }
    const id = data.id;
    const error = data.error;
    if (error != void 0) {
      if (!isRpcError(error)) {
        this._onInvalidRequest.dispatch({
          request: data,
          error: new Error("Error object is invalid")
        });
        return;
      }
      if (id == null) {
        this._handleGeneralError(error);
        return;
      }
      this._handleRequestError(id, error);
      return;
    }
    const result = data.result;
    if (result != void 0) {
      if (id == null) {
        this._onInvalidRequest.dispatch({
          request: data,
          error: new Error("Result without id")
        });
        return;
      }
      this._handleRequestResult(id, result);
      return;
    }
    const method = data.method;
    if (typeof method !== "string") {
      this._onInvalidRequest.dispatch({
        request: data,
        error: new Error("Method is not a string")
      });
      return;
    }
    const params = data.params;
    if (id == null) {
      this._handleNotification(method, params);
      return;
    }
    this._handleRequest(method, id, params);
  }
  _handleGeneralError(error) {
    this._onGeneralError.dispatch(error);
  }
  _handleRequestError(id, error) {
    this._onRequestError.dispatch({ id, error });
  }
  _handleRequestResult(id, result) {
    this._onResponse.dispatch({ id, result });
  }
  _handleNotification(method, params) {
    this._onNotification.dispatch({ method, params });
  }
  _handleRequest(method, id, params) {
    this._onRequest.dispatch({ method, id, params });
  }
};
function isRpcError(e) {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

// src/json-rpc.ts
var ordinal = 0;
var Peer = class {
  constructor(channel, options) {
    /**
     * @internal
     */
    __publicField(this, "_disposables", new DisposableStore());
    /**
     * @internal
     */
    __publicField(this, "_onClose", new EventDispatcher2());
    /**
     * @internal
     */
    __publicField(this, "_onOpen", new EventDispatcher2());
    /**
     * @internal
     */
    __publicField(this, "_onGeneralError", new EventDispatcher2());
    /**
     * @internal
     */
    __publicField(this, "_onNotification", /* @__PURE__ */ new Map());
    /**
     * @internal
     */
    __publicField(this, "_pendingRequests", /* @__PURE__ */ new Map());
    /**
     * @internal
     */
    __publicField(this, "_requestHandlers", /* @__PURE__ */ new Map());
    /**
     * @internal
     */
    __publicField(this, "_sender");
    /**
     * @internal
     */
    __publicField(this, "_receiver");
    /**
     * @internal
     */
    __publicField(this, "_tracer");
    /**
     * @internal
     */
    __publicField(this, "_channel");
    /**
     * @internal
     */
    __publicField(this, "_logger");
    /**
     * @internal
     */
    __publicField(this, "_timeProvider");
    /**
     * @internal
     */
    __publicField(this, "_exceptionDetailsProvider");
    /**
     * @internal
     */
    __publicField(this, "_id");
    /**
     * @internal
     */
    __publicField(this, "_ordinal", ++ordinal);
    /**
     * @internal
     */
    __publicField(this, "_closed", false);
    /**
     * @internal
     */
    __publicField(this, "_idCounter", 0);
    this._channel = channel;
    this._id = options?.id ?? uuid();
    this._logger = options?.logger ?? noopLogger;
    this._sender = new RpcMessageSender({
      serializer: options?.serializer ?? JSON.stringify,
      channel,
      batchDelay: options?.batchDelay,
      includeVersion: options?.includeVersion
    });
    this._receiver = new RpcMessageReceiver({
      deserializer: options?.deserializer ?? JSON.parse,
      channel
    });
    this._timeProvider = options?.timeProvider ?? defaultTimeProvider;
    this._exceptionDetailsProvider = options?.exceptionDetailsProvider ?? (() => void 0);
    this._tracer = new TracerImpl(this._timeProvider);
    this._disposables.add(
      this._receiver.onParseMessageFailed.subscribe((e) => {
        this._logger.error("Failed to parse message", e);
        this.sendError(Errors.parseError);
      }),
      this._receiver.onInvalidRequest.subscribe((e) => {
        this._logger.error("Invalid request", e);
        this.sendError({
          ...Errors.invalidRequest,
          data: {
            details: e.error?.message ?? e.error?.toString() ?? "Unknown"
          }
        });
      })
    );
    this._disposables.add(
      this._receiver.onGeneralError.subscribe(
        (e) => this._handleGeneralError(e)
      ),
      this._receiver.onNotification.subscribe(
        (n) => this._handleNotification(n)
      ),
      this._receiver.onRequestError.subscribe((r) => {
        this._handleRequestError(r.id, r.error);
      }),
      this._receiver.onResponse.subscribe((r) => {
        this._handleResponse(r);
      }),
      this._receiver.onRequest.subscribe((r) => {
        this._handleRequest(r);
      })
    );
    this._disposables.add(
      this._receiver,
      channel.onClose?.subscribe(() => this._handleClose()),
      channel.onOpen?.subscribe(() => this._handleOpen()),
      () => this._handleClose()
    );
    if (options?.closeChannelOnDispose && typeof channel.close === "function") {
      this._disposables.add(() => channel.close?.());
    }
    if (this._channel.isOpen === false) {
      this._closed = true;
    }
  }
  /**
   * Peer identifier
   */
  get id() {
    return this._id;
  }
  /**
   * Peer ordinal. The ordinal is a unique number that is assigned to each
   * instance of the Peer class. The number is incremented for each new instance.
   * The ordinal is useful for debugging and logging purposes, especially when
   * multiple instances of the Peer class are used.
   */
  get ordinal() {
    return this._ordinal;
  }
  /**
   * Check if the connection is closed
   */
  get closed() {
    return this._closed;
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
  get onClose() {
    return this._onClose;
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
  get onGeneralError() {
    return this._onGeneralError;
  }
  get tracer() {
    return this._tracer;
  }
  /**
   * Dispose the Peer instance. Will unsubscribe from all events.
   * The connection will be closed if the option
   * `closeChannelOnDispose` is set to true.
   * Will throw {@link ConnectionClosedException} to all pending requests even
   * if `closeChannelOnDispose` is set to false.
   */
  dispose() {
    this._disposables.dispose();
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
  sendRequest(method, params) {
    this._disposables.throwIfDisposed();
    this._checkConnection();
    const id = ++this._idCounter;
    const completer = new Completer();
    this._pendingRequests.set(id, completer);
    const request = {
      id,
      method,
      params
    };
    return this._tracer.outcomeRequest.start(
      {
        peer: this,
        request
      },
      async () => {
        handlePromiseOrValueFunction(
          () => this._sendMessage(request),
          noop,
          (e) => {
            completer.completeError(e);
            this._pendingRequests.delete(id);
          }
        );
        return await completer.promise;
      }
    );
  }
  /**
   * Send a notification with the method and specified params
   * @param method
   * @param params
   */
  sendNotification(method, params) {
    this._disposables.throwIfDisposed();
    this._checkConnection();
    const notification = {
      method,
      params
    };
    this._tracer.outcomeNotification.start(
      {
        peer: this,
        notification
      },
      () => this._sendMessage(notification)
    );
  }
  /**
   * Send an error
   * @param error
   * @param requestId if provided the error will associate with the request, otherwise - it will be sent as a general error
   */
  sendError(error, requestId) {
    this._disposables.throwIfDisposed();
    this._checkConnection();
    this._tracer.outcomeError.start(
      {
        peer: this,
        error,
        requestId
      },
      () => this._sendMessage({
        error,
        id: requestId
      })
    );
  }
  /**
   * Send a response in a custom way
   * @param response response data. The request id and the result must be provided
   */
  sendResponse(response) {
    this._disposables.throwIfDisposed();
    this._checkConnection();
    handlePromiseOrValueFunction(
      () => this._tracer.outcomeResponse.start(
        {
          peer: this,
          response
        },
        () => this._sendMessage({
          id: response.id,
          result: response.result
        })
      ),
      noop,
      (e) => {
        this._logger.error("Failed to send response", {
          response,
          error: e
        });
      }
    );
  }
  /**
   * Get an event observer for the specific method
   * @param method notification method
   */
  onNotification(method) {
    let dispatcher = this._onNotification.get(method);
    if (dispatcher === void 0) {
      dispatcher = new EventDispatcher2();
      this._onNotification.set(method, dispatcher);
    }
    return dispatcher;
  }
  /**
   * Set request handler for the method. If the handler returns an undefined
   * value, the response will not be sent and the handler MUST send the
   * response manually, see {@link sendResponse}, {@link sendError}.
   * @param method request method
   * @param handler request handler
   * @returns disposable object that will unset the handler on dispose
   */
  setRequestHandler(method, handler) {
    const internalHandler = (request, requestId, method2) => {
      handlePromiseOrValueFunction(
        () => this._tracer.incomeRequest.start(
          {
            peer: this,
            request: {
              id: requestId,
              method: method2,
              params: request
            }
          },
          () => runPromiseOrValue(
            () => handler(request, requestId, method2),
            (response) => {
              if (response === void 0) {
                return;
              }
              this.sendResponse({
                id: requestId,
                result: response
              });
            },
            (e) => {
              let error;
              if (isRpcError2(e)) {
                error = {
                  code: e.code,
                  message: e.message,
                  data: e.data
                };
              } else {
                const details = this._exceptionDetailsProvider(e);
                if (details !== void 0) {
                  error = {
                    ...Errors.serverError,
                    data: details
                  };
                } else {
                  error = Errors.serverError;
                }
              }
              this.sendError(error, requestId);
            }
          )
        ),
        noop,
        noop
      );
    };
    this._requestHandlers.set(method, internalHandler);
    return new DisposableAction(() => {
      const currentHandler = this._requestHandlers.get(method);
      if (currentHandler === internalHandler) {
        this._requestHandlers.delete(method);
      }
    });
  }
  /**
   * Close the connection. Will throw {@link ConnectionClosedException} to all
   * pending requests
   */
  close() {
    return this._channel.close?.();
  }
  /**
   * @internal
   */
  _sendMessage(message) {
    return this._sender.sendMessage(message);
  }
  /**
   * @internal
   */
  _checkConnection() {
    if (this._closed) {
      throw new ConnectionClosedException();
    }
  }
  /**
   * @internal
   */
  _handleGeneralError(error) {
    this._onGeneralError.dispatch(error);
  }
  /**
   * @internal
   */
  _handleNotification(notification) {
    this._tracer.incomeNotification.start(
      {
        peer: this,
        notification
      },
      () => {
        const dispatcher = this._onNotification.get(notification.method);
        if (!dispatcher) {
          this._logger.debug("Unhandled notification", notification.method);
          return;
        }
        dispatcher.dispatch(notification.params);
      }
    );
  }
  /**
   * @internal
   */
  _handleRequestError(requestId, error) {
    const completer = this._pendingRequests.get(requestId);
    if (completer == void 0) {
      const details = `Request ${requestId} not found`;
      this._logger.error(details);
      this.sendError({
        ...Errors.invalidRequest,
        data: {
          details
        }
      });
      return;
    }
    this._pendingRequests.delete(requestId);
    completer.completeError(error);
  }
  /**
   * @internal
   */
  _handleResponse(response) {
    const completer = this._pendingRequests.get(response.id);
    if (completer == null) {
      const details = `Request ${response.id} not found`;
      this._logger.error(details);
      this.sendError({
        ...Errors.invalidRequest,
        data: {
          details
        }
      });
      return;
    }
    this._pendingRequests.delete(response.id);
    completer.complete(response.result);
  }
  /**
   * @internal
   */
  _handleRequest(request) {
    const handler = this._requestHandlers.get(request.method);
    if (!handler) {
      this._logger.error(`No request handler for ${request.method}`);
      this.sendError(Errors.methodNotFound, request.id);
      return;
    }
    handler(request.params, request.id, request.method);
  }
  /**
   * @internal
   */
  _handleClose() {
    if (this._closed) {
      return;
    }
    this._closed = true;
    this._onClose.dispatch();
    if (this._pendingRequests.size == 0) {
      return;
    }
    const pendingRequests = Array.from(this._pendingRequests.values());
    this._pendingRequests.clear();
    for (const completer of pendingRequests) {
      completer.completeError(new ConnectionClosedException());
    }
  }
  /**
   * @internal
   */
  _handleOpen() {
    if (!this._closed) {
      return;
    }
    this._closed = false;
    this._onOpen.dispatch();
  }
};
function isRpcError2(e) {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}
function noop() {
}
export {
  ConnectionClosedException,
  Errors,
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
  Peer,
  RpcException,
  SERVER_ERROR,
  errorName,
  isRpcError2 as isRpcError
};
