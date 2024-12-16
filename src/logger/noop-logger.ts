import { Logger } from "./logger.ts";

class NoopLogger implements Logger {
  error(): void {

  }

  warn(): void {

  }

  info(): void {

  }

  debug(): void {

  }
}

export const noopLogger = new NoopLogger()