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

export function runPromiseOrValue<T>(
  action: () => T,
  callback: (value: Awaited<T>) => void,
  errorCallback: (e: unknown) => void,
): T {
  let result: T
  try {
    result = action()
  } catch (e) {
    errorCallback(e)
    throw e
  }
  if (!(result instanceof Promise)) {
    callback(result as Awaited<T>)
    return result
  }
  return result.then(
    (r) => {
      callback(r)
      return r
    },
    (e) => {
      errorCallback(e)
      throw e
    },
  ) as T
}
