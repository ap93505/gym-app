export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "BAD_REQUEST",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function assert(condition: unknown, message: string, status = 400, code = "BAD_REQUEST"): asserts condition {
  if (!condition) throw new AppError(message, status, code);
}
