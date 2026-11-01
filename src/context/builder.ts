import { estimateTokens } from "./tokens.js";
import type { ConversationMessage } from "../store/sqlite-conversation-store.js";
import type { MemoryRecord } from "../memory/memory-store.js";

export type CutPolicy = "never" | "oldest-first" | "lowest-score-first";

export interface SectionBudget {
  budget: number;
  cut: CutPolicy;
}

export type SectionKind = "system" | "summary" | "history" | "memories";

export interface ScoredMemory extends MemoryRecord {
  score?: number;
}

export interface SectionItem {
  id?: string | number;
  text: string;
  score?: number;
  timestamp?: string;
}

export interface ContextSection {
  kind: SectionKind;
  items: SectionItem[];
  options: SectionBudget;
}

export interface BuildContextBreakdown {
  system: number;
  summary: number;
  history: number;
  memories: number;
  userMessage: number;
  totalEstimated: number;
}

export interface BuildContext {
  prompt: string;
  breakdown: BuildContextBreakdown;
  sections: Record<SectionKind, string>;
}

export interface BuildInput {
  conversationId?: string;
  userId?: string;
  message: string;
  systemPrompt?: string;
  summary?: string | null;
  history?: ConversationMessage[];
  memories?: ScoredMemory[];
  budgets?: {
    system?: number;
    summary?: number;
    history?: number;
    memories?: number;
  };
}

export const DEFAULT_BUDGETS = {
  system: 250,
  summary: 200,
  history: 600,
  memories: 300,
};

export function section(
  kind: SectionKind,
  content: string | null | undefined | ConversationMessage[] | ScoredMemory[],
  options: SectionBudget,
): ContextSection {
  const items: SectionItem[] = [];

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.length > 0) {
      items.push({ text: trimmed });
    }
  } else if (Array.isArray(content)) {
    if (kind === "history") {
      const messages = content as ConversationMessage[];
      for (const msg of messages) {
        const roleLabel = msg.role === "user" ? "USER" : "ASSISTANT";
        items.push({
          text: `${roleLabel}: ${msg.content}`,
          timestamp: msg.createdAt,
        });
      }
    } else if (kind === "memories") {
      const mems = content as ScoredMemory[];
      for (const m of mems) {
        items.push({
          id: m.id,
          text: `MEMORY: ${m.fact}`,
          score: m.score ?? 1.0,
          timestamp: m.createdAt,
        });
      }
    }
  }

  return {
    kind,
    items,
    options,
  };
}

export function fitToBudget(sec: ContextSection): ContextSection {
  const { budget, cut } = sec.options;
  if (cut === "never" || budget <= 0 || sec.items.length === 0) {
    return sec;
  }

  const currentItems = [...sec.items];

  function totalTokens(items: SectionItem[]): number {
    if (items.length === 0) return 0;
    const combined = items.map((i) => i.text).join("\n");
    return estimateTokens(combined);
  }

  if (totalTokens(currentItems) <= budget) {
    return sec;
  }

  if (cut === "oldest-first") {
    while (currentItems.length > 0 && totalTokens(currentItems) > budget) {
      currentItems.shift();
    }
  } else if (cut === "lowest-score-first") {
    while (currentItems.length > 0 && totalTokens(currentItems) > budget) {
      let lowestIndex = 0;
      let minScore = currentItems[0]?.score ?? 0;
      for (let i = 1; i < currentItems.length; i++) {
        const s = currentItems[i]?.score ?? 0;
        if (s < minScore) {
          minScore = s;
          lowestIndex = i;
        }
      }
      currentItems.splice(lowestIndex, 1);
    }
  }

  return {
    ...sec,
    items: currentItems,
  };
}

export function assemble(fittedSections: ContextSection[], userMessage: string): BuildContext {
  const parts: string[] = [];
  const sectionTexts: Record<SectionKind, string> = {
    system: "",
    summary: "",
    history: "",
    memories: "",
  };

  const breakdown: BuildContextBreakdown = {
    system: 0,
    summary: 0,
    history: 0,
    memories: 0,
    userMessage: 0,
    totalEstimated: 0,
  };

  for (const sec of fittedSections) {
    if (sec.items.length === 0) continue;
    let text = "";
    if (sec.kind === "summary") {
      text = `SUMMARY: ${sec.items.map((i) => i.text).join("\n")}`;
    } else {
      text = sec.items.map((i) => i.text).join("\n");
    }

    sectionTexts[sec.kind] = text;
    parts.push(text);
    breakdown[sec.kind] = estimateTokens(text);
  }

  const hasPriorContext = parts.length > 0;
  const userMessageFormatted = hasPriorContext
    ? `USER: ${userMessage.trim()}`
    : userMessage.trim();

  parts.push(userMessageFormatted);
  breakdown.userMessage = estimateTokens(userMessageFormatted);

  const fullPrompt = parts.join("\n");
  breakdown.totalEstimated = estimateTokens(fullPrompt);

  return {
    prompt: fullPrompt,
    breakdown,
    sections: sectionTexts,
  };
}

export function buildContext(input: BuildInput): BuildContext {
  const B = {
    system: input.budgets?.system ?? DEFAULT_BUDGETS.system,
    summary: input.budgets?.summary ?? DEFAULT_BUDGETS.summary,
    history: input.budgets?.history ?? DEFAULT_BUDGETS.history,
    memories: input.budgets?.memories ?? DEFAULT_BUDGETS.memories,
  };

  const sections: ContextSection[] = [
    section("system", input.systemPrompt ?? "", { budget: B.system, cut: "never" }),
    section("summary", input.summary, { budget: B.summary, cut: "never" }),
    section("history", input.history ?? [], { budget: B.history, cut: "oldest-first" }),
    section("memories", input.memories ?? [], { budget: B.memories, cut: "lowest-score-first" }),
  ];

  const fitted = sections.map(fitToBudget);
  return assemble(fitted, input.message);
}
