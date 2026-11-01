import assert from "node:assert/strict";
import test from "node:test";

import { SqliteConversationStore } from "./sqlite-conversation-store.js";

test("SqliteConversationStore :memory: creates, appends and returns chronological history", () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  store.create("conv-001");
  store.append({ conversationId: "conv-001", role: "user", content: "oi" });
  store.append({ conversationId: "conv-001", role: "assistant", content: "ola" });
  store.append({ conversationId: "conv-001", role: "user", content: "status?" });

  const messages = store.lastMessages("conv-001", 2);
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, "assistant");
  assert.equal(messages[0]?.content, "ola");
  assert.equal(messages[1]?.role, "user");
  assert.equal(messages[1]?.content, "status?");
});

test("SqliteConversationStore create is idempotent for same conversation id", () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  assert.equal(store.create("conv-abc"), "conv-abc");
  assert.equal(store.create("conv-abc"), "conv-abc");
  assert.equal(store.lastMessages("conv-abc").length, 0);
});

test("SqliteConversationStore getSummary returns null when no summary exists", () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  assert.equal(store.getSummary("conv-empty"), null);
});

test("SqliteConversationStore saveSummary persists and updates conversation summary", () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  const created = store.saveSummary({
    conversationId: "conv-sum-1",
    summary: "Decisão: cluster auth reiniciado.",
    lastSummarizedMessageId: 8,
  });

  assert.equal(created.conversationId, "conv-sum-1");
  assert.equal(created.summary, "Decisão: cluster auth reiniciado.");
  assert.equal(created.lastSummarizedMessageId, 8);

  const retrieved = store.getSummary("conv-sum-1");
  assert.ok(retrieved !== null);
  assert.equal(retrieved.summary, "Decisão: cluster auth reiniciado.");
  assert.equal(retrieved.lastSummarizedMessageId, 8);

  // Update summary
  const updated = store.saveSummary({
    conversationId: "conv-sum-1",
    summary: "Decisão: cluster auth reiniciado. Fato: pod recuperado.",
    lastSummarizedMessageId: 16,
  });
  assert.equal(updated.summary, "Decisão: cluster auth reiniciado. Fato: pod recuperado.");
  assert.equal(updated.lastSummarizedMessageId, 16);
});

test("SqliteConversationStore getUnsummarizedPrunedMessages tracks messages outside recent window", () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  const convId = "conv-prune-test";

  // Inserir 8 mensagens: todas cabem na janela recente de 8
  for (let i = 1; i <= 8; i++) {
    store.append({ conversationId: convId, role: i % 2 === 1 ? "user" : "assistant", content: `msg ${i}` });
  }
  assert.equal(store.getUnsummarizedPrunedMessages(convId, 8).length, 0);

  // Inserir mais 4 mensagens (total 12) -> 4 saíram da janela recente de 8
  for (let i = 9; i <= 12; i++) {
    store.append({ conversationId: convId, role: i % 2 === 1 ? "user" : "assistant", content: `msg ${i}` });
  }
  const pruned1 = store.getUnsummarizedPrunedMessages(convId, 8);
  assert.equal(pruned1.length, 4);
  assert.equal(pruned1[0]?.content, "msg 1");
  assert.equal(pruned1[3]?.content, "msg 4");

  // Inserir mais 4 mensagens (total 16) -> exatamente 8 saíram da janela
  for (let i = 13; i <= 16; i++) {
    store.append({ conversationId: convId, role: i % 2 === 1 ? "user" : "assistant", content: `msg ${i}` });
  }
  const pruned2 = store.getUnsummarizedPrunedMessages(convId, 8);
  assert.equal(pruned2.length, 8);

  // Ao salvar o resumo das primeiras 8 mensagens, elas deixam de ser pendentes
  const lastId = pruned2[7]?.id;
  assert.ok(typeof lastId === "number");
  store.saveSummary({
    conversationId: convId,
    summary: "Resumo das 8 primeiras mensagens",
    lastSummarizedMessageId: lastId,
  });

  // Agora nenhuma mensagem está podada e não-sumarizada
  assert.equal(store.getUnsummarizedPrunedMessages(convId, 8).length, 0);
});
