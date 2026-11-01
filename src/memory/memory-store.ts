import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { deserializeEmbedding, dotProduct, embedText, serializeEmbedding } from "./embeddings.js";

export interface MemoryRecord {
  id: string;
  userId: string;
  fact: string;
  embedding: Float32Array;
  createdAt: string;
}

export interface MemoryStore {
  remember(userId: string, fact: string): Promise<MemoryRecord>;
  recall(userId: string, query: string, limit?: number): Promise<MemoryRecord[]>;
  forget(userId: string, memoryId: string): Promise<boolean>;
  all?(userId: string): MemoryRecord[];
}

export interface MemoryStoreOptions {
  dbPath?: string;
  embedText?: (input: string) => Promise<Float32Array>;
}

const defaultDbPath = "./data/opspilot.db";
const dedupThreshold = 0.92;
const recallLimit = 3;
const recallMinSimilarity = 0.3;

function resolveDatabasePath(dbPath: string): string {
  if (dbPath === ":memory:") {
    return dbPath;
  }

  const absolutePath = resolve(process.cwd(), dbPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  return absolutePath;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Unexpected sqlite row format");
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`Expected sqlite field "${key}" to be string`);
  }
  return value;
}

function readBinary(record: Record<string, unknown>, key: string): Buffer {
  const value = record[key];
  if (value === null || value === undefined) {
    throw new Error(`Expected sqlite field "${key}" to be binary`);
  }
  if (typeof value === "string") {
    return Buffer.from(value, "binary");
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }
  throw new Error(`Expected sqlite field "${key}" to be binary`);
}

function mapMemoryRecord(raw: unknown): MemoryRecord {
  const row = toRecord(raw);
  const fact = readString(row, "fact");
  const embedding = deserializeEmbedding(readBinary(row, "embedding"));

  return {
    id: readString(row, "id"),
    userId: readString(row, "user_id"),
    fact,
    embedding,
    createdAt: readString(row, "created_at"),
  };
}

export class SqliteMemoryStore implements MemoryStore {
  private readonly db: DatabaseSync;
  private readonly embeddingFn: (input: string) => Promise<Float32Array>;
  private readonly insertMemoryStatement;
  private readonly selectMemoriesForUserStatement;
  private readonly selectMemoryByIdStatement;
  private readonly deleteMemoryStatement;

  constructor(options?: MemoryStoreOptions) {
    const configuredPath = options?.dbPath ?? process.env.OPSPILOT_DB ?? defaultDbPath;
    this.db = new DatabaseSync(resolveDatabasePath(configuredPath));
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        fact TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_user_created
        ON memories (user_id, created_at DESC);
    `);

    this.embeddingFn = options?.embedText ?? embedText;
    this.insertMemoryStatement = this.db.prepare(
      "INSERT INTO memories (id, user_id, fact, embedding, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    this.selectMemoriesForUserStatement = this.db.prepare(
      `SELECT id, user_id, fact, embedding, created_at
       FROM memories
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC`,
    );
    this.selectMemoryByIdStatement = this.db.prepare(
      `SELECT id, user_id, fact, embedding, created_at
       FROM memories
       WHERE id = ?`,
    );
    this.deleteMemoryStatement = this.db.prepare("DELETE FROM memories WHERE id = ? AND user_id = ?");
  }

  all(userId: string): MemoryRecord[] {
    const normalizedUserId = userId.trim();
    if (normalizedUserId.length === 0) {
      return [];
    }
    return this.selectMemoriesForUserStatement.all(normalizedUserId).map(mapMemoryRecord);
  }

  async remember(userId: string, fact: string): Promise<MemoryRecord> {
    const normalizedUserId = userId.trim();
    const normalizedFact = fact.trim();
    if (normalizedUserId.length === 0) {
      throw new Error("userId cannot be empty");
    }
    if (normalizedFact.length === 0) {
      throw new Error("fact cannot be empty");
    }

    const embedding = await this.embeddingFn(normalizedFact);
    const existing = this.all(normalizedUserId);
    const duplicate = existing.find((memory) => dotProduct(memory.embedding, embedding) >= dedupThreshold);
    if (duplicate) {
      return duplicate;
    }

    const createdAt = new Date().toISOString();
    const memoryId = randomUUID();
    this.insertMemoryStatement.run(memoryId, normalizedUserId, normalizedFact, serializeEmbedding(embedding), createdAt);

    return {
      id: memoryId,
      userId: normalizedUserId,
      fact: normalizedFact,
      embedding,
      createdAt,
    };
  }

  async recall(userId: string, query: string, limit = recallLimit): Promise<MemoryRecord[]> {
    const normalizedUserId = userId.trim();
    const normalizedQuery = query.trim();
    if (normalizedUserId.length === 0) {
      throw new Error("userId cannot be empty");
    }
    if (normalizedQuery.length === 0) {
      return [];
    }

    const q = await this.embeddingFn(normalizedQuery);
    return this.all(normalizedUserId)
      .map((mappedUser) => ({
        ...mappedUser,
        score: dotProduct(q, mappedUser.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter((mappedUser) => mappedUser.score >= recallMinSimilarity)
      .map(({ score: _score, ...mappedUser }) => mappedUser);
  }

  async forget(userId: string, memoryId: string): Promise<boolean> {
    const normalizedUserId = userId.trim();
    const normalizedMemoryId = memoryId.trim();
    if (normalizedUserId.length === 0) {
      throw new Error("userId cannot be empty");
    }
    if (normalizedMemoryId.length === 0) {
      return false;
    }

    const memory = this.selectMemoryByIdStatement.get(normalizedMemoryId);
    if (!memory) {
      return false;
    }

    const record = mapMemoryRecord(memory);
    if (record.userId !== normalizedUserId) {
      return false;
    }

    const result = this.deleteMemoryStatement.run(normalizedMemoryId, normalizedUserId);
    return Number(result.changes ?? 0) > 0;
  }
}
