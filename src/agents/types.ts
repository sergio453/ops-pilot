export type TraceEventType =
  | "thought"
  | "action"
  | "observation"
  | "plan"
  | "critique"
  | "answer";

export interface ActionPayload {
  tool: string;
  args: Record<string, unknown>;
}

export interface TraceEvent {
  type: TraceEventType;
  content: string;
  node?: string;
  action?: ActionPayload;
}

export interface ContextBreakdown {
  memories: number;
  history: number;
  userMessage: number;
  totalEstimated: number;
}

export interface ReasoningMetrics {
  llCalls: number;
  latencyMs: number;
  historyMessages?: number;
  memoryHits?: number;
  promptTokens?: number;
  contextBreakdown?: ContextBreakdown;
  modelUsed?: string;
}

export interface ReasoningInput {
  prompt: string;
  maxIterations: number;
  onTrace?: (event: TraceEvent) => void;
}

export interface ReflectionOptions {
  maxReflections?: number;
  name?: string;
}

export interface CritiqueVerdict {
  approved: boolean;
  feedback: string;
}

export interface ReasoningResult {
  answer: string;
  trace: TraceEvent[];
  metrics: ReasoningMetrics;
}

export interface ReasoningStrategy {
  name: string;
  run(input: ReasoningInput): Promise<ReasoningResult>;
}
