declare module "@langchain/langgraph" {
  export const START: "__start__";
  export const END: "__end__";

  export interface AnnotationFieldOptions<TValue> {
    reducer?: (left: TValue, right: TValue) => TValue;
    default?: () => TValue;
  }

  export interface AnnotationRoot<TState> {
    State: TState;
  }

  export interface AnnotationFactory {
    <TValue>(options?: AnnotationFieldOptions<TValue>): unknown;
    Root<TState>(shape: Record<string, unknown>): AnnotationRoot<TState>;
  }

  export const Annotation: AnnotationFactory;

  export class StateGraph<TState> {
    constructor(schema: unknown);
    addNode(
      name: string,
      node: (state: TState) => Promise<Partial<TState> | void> | Partial<TState> | void,
    ): this;
    addEdge(from: string, to: string): this;
    addConditionalEdges(
      from: string,
      route: (state: TState) => string | typeof END,
    ): this;
    compile(): {
      invoke(input: TState): Promise<TState>;
    };
  }
}

declare module "@langchain/langgraph/prebuilt" {
  import type { BaseMessage } from "@langchain/core/messages";

  export interface ReactAgent {
    stream(
      input: { messages: BaseMessage[] },
      config: { recursionLimit?: number; streamMode: "updates" },
    ): Promise<AsyncIterable<Record<string, { messages?: BaseMessage[] }>>>;
    invoke(
      input: { messages: BaseMessage[] },
      config?: { recursionLimit?: number },
    ): Promise<{ messages: BaseMessage[] }>;
  }

  export function createReactAgent(params: {
    llm: unknown;
    tools: unknown[];
    prompt?: string;
  }): ReactAgent;
}
