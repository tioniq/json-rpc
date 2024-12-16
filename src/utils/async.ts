export type PromiseOrValue<T> = Promise<T> | T

export function handlePromiseOrValueFunction<T>(
  func: () => PromiseOrValue<T>,
  callback: (value: T) => void,
  errorCallback?: (error: unknown) => void,
) {
  if (typeof errorCallback === "function") {
    let result: PromiseOrValue<T>
    try {
      result = func()
    } catch (e) {
      errorCallback(e)
      return
    }
    if (result instanceof Promise) {
      result.then(
        (r) => callback(r),
        (e) => errorCallback(e),
      )
    } else {
      callback(result)
    }
    return
  }
  const result = func()
  if (result instanceof Promise) {
    result.then((r) => callback(r))
  } else {
    callback(result)
  }
}
