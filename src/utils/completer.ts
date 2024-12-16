export class Completer<T> {
  public readonly promise: Promise<T>
  private resolve: (value: T | PromiseLike<T>) => void = null!
  private reject: (reason?: any) => void = null!
  private completed = false

  constructor(executor?: (() => void) | undefined) {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
      if (executor) {
        executor()
      }
    })
  }

  public complete(value: T) {
    if (this.completed) {
      return
    }
    this.completed = true
    this.resolve(value)
  }

  public completeError(error: any) {
    if (this.completed) {
      return
    }
    this.completed = true
    this.reject(error)
  }
}
