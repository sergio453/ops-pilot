import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { UnknownIncidentError, UnknownRunbookError, UnknownServiceError } from "./errors.js";

const tierSchema = z.enum(["tier1", "tier2", "tier3"]);
const alertStateSchema = z.enum(["firing", "resolved"]);
const alertStatusFilterSchema = z.enum(["firing", "resolved", "all"]);
const incidentStatusSchema = z.enum(["open", "resolved"]);
const incidentStatusFilterSchema = z.enum(["open", "resolved", "all"]);
const severitySchema = z.enum(["critical", "high", "medium", "low"]);
const providerSchema = z.enum(["github", "cloudflare"]);
const providerStatusSchema = z.object({
  status: z.object({
    indicator: z.string(),
    description: z.string(),
  }),
});

export type ServiceTier = z.infer<typeof tierSchema>;
export type AlertStatus = z.infer<typeof alertStatusFilterSchema>;
export type IncidentStatus = z.infer<typeof incidentStatusFilterSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Provider = z.infer<typeof providerSchema>;
type AlertState = z.infer<typeof alertStateSchema>;
type IncidentState = z.infer<typeof incidentStatusSchema>;

export interface Service {
  id: string;
  name: string;
  tier: ServiceTier;
}

export interface Alert {
  id: string;
  service: string;
  title: string;
  severity: Severity;
  status: AlertState;
}

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentState;
  resolvedAt: string | null;
}

export interface Runbook {
  service: string;
  content: string;
}

export interface StoryData {
  services: Service[];
  alerts: Alert[];
  incidents: Incident[];
  runbooks: Runbook[];
  nextIncidentId: number;
}

export interface OpsStore {
  seedDefault(): void;
  snapshot(): StoryData;
  listAlerts(status?: AlertStatus): Alert[];
  openIncident(input: OpenIncidentInput): Incident;
  resolveIncidentById(id: string): Incident;
  listIncidents(status?: IncidentStatus): Incident[];
  getRunbookByService(service: string): Runbook;
}

const STATUS_URL: Record<Provider, string> = {
  github: "https://www.githubstatus.com/api/v2/status.json",
  cloudflare: "https://www.cloudflarestatus.com/api/v2/status.json",
};

type FetchLike = typeof fetch;

const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tier: tierSchema,
});

const alertSchema = z.object({
  id: z.string().min(1),
  service: z.string().min(1),
  title: z.string().min(1),
  severity: severitySchema,
  status: alertStateSchema,
});

const incidentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  service: z.string().min(1),
  severity: severitySchema,
  status: incidentStatusSchema,
  resolvedAt: z.string().min(1).nullable(),
});

const runbookSchema = z.object({
  service: z.string().min(1),
  content: z.string().min(1),
});

const storyDataSchema = z.object({
  services: z.array(serviceSchema),
  alerts: z.array(alertSchema),
  incidents: z.array(incidentSchema),
  runbooks: z.array(runbookSchema),
  nextIncidentId: z.number().int().positive(),
});

const defaultServices: Service[] = [
  { id: "payments", name: "payments", tier: "tier1" },
  { id: "checkout", name: "checkout", tier: "tier1" },
  { id: "catalog", name: "catalog", tier: "tier2" },
  { id: "notifications", name: "notifications", tier: "tier2" },
  { id: "auth", name: "auth", tier: "tier1" },
];

const defaultAlerts: Alert[] = [
  {
    id: "alert-001",
    service: "payments",
    title: "Erro de autorização de cartão",
    severity: "critical",
    status: "firing",
  },
  {
    id: "alert-002",
    service: "checkout",
    title: "Latência acima do SLA",
    severity: "high",
    status: "firing",
  },
  {
    id: "alert-003",
    service: "auth",
    title: "Pico de falhas de login",
    severity: "medium",
    status: "firing",
  },
  {
    id: "alert-004",
    service: "catalog",
    title: "Falha intermitente na busca",
    severity: "medium",
    status: "resolved",
  },
  {
    id: "alert-005",
    service: "notifications",
    title: "Atraso na fila de e-mails",
    severity: "low",
    status: "resolved",
  },
  {
    id: "alert-006",
    service: "payments",
    title: "Timeout de webhook externo",
    severity: "high",
    status: "resolved",
  },
];

const defaultRunbooks: Runbook[] = [
  {
    service: "checkout",
    content:
      "1. Validar status do gateway de pagamento.\n2. Conferir taxa de erro na API de carrinho.\n3. Aplicar fallback de checkout simplificado.",
  },
  {
    service: "payments",
    content:
      "1. Revisar erros 5xx de adquirente.\n2. Verificar filas de captura.\n3. Acionar circuito de contingência para autorização.",
  },
  {
    service: "auth",
    content:
      "1. Verificar saúde do provedor de identidade.\n2. Checar taxa de falha por região.\n3. Invalidar cache de sessões degradadas.",
  },
];

function cloneStoryData(data: StoryData): StoryData {
  return {
    services: data.services.map((service) => ({ ...service })),
    alerts: data.alerts.map((alert) => ({ ...alert })),
    incidents: data.incidents.map((incident) => ({ ...incident })),
    runbooks: data.runbooks.map((runbook) => ({ ...runbook })),
    nextIncidentId: data.nextIncidentId,
  };
}

export function getStorySeedPath(): string {
  return fileURLToPath(new URL("./story-seed.json", import.meta.url));
}

export function createDefaultStoryData(): StoryData {
  return {
    services: defaultServices.map((service) => ({ ...service })),
    alerts: defaultAlerts.map((alert) => ({ ...alert })),
    incidents: [],
    runbooks: defaultRunbooks.map((runbook) => ({ ...runbook })),
    nextIncidentId: 1,
  };
}

export function readStorySeedData(): StoryData {
  const raw = readFileSync(getStorySeedPath(), "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  return storyDataSchema.parse(parsed);
}

export function writeStorySeedData(data: StoryData): void {
  const validated = storyDataSchema.parse(data);
  writeFileSync(getStorySeedPath(), `${JSON.stringify(validated, null, 2)}\n`, "utf-8");
}

export function listAlertsByStatus(data: StoryData, status: AlertStatus = "firing"): Alert[] {
  if (status === "all") {
    return data.alerts.map((alert) => ({ ...alert }));
  }

  return data.alerts.filter((alert) => alert.status === status).map((alert) => ({ ...alert }));
}

export function listIncidentsByStatus(data: StoryData, status: IncidentStatus = "open"): Incident[] {
  if (status === "all") {
    return data.incidents.map((incident) => ({ ...incident }));
  }

  return data.incidents
    .filter((incident) => incident.status === status)
    .map((incident) => ({ ...incident }));
}

export const openIncidentInputSchema = z.object({
  title: z.string().min(1).describe("Título curto e acionável para o incidente."),
  service: z.string().min(1).describe("Identificador do serviço afetado."),
  severity: severitySchema.describe("Severidade operacional: critical, high, medium ou low."),
});

export const resolveIncidentInputSchema = z.object({
  id: z.string().min(1).describe("ID do incidente que será resolvido, por exemplo inc-001."),
});

const runbookLookupInputSchema = z.object({
  service: z
    .string()
    .min(1)
    .describe("Identificador do serviço para consultar o runbook operacional."),
});

export type OpenIncidentInput = z.input<typeof openIncidentInputSchema>;

function openIncident(data: StoryData, rawInput: unknown): { data: StoryData; incident: Incident } {
  const input = openIncidentInputSchema.parse(rawInput);

  const serviceExists = data.services.some((service) => service.id === input.service);
  if (!serviceExists) {
    throw new UnknownServiceError(input.service);
  }

  const incident: Incident = {
    id: `inc-${String(data.nextIncidentId).padStart(3, "0")}`,
    title: input.title,
    service: input.service,
    severity: input.severity,
    status: "open",
    resolvedAt: null,
  };

  return {
    data: {
      ...data,
      incidents: [...data.incidents, incident],
      nextIncidentId: data.nextIncidentId + 1,
    },
    incident,
  };
}

function resolveIncident(data: StoryData, rawInput: unknown): { data: StoryData; incident: Incident } {
  const input = resolveIncidentInputSchema.parse(rawInput);
  const incident = data.incidents.find((candidate) => candidate.id === input.id);
  if (!incident) {
    throw new UnknownIncidentError(input.id);
  }
  if (incident.status === "resolved") {
    return { data, incident: { ...incident } };
  }

  const updatedIncident: Incident = {
    ...incident,
    status: "resolved",
    resolvedAt: new Date().toISOString(),
  };
  return {
    data: {
      ...data,
      incidents: data.incidents.map((candidate) =>
        candidate.id === updatedIncident.id ? updatedIncident : candidate,
      ),
    },
    incident: updatedIncident,
  };
}

function getRunbook(data: StoryData, rawInput: unknown): Runbook {
  const input = runbookLookupInputSchema.parse(rawInput);
  const serviceExists = data.services.some((service) => service.id === input.service);
  if (!serviceExists) {
    throw new UnknownServiceError(input.service);
  }

  const runbook = data.runbooks.find((candidate) => candidate.service === input.service);
  if (!runbook) {
    throw new UnknownRunbookError(input.service);
  }
  return { ...runbook };
}

export class StoryStore implements OpsStore {
  private data: StoryData;

  constructor(initialData?: StoryData) {
    this.data = initialData ? cloneStoryData(initialData) : readStorySeedData();
  }

  seedDefault(): void {
    this.data = createDefaultStoryData();
  }

  snapshot(): StoryData {
    return cloneStoryData(this.data);
  }

  listAlerts(status: AlertStatus = "firing"): Alert[] {
    return listAlertsByStatus(this.data, status);
  }

  openIncident(input: OpenIncidentInput): Incident {
    const result = openIncident(this.data, input);
    this.data = result.data;
    return result.incident;
  }

  resolveIncidentById(id: string): Incident {
    const result = resolveIncident(this.data, { id });
    this.data = result.data;
    return result.incident;
  }

  listIncidents(status: IncidentStatus = "open"): Incident[] {
    return listIncidentsByStatus(this.data, status);
  }

  getRunbookByService(service: string): Runbook {
    return getRunbook(this.data, { service });
  }
}

export { StoryStore as InMemoryOpsStore };

export const listAlertsInputSchema = z.object({
  status: alertStatusFilterSchema
    .default("firing")
    .describe("Filtro de estado dos alertas: firing, resolved ou all."),
});

const listIncidentsInputSchema = z.object({
  status: incidentStatusFilterSchema
    .default("open")
    .describe("Filtro de estado dos incidentes: open, resolved ou all."),
});

const checkProviderStatusInputSchema = z.object({
  provider: providerSchema
    .default("github")
    .describe(
      "Provedor externo para consultar status público (github ou cloudflare). Use quando houver dúvida se a falha é interna ou da dependência externa.",
    ),
});

function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof Error && error.message.startsWith("upstream 5")) {
    return true;
  }

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("fetch failed") || message.includes("network");
  }

  return false;
}

function providerErrorMessage(provider: Provider, error: unknown): string {
  const reason = error instanceof Error ? error.message : "erro desconhecido";
  return `não consegui consultar o status de ${provider} (${reason})`;
}

export async function fetchProviderStatus(
  provider: Provider,
  doFetch: FetchLike = fetch,
): Promise<string> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await doFetch(STATUS_URL[provider], { signal: AbortSignal.timeout(5000) });
      if (response.status >= 500) {
        throw new Error(`upstream ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`upstream ${response.status}`);
      }

      const { status } = providerStatusSchema.parse((await response.json()) as unknown);
      return `${provider} está ${status.indicator} - ${status.description}`;
    } catch (error) {
      const shouldRetry = attempt === 1 && isRetryableProviderError(error);
      if (shouldRetry) {
        continue;
      }
      return providerErrorMessage(provider, error);
    }
  }

  return providerErrorMessage(provider, new Error("erro de fluxo inesperado"));
}

function serializeToolOutput(value: unknown): string {
  return JSON.stringify(value);
}

export function createAgentTools(store: OpsStore, doFetch: FetchLike = fetch) {
  const listAlertsTool = tool(
    async (rawInput) => {
      const input = listAlertsInputSchema.parse(rawInput);
      const alerts = store.listAlerts(input.status);
      return serializeToolOutput({ alerts });
    },
    {
      name: "list_alerts",
      description:
        "Lista alertas de monitoramento por status (firing/resolved/all). Use para triagem inicial antes de qualquer ação.",
      schema: listAlertsInputSchema,
    },
  );

  const openIncidentTool = tool(
    async (rawInput) => {
      const input = openIncidentInputSchema.parse(rawInput);
      const incident = store.openIncident(input);
      return serializeToolOutput({ incident });
    },
    {
      name: "open_incident",
      description:
        "Abre um incidente operacional com título, serviço e severidade. Use quando um alerta ativo exigir rastreabilidade formal de resposta.",
      schema: openIncidentInputSchema,
    },
  );

  const resolveIncidentTool = tool(
    async (rawInput) => {
      const input = resolveIncidentInputSchema.parse(rawInput);
      const incident = store.resolveIncidentById(input.id);
      return serializeToolOutput({ incident });
    },
    {
      name: "resolve_incident",
      description:
        "Resolve um incidente existente por ID, registrando resolvedAt quando a resolução for concluída.",
      schema: resolveIncidentInputSchema,
    },
  );

  const listIncidentsTool = tool(
    async (rawInput) => {
      const input = listIncidentsInputSchema.parse(rawInput);
      const incidents = store.listIncidents(input.status);
      return serializeToolOutput({ incidents });
    },
    {
      name: "list_incidents",
      description:
        "Lista incidentes por status (open/resolved/all). Use para acompanhar backlog em aberto e histórico resolvido.",
      schema: listIncidentsInputSchema,
    },
  );

  const runbookLookupTool = tool(
    async (rawInput) => {
      const input = runbookLookupInputSchema.parse(rawInput);
      const runbook = store.getRunbookByService(input.service);
      return serializeToolOutput({ runbook });
    },
    {
      name: "consultar_runbook",
      description:
        "Consulta o runbook do serviço informado para orientar diagnóstico e mitigação do incidente.",
      schema: runbookLookupInputSchema,
    },
  );

  const checkProviderStatusTool = tool(
    async (rawInput) => {
      const input = checkProviderStatusInputSchema.parse(rawInput);
      return fetchProviderStatus(input.provider, doFetch);
    },
    {
      name: "check_provider_status",
      description:
        "Consulta o status público de provedores externos (github/cloudflare). Use quando houver suspeita de problema externo e a dúvida for: é do nosso sistema ou do provedor?",
      schema: checkProviderStatusInputSchema,
    },
  );

  return [
    listAlertsTool,
    openIncidentTool,
    resolveIncidentTool,
    listIncidentsTool,
    runbookLookupTool,
    checkProviderStatusTool,
  ];
}
