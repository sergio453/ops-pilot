export class RequestIdCollisionError extends Error {}
export class RequestNotFoundError extends Error {}
export class TracePersistenceError extends Error {
  constructor(options?: ErrorOptions) { super("Trace persistence failed", options); }
}
