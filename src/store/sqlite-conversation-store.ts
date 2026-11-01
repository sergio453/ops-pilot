import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const defaultDbPath = "./data/opspilot.db";
export const defaultRecentMessagesLimit = 8;

export type ConversationRole = "user" | "assistant";

export interface ConversationMessage {
  conversationId: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
}

export interface ConversationMessageWithId extends ConversationMessage {
  id: number;
}

export interface ConversationSummaryRecord {
  conversationId: string;
  summary: string;
  lastSummarizedMessageId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationStore {
  create(conversationId: string): string;
  append(input: { conversationId: string; role: ConversationRole; content: string }): ConversationMessage;
  lastMessages(conversationId: string, limit?: number): ConversationMessage[];
  getSummary(conversationId: string): ConversationSummaryRecord | null;
  summaryOf(conversationId: string): string | null;
  saveSummary(input: { conversationId: string; summary: string; lastSummarizedMessageId: number }): ConversationSummaryRecord;
  getUnsummarizedPrunedMessages(conversationId: string, recentLimit?: number): ConversationMessageWithId[];
}

interface SqliteConversationStoreOptions {
  dbPath?: string;
}

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

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new Error(`Expected sqlite field "${key}" to be number`);
  }
  return value;
}

function mapConversationMessage(raw: unknown): ConversationMessage {
  const row = toRecord(raw);
  const role = readString(row, "role");
  if (role !== "user" && role !== "assistant") {
    throw new Error(`Invalid message role "${role}" from sqlite`);
  }

  return {
    conversationId: readString(row, "conversation_id"),
    role,
    content: readString(row, "content"),
    createdAt: readString(row, "created_at"),
  };
}

function mapConversationMessageWithId(raw: unknown): ConversationMessageWithId {
  const row = toRecord(raw);
  const role = readString(row, "role");
  if (role !== "user" && role !== "assistant") {
    throw new Error(`Invalid message role "${role}" from sqlite`);
  }

  return {
    id: readNumber(row, "id"),
    conversationId: readString(row, "conversation_id"),
    role,
    content: readString(row, "content"),
    createdAt: readString(row, "created_at"),
  };
}

function mapConversationSummaryRecord(raw: unknown): ConversationSummaryRecord {
  const row = toRecord(raw);
  return {
    conversationId: readString(row, "conversation_id"),
    summary: readString(row, "summary"),
    lastSummarizedMessageId: readNumber(row, "last_summarized_message_id"),
    createdAt: readString(row, "created_at"),
    updatedAt: readString(row, "updated_at"),
  };
}

export class SqliteConversationStore implements ConversationStore {
  private readonly db: DatabaseSync;
  private readonly insertConversationStatement;
  private readonly insertMessageStatement;
  private readonly selectLastMessagesStatement;
  private readonly selectSummaryStatement;
  private readonly upsertSummaryStatement;
  private readonly selectUnsummarizedPrunedMessagesStatement;

  constructor(options?: SqliteConversationStoreOptions) {
    const configuredPath = options?.dbPath ?? process.env.OPSPILOT_DB ?? defaultDbPath;
    this.db = new DatabaseSync(resolveDatabasePath(configuredPath));
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
        ON messages (conversation_id, created_at, id);

      CREATE TABLE IF NOT EXISTS conversation_summaries (
        conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        last_summarized_message_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_summaries_last_msg
        ON conversation_summaries (conversation_id, last_summarized_message_id);
    `);

    this.insertConversationStatement = this.db.prepare(
      "INSERT OR IGNORE INTO conversations (id, created_at) VALUES (?, ?)",
    );
    this.insertMessageStatement = this.db.prepare(
      "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
    );
    this.selectLastMessagesStatement = this.db.prepare(
      `SELECT conversation_id, role, content, created_at
       FROM (
         SELECT conversation_id, role, content, created_at, id
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?
       )
       ORDER BY created_at ASC, id ASC`,
    );

    this.selectSummaryStatement = this.db.prepare(
      `SELECT conversation_id, summary, last_summarized_message_id, created_at, updated_at
       FROM conversation_summaries
       WHERE conversation_id = ?`,
    );

    this.upsertSummaryStatement = this.db.prepare(
      `INSERT INTO conversation_summaries (conversation_id, summary, last_summarized_message_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         summary = excluded.summary,
         last_summarized_message_id = excluded.last_summarized_message_id,
         updated_at = excluded.updated_at`,
    );

    this.selectUnsummarizedPrunedMessagesStatement = this.db.prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = ?
         AND id > ?
         AND id NOT IN (
           SELECT id
           FROM messages
           WHERE conversation_id = ?
           ORDER BY created_at DESC, id DESC
           LIMIT ?
         )
       ORDER BY created_at ASC, id ASC`,
    );
  }

  create(conversationId: string): string {
    const normalizedConversationId = conversationId.trim();
    if (normalizedConversationId.length === 0) {
      throw new Error("conversationId cannot be empty");
    }

    this.insertConversationStatement.run(normalizedConversationId, new Date().toISOString());
    return normalizedConversationId;
  }

  append(input: { conversationId: string; role: ConversationRole; content: string }): ConversationMessage {
    const conversationId = this.create(input.conversationId);
    const content = input.content.trim();
    if (content.length === 0) {
      throw new Error("message content cannot be empty");
    }

    const createdAt = new Date().toISOString();
    this.insertMessageStatement.run(conversationId, input.role, content, createdAt);
    return { conversationId, role: input.role, content, createdAt };
  }

  lastMessages(conversationId: string, limit = defaultRecentMessagesLimit): ConversationMessage[] {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("limit must be a positive integer");
    }

    return this.selectLastMessagesStatement
      .all(conversationId.trim(), limit)
      .map(mapConversationMessage);
  }

  getSummary(conversationId: string): ConversationSummaryRecord | null {
    const normalizedId = conversationId.trim();
    if (normalizedId.length === 0) {
      return null;
    }
    const row = this.selectSummaryStatement.get(normalizedId);
    if (!row) {
      return null;
    }
    return mapConversationSummaryRecord(row);
  }

  summaryOf(conversationId: string): string | null {
    const record = this.getSummary(conversationId);
    return record ? record.summary : null;
  }

  saveSummary(input: {
    conversationId: string;
    summary: string;
    lastSummarizedMessageId: number;
  }): ConversationSummaryRecord {
    const conversationId = this.create(input.conversationId);
    const summary = input.summary.trim();
    const now = new Date().toISOString();

    const existing = this.getSummary(conversationId);
    const createdAt = existing ? existing.createdAt : now;
    const updatedAt = now;

    this.upsertSummaryStatement.run(
      conversationId,
      summary,
      input.lastSummarizedMessageId,
      createdAt,
      updatedAt,
    );

    return {
      conversationId,
      summary,
      lastSummarizedMessageId: input.lastSummarizedMessageId,
      createdAt,
      updatedAt,
    };
  }

  getUnsummarizedPrunedMessages(
    conversationId: string,
    recentLimit = defaultRecentMessagesLimit,
  ): ConversationMessageWithId[] {
    const normalizedId = conversationId.trim();
    if (normalizedId.length === 0) {
      return [];
    }
    const currentSummary = this.getSummary(normalizedId);
    const lastSummarizedId = currentSummary ? currentSummary.lastSummarizedMessageId : 0;

    return this.selectUnsummarizedPrunedMessagesStatement
      .all(normalizedId, lastSummarizedId, normalizedId, recentLimit)
      .map(mapConversationMessageWithId);
  }
}
