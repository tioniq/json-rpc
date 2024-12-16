export function defaultTimeProvider(): number {
  return globalThis.performance?.now() ?? Date.now()
}
