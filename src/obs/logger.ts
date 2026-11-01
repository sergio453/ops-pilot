import { logEventSchema, type LogEventLine } from "./types.js";

export interface Logger { info(event: LogEventLine): void }
export function serializeLogEvent(event: LogEventLine): string {
  // zod strips every key outside the allowlist, including accidental payload/request fields.
  return JSON.stringify(logEventSchema.parse(event)) + "\n";
}
export function createLogger(sink: (line: string) => void = (line) => { process.stdout.write(line); }): Logger {
  return { info: (event) => sink(serializeLogEvent(event)) };
}
