import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { UnknownIncidentError, UnknownRunbookError, UnknownServiceError } from "../agents/errors.js";
import {
  createDefaultStoryData,
  listAlertsByStatus,
  listIncidentsByStatus,
  type Alert,
  type AlertStatus,
  type Incident,
  type IncidentStatus,
  type OpsStore,
  type OpenIncidentInput,
  type Runbook,
  type Service,
  type StoryData,
} from "../agents/tools.js";

interface SqliteOpsStoreOptions {
  dbPath?: string;
  seed?: boolean;
}

interface ServiceRow {
  id: string;
  name: string;
  tier: Service["tier"];
}

interface AlertRow {
  id: string;
  service: string;
  title: string;
  severity: Alert["severity"];
  status: "firing" | "resolved";
}

interface IncidentRow {
  id: string;
  title: string;
  service: string;
  severity: Incident["severity"];
  status: "open" | "resolved";
  resolved_at: string | null;
}

interface RunbookRow {
  service: string;
  content: string;
}

const defaultDbPath = "./data/opspilot.db";

function resolveDatabasePath(dbPath: string): string {
  if (dbPath === ":memory:") {
    return dbPath;
  }

  const absolutePath = resolve(process.cwd(), dbPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  return absolutePath;
}

function mapIncidentRow(row: IncidentRow): Incident {
  return {
    id: row.id,
    title: row.title,
    service: row.service,
    severity: row.severity,
    status: row.status,
    resolvedAt: row.resolved_at,
  };
}

function mapAlertRow(row: AlertRow): Alert {
  return {
    id: row.id,
    service: row.service,
    title: row.title,
    severity: row.severity,
    status: row.status,
  };
}

function mapServiceRow(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    tier: row.tier,
  };
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

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected sqlite field "${key}" to be string|null`);
  }
  return value;
}

function mapServiceRecord(raw: unknown): ServiceRow {
  const row = toRecord(raw);
  const tier = readString(row, "tier");
  if (tier !== "tier1" && tier !== "tier2" && tier !== "tier3") {
    throw new Error(`Invalid service tier "${tier}" from sqlite`);
  }
  return {
    id: readString(row, "id"),
    name: readString(row, "name"),
    tier,
  };
}

function mapAlertRecord(raw: unknown): AlertRow {
  const row = toRecord(raw);
  const severity = readString(row, "severity");
  if (severity !== "critical" && severity !== "high" && severity !== "medium" && severity !== "low") {
    throw new Error(`Invalid alert severity "${severity}" from sqlite`);
  }

  const status = readString(row, "status");
  if (status !== "firing" && status !== "resolved") {
    throw new Error(`Invalid alert status "${status}" from sqlite`);
  }

  return {
    id: readString(row, "id"),
    service: readString(row, "service"),
    title: readString(row, "title"),
    severity,
    status,
  };
}

function mapIncidentRecord(raw: unknown): IncidentRow {
  const row = toRecord(raw);
  const severity = readString(row, "severity");
  if (severity !== "critical" && severity !== "high" && severity !== "medium" && severity !== "low") {
    throw new Error(`Invalid incident severity "${severity}" from sqlite`);
  }

  const status = readString(row, "status");
  if (status !== "open" && status !== "resolved") {
    throw new Error(`Invalid incident status "${status}" from sqlite`);
  }

  return {
    id: readString(row, "id"),
    title: readString(row, "title"),
    service: readString(row, "service"),
    severity,
    status,
    resolved_at: readNullableString(row, "resolved_at"),
  };
}

function mapRunbookRecord(raw: unknown): RunbookRow {
  const row = toRecord(raw);
  return {
    service: readString(row, "service"),
    content: readString(row, "content"),
  };
}

export class SqliteOpsStore implements OpsStore {
  private readonly db: DatabaseSync;

  private readonly selectServicesStatement;
  private readonly selectAlertsByStatusStatement;
  private readonly selectAllAlertsStatement;
  private readonly selectIncidentsByStatusStatement;
  private readonly selectAllIncidentsStatement;
  private readonly selectIncidentByIdStatement;
  private readonly selectServiceByIdStatement;
  private readonly updateIncidentAsResolvedStatement;
  private readonly insertIncidentStatement;
  private readonly selectRunbookByServiceStatement;
  private readonly selectNextIncidentNumberStatement;
  private readonly selectAllRunbooksStatement;
  private readonly insertServiceStatement;
  private readonly insertAlertStatement;
  private readonly insertRunbookStatement;

  constructor(options?: SqliteOpsStoreOptions) {
    const configuredPath = options?.dbPath ?? process.env.OPSPILOT_DB ?? defaultDbPath;
    this.db = new DatabaseSync(resolveDatabasePath(configuredPath));

    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tier TEXT NOT NULL CHECK (tier IN ('tier1', 'tier2', 'tier3'))
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL REFERENCES services(id),
        title TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
        status TEXT NOT NULL CHECK (status IN ('firing', 'resolved'))
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        service TEXT NOT NULL REFERENCES services(id),
        severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        resolved_at TEXT NULL
      );

      CREATE TABLE IF NOT EXISTS runbooks (
        service TEXT PRIMARY KEY REFERENCES services(id),
        content TEXT NOT NULL
      );
    `);

    this.selectServicesStatement = this.db.prepare(
      "SELECT id, name, tier FROM services ORDER BY id ASC",
    );
    this.selectAlertsByStatusStatement = this.db.prepare(
      "SELECT id, service, title, severity, status FROM alerts WHERE status = ? ORDER BY id ASC",
    );
    this.selectAllAlertsStatement = this.db.prepare(
      "SELECT id, service, title, severity, status FROM alerts ORDER BY id ASC",
    );
    this.selectIncidentsByStatusStatement = this.db.prepare(
      "SELECT id, title, service, severity, status, resolved_at FROM incidents WHERE status = ? ORDER BY id ASC",
    );
    this.selectAllIncidentsStatement = this.db.prepare(
      "SELECT id, title, service, severity, status, resolved_at FROM incidents ORDER BY id ASC",
    );
    this.selectIncidentByIdStatement = this.db.prepare(
      "SELECT id, title, service, severity, status, resolved_at FROM incidents WHERE id = ?",
    );
    this.selectServiceByIdStatement = this.db.prepare(
      "SELECT id, name, tier FROM services WHERE id = ?",
    );
    this.updateIncidentAsResolvedStatement = this.db.prepare(
      "UPDATE incidents SET status = 'resolved', resolved_at = ? WHERE id = ?",
    );
    this.insertIncidentStatement = this.db.prepare(
      "INSERT INTO incidents (id, title, service, severity, status, resolved_at) VALUES (?, ?, ?, ?, 'open', NULL)",
    );
    this.selectRunbookByServiceStatement = this.db.prepare(
      "SELECT service, content FROM runbooks WHERE service = ?",
    );
    this.selectAllRunbooksStatement = this.db.prepare(
      "SELECT service, content FROM runbooks ORDER BY service ASC",
    );
    this.selectNextIncidentNumberStatement = this.db.prepare(
      "SELECT COALESCE(MAX(CAST(SUBSTR(id, 5) AS INTEGER)), 0) + 1 AS next_id FROM incidents WHERE id LIKE 'inc-%'",
    );
    this.insertServiceStatement = this.db.prepare(
      "INSERT OR IGNORE INTO services (id, name, tier) VALUES (?, ?, ?)",
    );
    this.insertAlertStatement = this.db.prepare(
      "INSERT OR IGNORE INTO alerts (id, service, title, severity, status) VALUES (?, ?, ?, ?, ?)",
    );
    this.insertRunbookStatement = this.db.prepare(
      "INSERT OR IGNORE INTO runbooks (service, content) VALUES (?, ?)",
    );

    if (options?.seed !== false) {
      this.seedDefault();
    }
  }

  seedDefault(): void {
    const defaults = createDefaultStoryData();

    this.db.exec("BEGIN");
    try {
      for (const service of defaults.services) {
        this.insertServiceStatement.run(service.id, service.name, service.tier);
      }

      for (const alert of defaults.alerts) {
        this.insertAlertStatement.run(
          alert.id,
          alert.service,
          alert.title,
          alert.severity,
          alert.status,
        );
      }

      for (const runbook of defaults.runbooks) {
        this.insertRunbookStatement.run(runbook.service, runbook.content);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  snapshot(): StoryData {
    const services = this.selectServicesStatement.all().map(mapServiceRecord);
    const alerts = this.selectAllAlertsStatement.all().map(mapAlertRecord);
    const incidents = this.selectAllIncidentsStatement.all().map(mapIncidentRecord);
    const runbooks = this.selectAllRunbooksStatement.all().map(mapRunbookRecord);
    const nextIncidentNumber =
      (this.selectNextIncidentNumberStatement.get() as { next_id: number } | undefined)?.next_id ?? 1;

    return {
      services: services.map(mapServiceRow),
      alerts: alerts.map(mapAlertRow),
      incidents: incidents.map(mapIncidentRow),
      runbooks: runbooks.map((runbook) => ({ ...runbook })),
      nextIncidentId: nextIncidentNumber,
    };
  }

  listAlerts(status: AlertStatus = "firing"): Alert[] {
    const rows =
      status === "all"
        ? this.selectAllAlertsStatement.all().map(mapAlertRecord)
        : this.selectAlertsByStatusStatement.all(status).map(mapAlertRecord);
    return listAlertsByStatus(
      { services: [], alerts: rows.map(mapAlertRow), incidents: [], runbooks: [], nextIncidentId: 1 },
      status,
    );
  }

  openIncident(input: OpenIncidentInput): Incident {
    const serviceRecord = this.selectServiceByIdStatement.get(input.service);
    const service = serviceRecord ? mapServiceRecord(serviceRecord) : undefined;
    if (!service) {
      throw new UnknownServiceError(input.service);
    }

    const nextIncidentNumber =
      (this.selectNextIncidentNumberStatement.get() as { next_id: number } | undefined)?.next_id ?? 1;
    const incidentId = `inc-${String(nextIncidentNumber).padStart(3, "0")}`;

    this.insertIncidentStatement.run(incidentId, input.title, input.service, input.severity);

    const createdRecord = this.selectIncidentByIdStatement.get(incidentId);
    const created = createdRecord ? mapIncidentRecord(createdRecord) : undefined;
    if (!created) {
      throw new Error(`Incident "${incidentId}" was not persisted`);
    }
    return mapIncidentRow(created);
  }

  resolveIncidentById(id: string): Incident {
    const currentRecord = this.selectIncidentByIdStatement.get(id);
    const current = currentRecord ? mapIncidentRecord(currentRecord) : undefined;
    if (!current) {
      throw new UnknownIncidentError(id);
    }

    if (current.status === "resolved") {
      return mapIncidentRow(current);
    }

    const resolvedAt = new Date().toISOString();
    this.updateIncidentAsResolvedStatement.run(resolvedAt, id);
    const updatedRecord = this.selectIncidentByIdStatement.get(id);
    const updated = updatedRecord ? mapIncidentRecord(updatedRecord) : undefined;
    if (!updated) {
      throw new UnknownIncidentError(id);
    }
    return mapIncidentRow(updated);
  }

  listIncidents(status: IncidentStatus = "open"): Incident[] {
    const rows =
      status === "all"
        ? this.selectAllIncidentsStatement.all().map(mapIncidentRecord)
        : this.selectIncidentsByStatusStatement.all(status).map(mapIncidentRecord);
    return listIncidentsByStatus(
      { services: [], alerts: [], incidents: rows.map(mapIncidentRow), runbooks: [], nextIncidentId: 1 },
      status,
    );
  }

  getRunbookByService(service: string): Runbook {
    const serviceRecord = this.selectServiceByIdStatement.get(service);
    const knownService = serviceRecord ? mapServiceRecord(serviceRecord) : undefined;
    if (!knownService) {
      throw new UnknownServiceError(service);
    }

    const runbookRecord = this.selectRunbookByServiceStatement.get(service);
    const runbook = runbookRecord ? mapRunbookRecord(runbookRecord) : undefined;
    if (!runbook) {
      throw new UnknownRunbookError(service);
    }
    return { ...runbook };
  }
}
