import type { TraceEvent, ReasoningInput } from "./types.js";

export function createTraceEmitter(input: ReasoningInput) {
  const emitted = new WeakSet<TraceEvent>();
  const publish = (events: TraceEvent[], node: string) => {
    for (const event of events) {
      event.node ??= node;
      if (!emitted.has(event)) {
        emitted.add(event);
        input.onTrace?.(event);
      }
    }
    return events;
  };
  const collect = (node: string): TraceEvent[] => {
    const events: TraceEvent[] = [];
    Object.defineProperty(events, "push", { value: (...items: TraceEvent[]) => {
      publish(items, node);
      return Array.prototype.push.apply(events, items);
    } });
    return events;
  };
  return { publish, collect };
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

export function formatTraceEvent(event: TraceEvent, index: number): string {
  const header = `${index + 1}. [${event.type.toUpperCase()}]`;
  if (event.type === "action" && event.action) {
    return `${header} ${event.action.tool} ${stringifyValue(event.action.args)}`;
  }

  return `${header} ${event.content}`;
}

export function formatTrace(trace: TraceEvent[]): string {
  if (trace.length === 0) {
    return "  (sem eventos)";
  }

  return trace.map((event, index) => `  ${formatTraceEvent(event, index)}`).join("\n");
}
