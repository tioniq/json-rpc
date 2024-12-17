import { EventObserver } from '@tioniq/eventiq';
import { IDisposable, Disposiq } from '@tioniq/disposiq';

type PromiseOrValue<T> = Promise<T> | T;

interface ChannelMinimal<T> {
    get onMessage(): EventObserver<T>;
    send(message: T): PromiseOrValue<void>;
}
interface ClosableChannel {
    get onClose(): EventObserver;
    get onOpen(): EventObserver;
    get isOpen(): boolean;
    close(): PromiseOrValue<void>;
    open(): PromiseOrValue<void>;
}
type Channel<T> = ChannelMinimal<T> & Partial<ClosableChannel>;

type RequestHandler<T> = (request: unknown, requestId: RequestId, method: string) => PromiseOrValue<T>;
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
interface Error {
    /**
     * A Number that indicates the error type that occurred.
     * This MUST be an integer.
     */
    readonly code: number;
    /**
     * A String providing a short description of the error.
     * The message SHOULD be limited to a concise single sentence.
     */
    readonly message: string;
    /**
     * A Primitive or Structured value that contains additional information about the error.
     * This may be omitted.
     * The value of this member is defined by the Server (e.g. detailed error information, nested errors etc.).
     */
    readonly data?: unknown;
}
type RequestId = string | number;
/**
 * A rpc call is represented by sending a Request object to a Server.
 */
interface Request {
    /**
     * An identifier established by the Client that MUST contain a String, Number,
     * or NULL value if included. If it is not included it is assumed to be a
     * notification. The value SHOULD normally not be Null and Numbers
     * SHOULD NOT contain fractional parts
     */
    readonly id: RequestId;
    /**
     * A String containing the name of the method to be invoked. Method names that
     * begin with the word rpc followed by a period character (U+002E or ASCII 46)
     * are reserved for rpc-internal methods and extensions and MUST NOT be used
     * for anything else.
     */
    readonly method: string;
    /**
     * A Structured value that holds the parameter values to be used during the
     * invocation of the method. This member MAY be omitted.
     */
    readonly params?: unknown;
}
/**
 * When a rpc call is made, the Server MUST reply with a Response, except for in
 * the case of Notifications.
 */
interface Response {
    /**
     * This member is REQUIRED.
     * It MUST be the same as the value of the id member in the Request Object.
     * If there was an error in detecting the id in the Request object (e.g. Parse
     * error/Invalid Request), it MUST be Null.
     */
    readonly id: RequestId;
    /**
     * This member is REQUIRED on success.
     * This member MUST NOT exist if there was an error invoking the method.
     * The value of this member is determined by the method invoked on the Server.
     */
    readonly result: unknown;
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
interface Notification {
    /**
     * A String containing the name of the method to be invoked. Method names that
     * begin with the word rpc followed by a period character (U+002E or ASCII 46)
     * are reserved for rpc-internal methods and extensions and MUST NOT be used
     * for anything else.
     */
    method: string;
    /**
     * A Structured value that holds the parameter values to be used during the
     * invocation of the method. This member MAY be omitted.
     */
    params?: unknown;
}

interface Logger {
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    info(...args: unknown[]): void;
    debug(...args: unknown[]): void;
}

interface Tracer {
    get outcomeRequest(): EventTracer<OutcomeRequestEvent>;
    get outcomeNotification(): EventTracer<OutcomeNotificationEvent>;
    get outcomeError(): EventTracer<OutcomeErrorEvent>;
    get outcomeResponse(): EventTracer<OutcomeResponseEvent>;
    get incomeRequest(): EventTracer<IncomeRequestEvent>;
    get incomeNotification(): EventTracer<IncomeNotificationEvent>;
}
interface EventTracer<T> {
    get onStart(): EventObserver<T & EventStartData>;
    get onEnd(): EventObserver<T & EventStartData & EventEndData>;
}
interface EventStartData {
    startTime: number;
}
interface EventEndData {
    endTime: number;
    exception?: unknown;
    error?: unknown;
    result?: unknown;
}
interface OutcomeRequestEvent {
    readonly peer: Peer;
    readonly request: Request;
}
interface OutcomeNotificationEvent {
    readonly peer: Peer;
    readonly notification: Notification;
}
interface OutcomeErrorEvent {
    readonly peer: Peer;
    readonly error: Error;
    readonly requestId?: RequestId;
}
interface OutcomeResponseEvent {
    readonly peer: Peer;
    readonly response: Response;
}
interface IncomeRequestEvent {
    readonly peer: Peer;
    readonly request: Request;
}
interface IncomeNotificationEvent {
    readonly peer: Peer;
    readonly notification: Notification;
}

type TimeProvider = () => number;

type Deserializer = (data: string) => PromiseOrValue<unknown>;
type Serializer = (data: unknown) => PromiseOrValue<string>;
interface PeerOptions {
    /**
     * Peer identifier. If not provided, the random UUID will be generated
     */
    id?: string;
    /**
     * Logger instance. If not provided, the no-op logger will be used
     */
    logger?: Logger;
    /**
     * Time provider. If not provided, the default time provider will be used
     */
    timeProvider?: TimeProvider;
    /**
     * Serializer function. If not provided, the JSON.stringify will be used
     */
    serializer?: Serializer;
    /**
     * Deserializer function. If not provided, the JSON.parse will be used
     */
    deserializer?: Deserializer;
    /**
     * Whenever the messages should be batched before sending. If the value is
     * provided, the messages will be batched and sent with the specified delay
     * in milliseconds. If the value is not provided, the messages will be sent
     * immediately. If the value is 0, the messages will be sent in the next
     * event loop iteration
     * @default undefined
     */
    batchDelay?: number;
    /**
     * Whether to include the Json-RPC version in the messages
     * @default true
     */
    includeVersion?: boolean;
    /**
     * Whether to check the incoming Json-RPC version. If the version is not
     * provided or not equal to 2.0, the message will be ignored and an error will
     * be sent
     */
    checkIncomingVersion?: boolean;
    /**
     * Whether to close the channel when the Peer instance is disposed
     * @default false
     * @see {@link Channel.close}
     */
    closeChannelOnDispose?: boolean;
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
    exceptionDetailsProvider?: (e: unknown) => unknown;
}
/**
 * Json-RPC 2.0 Duplex Peer implementation. Can be used for both client and server sides.
 *
 * {@link https://www.jsonrpc.org/specification}
 */
declare class Peer implements IDisposable {
    constructor(channel: Channel<string>, options?: PeerOptions);
    /**
     * Peer identifier
     */
    get id(): string;
    /**
     * Peer ordinal. The ordinal is a unique number that is assigned to each
     * instance of the Peer class. The number is incremented for each new instance.
     * The ordinal is useful for debugging and logging purposes, especially when
     * multiple instances of the Peer class are used.
     */
    get ordinal(): number;
    /**
     * Check if the connection is closed
     */
    get closed(): boolean;
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
    get onClose(): EventObserver;
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
    get onGeneralError(): EventObserver<Error>;
    get tracer(): Tracer;
    /**
     * Dispose the Peer instance. Will unsubscribe from all events.
     * The connection will be closed if the option
     * `closeChannelOnDispose` is set to true.
     * Will throw {@link ConnectionClosedException} to all pending requests even
     * if `closeChannelOnDispose` is set to false.
     */
    dispose(): void;
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
    sendRequest(method: string, params?: unknown): Promise<unknown>;
    /**
     * Send a notification with the method and specified params
     * @param method
     * @param params
     */
    sendNotification(method: string, params?: unknown): void;
    /**
     * Send an error
     * @param error
     * @param requestId if provided the error will associate with the request, otherwise - it will be sent as a general error
     */
    sendError(error: Error, requestId?: RequestId | undefined): void;
    /**
     * Send a response in a custom way
     * @param response response data. The request id and the result must be provided
     */
    sendResponse(response: Response): void;
    /**
     * Get an event observer for the specific method
     * @param method notification method
     */
    onNotification(method: string): EventObserver<unknown>;
    /**
     * Set request handler for the method. If the handler returns an undefined
     * value, the response will not be sent and the handler MUST send the
     * response manually, see {@link sendResponse}, {@link sendError}.
     * @param method request method
     * @param handler request handler
     * @returns disposable object that will unset the handler on dispose
     */
    setRequestHandler<T>(method: string, handler: RequestHandler<T>): Disposiq;
    /**
     * Close the connection. Will throw {@link ConnectionClosedException} to all
     * pending requests
     */
    close(): PromiseOrValue<void>;
}
declare function isRpcError(e: unknown): e is Error;

/**
 * An error code indicating that invalid JSON was received by the server.
 */
declare const PARSE_ERROR = -32700;
/**
 * An error code indicating that the request JSON was invalid according to the JSON-RPC 2.0 spec.
 */
declare const INVALID_REQUEST = -32600;
/**
 * An error code indicating that the requested method does not exist or is unavailable.
 */
declare const METHOD_NOT_FOUND = -32601;
/**
 * An error code indicating that the request parameters are invalid for the requested method.
 */
declare const INVALID_PARAMS = -32602;
/**
 * An internal JSON-RPC error.
 */
declare const INTERNAL_ERROR = -32603;
/**
 * An unexpected error occurred on the server.
 * The spec reserves the range from -32000 to -32099 for implementation-defined
 * server exceptions, but for now we only use one of those values.
 */
declare const SERVER_ERROR = -32000;
/**
 * Returns a human-readable name for [errorCode] if it's one specified by the JSON-RPC 2.0 spec.
 * If {@link errorCode} isn't defined in the JSON-RPC 2.0 spec, returns null.
 */
declare function errorName(errorCode: number): string | null;

type DefaultErrors = "parseError" | "invalidRequest" | "methodNotFound" | "invalidParams" | "internalError" | "serverError";
declare const Errors: Readonly<{
    [key in DefaultErrors]: Error;
}>;
declare class ConnectionClosedException extends globalThis.Error {
    constructor();
}
declare class RpcException extends globalThis.Error implements Error {
    readonly code: number;
    readonly data?: unknown;
    constructor(error: Error);
}

export { type Channel, type ChannelMinimal, type ClosableChannel, ConnectionClosedException, type Error, Errors, INTERNAL_ERROR, INVALID_PARAMS, INVALID_REQUEST, type Logger, METHOD_NOT_FOUND, type Notification, PARSE_ERROR, Peer, type PeerOptions, type Request, type RequestHandler, type RequestId, type Response, RpcException, SERVER_ERROR, type TimeProvider, errorName, isRpcError };
