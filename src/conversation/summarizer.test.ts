import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
import {
  FakeConversationSummarizer,
  maybeSummarizeConversation,
  type SummarizeEventPayload,
} from "./summarizer.js";

test("maybeSummarizeConversation does not run when unsummarized messages < 8", async () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  const summarizer = new FakeConversationSummarizer();
  const convId = "conv-under-batch";

  // Inserir 12 mensagens (4 saíram da janela de 8, faltam 4 para o lote de 8)
  for (let i = 1; i <= 12; i++) {
    store.append({ conversationId: convId, role: i % 2 === 1 ? "user" : "assistant", content: `msg ${i}` });
  }

  const result = await maybeSummarizeConversation(convId, {
    conversationStore: store,
    summarizer,
  });

  assert.equal(result.summarized, false);
  assert.equal(summarizer.callCount, 0);
  assert.equal(store.getSummary(convId), null);
});

test("maybeSummarizeConversation triggers when exactly 8 messages are pruned outside recent window", async () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  const summarizer = new FakeConversationSummarizer();
  const emitter = new EventEmitter();
  const convId = "conv-exact-batch";

  const events: SummarizeEventPayload[] = [];
  emitter.on("summarize", (payload: SummarizeEventPayload) => {
    events.push(payload);
  });

  // Inserir 16 mensagens: 8 saíram da janela recente de 8
  for (let i = 1; i <= 16; i++) {
    store.append({ conversationId: convId, role: i % 2 === 1 ? "user" : "assistant", content: `msg ${i}` });
  }

  const result = await maybeSummarizeConversation(convId, {
    conversationStore: store,
    summarizer,
    eventEmitter: emitter,
  });

  assert.equal(result.summarized, true);
  assert.equal(summarizer.callCount, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.conversationId, convId);
  assert.equal(events[0]?.messagesSummarized.length, 8);
  assert.equal(events[0]?.previousSummary, undefined);
  assert.ok(events[0]?.newSummary.includes("msg 1"));

  const saved = store.getSummary(convId);
  assert.ok(saved !== null);
  assert.equal(saved.summary, events[0]?.newSummary);

  // Segunda chamada imediata sem novas mensagens NÃO deve disparar nada
  const secondRun = await maybeSummarizeConversation(convId, {
    conversationStore: store,
    summarizer,
    eventEmitter: emitter,
  });
  assert.equal(secondRun.summarized, false);
  assert.equal(summarizer.callCount, 1);
  assert.equal(events.length, 1);
});

test("maybeSummarizeConversation merges with previous summary on the 24th message", async () => {
  const store = new SqliteConversationStore({ dbPath: ":memory:" });
  const summarizer = new FakeConversationSummarizer();
  const emitter = new EventEmitter();
  const convId = "conv-merge-test";

  const events: SummarizeEventPayload[] = [];
  emitter.on("summarize", (payload: SummarizeEventPayload) => {
    events.push(payload);
  });

  // 1 a 16 mensagens -> 1º disparo
  for (let i = 1; i <= 16; i++) {
    store.append({ conversationId: convId, role: i % 2 === 1 ? "user" : "assistant", content: `msg ${i}` });
  }
  await maybeSummarizeConversation(convId, {
    conversationStore: store,
    summarizer,
    eventEmitter: emitter,
  });
  assert.equal(events.length, 1);
  const firstSummary = events[0]?.newSummary;

  // 17 a 23 mensagens -> não dispara
  for (let i = 17; i <= 23; i++) {
    store.append({ conversationId: convId, role: i % 2 === 1 ? "user" : "assistant", content: `msg ${i}` });
  }
  const midRun = await maybeSummarizeConversation(convId, {
    conversationStore: store,
    summarizer,
    eventEmitter: emitter,
  });
  assert.equal(midRun.summarized, false);
  assert.equal(events.length, 1);

  // 24ª mensagem -> 2º lote de 8 mensagens podadas sai da janela!
  store.append({ conversationId: convId, role: "assistant", content: "msg 24" });
  const secondBatchRun = await maybeSummarizeConversation(convId, {
    conversationStore: store,
    summarizer,
    eventEmitter: emitter,
  });

  assert.equal(secondBatchRun.summarized, true);
  assert.equal(events.length, 2);
  assert.equal(events[1]?.previousSummary, firstSummary);
  assert.ok(events[1]?.newSummary.includes("[Anterior:"));
  assert.ok(events[1]?.newSummary.includes("msg 9"));
});

