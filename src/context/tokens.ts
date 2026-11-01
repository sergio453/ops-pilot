export interface ContextBreakdown {
  memories: number;
  history: number;
  userMessage: number;
  totalEstimated: number;
}

export interface ContextBreakdownInput {
  memories?: Array<{ fact: string }>;
  history?: Array<{ role: string; content: string }>;
  userMessage: string;
}

export interface TokenUsageMetadata {
  promptTokens: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Heurística de estimativa de tokens baseada em caracteres divididos por 4.
 * Retorna 0 para strings vazias e Math.ceil(chars / 4) para outros casos.
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/**
 * Extrai o total real de tokens de prompt a partir de mensagens retornadas pelo LangChain.
 * Se nenhum metadata de uso for encontrado, utiliza o fallbackText estimado se fornecido.
 */
export function extractPromptTokens(messages: unknown[], fallbackText?: string): number {
  let promptTokens = 0;
  let foundUsage = false;

  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (typeof msg === "object" && msg !== null) {
        const record = msg as Record<string, unknown>;

        // 1. LangChain standard usage_metadata
        const usage = record.usage_metadata as Record<string, unknown> | undefined;
        if (usage && typeof usage.input_tokens === "number") {
          promptTokens += usage.input_tokens;
          foundUsage = true;
          continue;
        }

        // 2. response_metadata tokenUsage / usage
        const respMetadata = record.response_metadata as Record<string, unknown> | undefined;
        const tokenUsage = (respMetadata?.tokenUsage ?? respMetadata?.usage) as Record<string, unknown> | undefined;
        const pt = tokenUsage?.promptTokens ?? tokenUsage?.prompt_tokens ?? tokenUsage?.input_tokens;
        if (typeof pt === "number") {
          promptTokens += pt;
          foundUsage = true;
        }
      }
    }
  }

  if (foundUsage) {
    return promptTokens;
  }

  if (fallbackText) {
    return estimateTokens(fallbackText);
  }

  return 0;
}

/**
 * Calcula a decomposição estimada de tokens nas parcelas do prompt.
 *
 * Cada parcela é estimada independentemente com o mesmo formato que será
 * usado ao montar o prompt composto, garantindo que:
 *   totalEstimated >= memories + history + userMessage
 * (pois o texto completo inclui separadores "\n" entre parcelas).
 *
 * Quando memories e history estão vazios, userMessage e totalEstimated
 * representam o mesmo texto literal passado (sem wrapper "USER:").
 */
export function calculateContextBreakdown(input: ContextBreakdownInput): ContextBreakdown {
  const memoriesList = input.memories ?? [];
  const historyList = input.history ?? [];

  const memoriesLines = memoriesList.map((m) => `MEMORY: ${m.fact}`);
  const historyLines = historyList.map((m) =>
    `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`,
  );

  const hasPriorContext = memoriesLines.length > 0 || historyLines.length > 0;

  // Estimate each source with the exact text it contributes to the prompt
  const memories = estimateTokens(memoriesLines.join("\n"));
  const history = estimateTokens(historyLines.join("\n"));

  // userMessage appears wrapped as "USER: <msg>" only when there is prior context
  const userMessageText = hasPriorContext
    ? `USER: ${input.userMessage}`
    : (input.userMessage ?? "");
  const userMessage = estimateTokens(userMessageText);

  // totalEstimated: the whole prompt as a single string
  const allParts = [...memoriesLines, ...historyLines];
  const fullPromptText = allParts.length === 0
    ? (input.userMessage ?? "")
    : [...allParts, `USER: ${input.userMessage}`].join("\n");
  const totalEstimated = estimateTokens(fullPromptText);

  return {
    memories,
    history,
    userMessage,
    totalEstimated,
  };
}
