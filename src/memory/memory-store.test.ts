import assert from "node:assert/strict";
import test from "node:test";

import { SqliteMemoryStore } from "./memory-store.js";

function makeEmbeddingProvider(seed: Record<string, Float32Array>) {
  return async (input: string) => {
    const key = input.trim().toLowerCase();
    return seed[key] ?? new Float32Array([0, 1, 0]);
  };
}

test("SqliteMemoryStore remembers facts without duplicates for the same user", async () => {
  const store = new SqliteMemoryStore({
    dbPath: ":memory:",
    embedText: makeEmbeddingProvider({
      "the user lives in berlin": new Float32Array([1, 0, 0]),
      "the user lives in paris": new Float32Array([0.98, 0.2, 0]),
      "where does the user live?": new Float32Array([1, 0, 0]),
    }),
  });

  const first = await store.remember("user-1", "The user lives in Berlin");
  const second = await store.remember("user-1", "The user lives in Paris");

  assert.equal(first.userId, "user-1");
  assert.equal(second.userId, "user-1");
  assert.equal((await store.recall("user-1", "Where does the user live?", 3)).length, 1);
});

test("SqliteMemoryStore recall returns top matches above the similarity threshold", async () => {
  const store = new SqliteMemoryStore({
    dbPath: ":memory:",
    embedText: makeEmbeddingProvider({
      "the user loves coffee": new Float32Array([1, 0, 0]),
      "the user hates tea": new Float32Array([-1, 0, 0]),
      "the user owns a bicycle": new Float32Array([0, 0, 1]),
      "what does the user like?": new Float32Array([1, 0, 0]),
    }),
  });

  await store.remember("user-2", "The user loves coffee");
  await store.remember("user-2", "The user hates tea");
  await store.remember("user-2", "The user owns a bicycle");

  const matches = await store.recall("user-2", "What does the user like?", 3);

  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.fact, "The user loves coffee");
});

test("SqliteMemoryStore forget deletes only the matching user memory", async () => {
  const store = new SqliteMemoryStore({
    dbPath: ":memory:",
    embedText: makeEmbeddingProvider({
      "the user lives in berlin": new Float32Array([1, 0, 0]),
      "the other user lives in madrid": new Float32Array([0, 1, 0]),
    }),
  });

  const first = await store.remember("user-1", "The user lives in Berlin");
  const second = await store.remember("user-2", "The other user lives in Madrid");

  assert.equal(await store.forget("user-1", first.id), true);
  assert.equal(await store.forget("user-1", second.id), false);
  assert.equal((await store.recall("user-1", "Where does the user live?", 3)).length, 0);
  assert.equal((await store.recall("user-2", "Where does the other user live?", 3)).length, 1);
});

test("SqliteMemoryStore recall acha fato sem palavra em comum", async () => {
  const fact = "o cliente possui um felino siames";
  const query = "quais animais de estimacao?";

  const factWords = new Set(fact.toLowerCase().split(/\s+/));
  const queryWords = query.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
  const commonWords = queryWords.filter((word) => factWords.has(word));
  assert.equal(commonWords.length, 0);

  const sharedVector = new Float32Array([0.8, 0.6, 0]);
  const store = new SqliteMemoryStore({
    dbPath: ":memory:",
    embedText: makeEmbeddingProvider({
      [fact]: sharedVector,
      [query]: sharedVector,
    }),
  });

  await store.remember("user-sem-palavras", fact);
  const results = await store.recall("user-sem-palavras", query, 3);

  assert.equal(results.length, 1);
  assert.equal(results[0]?.fact, fact);
});

test("SqliteMemoryStore all returns all memories for the given user", async () => {
  const store = new SqliteMemoryStore({
    dbPath: ":memory:",
    embedText: makeEmbeddingProvider({
      "fact a": new Float32Array([1, 0, 0]),
      "fact b": new Float32Array([0, 1, 0]),
      "fact other": new Float32Array([0, 0, 1]),
    }),
  });

  await store.remember("user-all", "fact a");
  await store.remember("user-all", "fact b");
  await store.remember("user-other", "fact other");

  const memories = store.all("user-all");
  assert.equal(memories.length, 2);
  assert.equal(store.all("user-other").length, 1);
  assert.equal(store.all("").length, 0);
});
