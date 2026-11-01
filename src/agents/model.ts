import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const openRouterEnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  OPENROUTER_MODEL: z.string().min(1, "OPENROUTER_MODEL is required"),
});

function normalizeOpenRouterEnv(env: NodeJS.ProcessEnv) {
  return {
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY ?? env["OPENROUTER_API-KEY"],
    OPENROUTER_MODEL: env.OPENROUTER_MODEL,
  };
}

export function hasOpenRouterEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return openRouterEnvSchema.safeParse(normalizeOpenRouterEnv(env)).success;
}

export function createModel(): ChatOpenAI {
  const parsedEnv = openRouterEnvSchema.safeParse(normalizeOpenRouterEnv(process.env));
  if (!parsedEnv.success) {
    throw new Error(
      "OpenRouter environment is not configured. Set OPENROUTER_API_KEY and OPENROUTER_MODEL, then run `npm run arena:env -- --input \"...\" --strategies react` (or export env vars in your shell).",
    );
  }

  const env = parsedEnv.data;

  return new ChatOpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
    temperature: 0,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  });
}

export function createOpenRouterModel(): ChatOpenAI {
  return createModel();
}

export function createStructuredModel<TSchema extends z.ZodType>(schema: TSchema) {
  return createModel().withStructuredOutput(schema);
}
