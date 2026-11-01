import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateContextBreakdown,
  estimateTokens,
  extractPromptTokens,
} from "./tokens.js";

test("estimateTokens calculates Math.ceil(chars / 4) and handles empty strings", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("a"), 1);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
  assert.equal(estimateTokens("123456789012345"), 4); // 15 chars / 4 = 3.75 -> 4
  assert.equal(estimateTokens("a".repeat(100)), 25);
});

test("extractPromptTokens extracts input_tokens from LangChain usage_metadata", () => {
  const messages = [
    {
      content: "Hello",
      usage_metadata: {
        input_tokens: 45,
        output_tokens: 10,
        total_tokens: 55,
      },
    },
  ];

  const tokens = extractPromptTokens(messages);
  assert.equal(tokens, 45);
});

test("extractPromptTokens extracts promptTokens from response_metadata tokenUsage", () => {
  const messages = [
    {
      content: "Result",
      response_metadata: {
        tokenUsage: {
          promptTokens: 88,
          completionTokens: 20,
        },
      },
    },
  ];

  const tokens = extractPromptTokens(messages);
  assert.equal(tokens, 88);
});

test("extractPromptTokens falls back to estimateTokens when usage metadata is missing", () => {
  const messages = [{ content: "No metadata here" }];
  const fallback = "USER: Hello world!"; // 18 chars -> 5 tokens

  const tokensWithFallback = extractPromptTokens(messages, fallback);
  assert.equal(tokensWithFallback, 5);

  const tokensWithoutFallback = extractPromptTokens(messages);
  assert.equal(tokensWithoutFallback, 0);
});

test("calculateContextBreakdown computes token estimates by context source", () => {
  const breakdown = calculateContextBreakdown({
    memories: [{ fact: "O cluster roda em us-east-1" }],
    history: [
      { role: "user", content: "Qual a regiao?" },
      { role: "assistant", content: "us-east-1" },
    ],
    userMessage: "Reinicie o pod auth",
  });

  assert.ok(breakdown.memories > 0);
  assert.ok(breakdown.history > 0);
  assert.ok(breakdown.userMessage > 0);
  assert.ok(breakdown.totalEstimated > 0);
  // O prompt consolidado contém todas as partes com quebras de linha
  assert.ok(
    breakdown.totalEstimated >= Math.max(breakdown.memories, breakdown.history, breakdown.userMessage),
  );
});

test("calculateContextBreakdown handles empty memories and history gracefully", () => {
  const breakdown = calculateContextBreakdown({
    userMessage: "Status geral",
  });

  assert.equal(breakdown.memories, 0);
  assert.equal(breakdown.history, 0);
  assert.ok(breakdown.userMessage > 0);
  assert.equal(breakdown.totalEstimated, breakdown.userMessage);
});
