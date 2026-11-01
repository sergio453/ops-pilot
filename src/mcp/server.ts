import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import {
  createAgentTools,
  listAlertsInputSchema,
  openIncidentInputSchema,
  resolveIncidentInputSchema,
  type OpsStore,
} from "../agents/tools.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";

const SERVER_NAME = "opspilot";
const SERVER_VERSION = "1.0.0";

const MCP_TOOL_SCHEMAS = {
  list_alerts: listAlertsInputSchema,
  open_incident: openIncidentInputSchema,
  resolve_incident: resolveIncidentInputSchema,
} as const;

export const OPSPILOT_MCP_TOOL_NAMES = Object.keys(MCP_TOOL_SCHEMAS) as Array<
  keyof typeof MCP_TOOL_SCHEMAS
>;

type OpsPilotToolName = (typeof OPSPILOT_MCP_TOOL_NAMES)[number];
type ToolSchema = (typeof MCP_TOOL_SCHEMAS)[OpsPilotToolName];
type ToolCallResult = { content: [{ type: "text"; text: string }]; isError?: boolean };

interface McpToolBinding {
  name: OpsPilotToolName;
  description: string;
  inputSchema: ToolSchema;
  call: (input: unknown) => Promise<ToolCallResult>;
}

export interface CreateOpsPilotMcpServerOptions {
  store?: OpsStore;
}

export interface StartOpsPilotMcpServerOptions {
  store?: OpsStore;
  transport?: Transport;
  diagnostics?: { error: (...args: unknown[]) => void };
}

export interface OpsPilotMcpServerRuntime {
  server: McpServer;
  toolCatalog: readonly OpsPilotToolName[];
  bindings: readonly McpToolBinding[];
}

function serializeResult(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function toolErrorResult(name: string, error: unknown): ToolCallResult {
  const reason = error instanceof Error ? error.message : "erro desconhecido";
  return {
    isError: true,
    content: [{ type: "text", text: `${name} falhou: ${reason}` }],
  };
}

function createMcpToolBindings(store: OpsStore): McpToolBinding[] {
  const tools = createAgentTools(store);
  const toolByName = new Map(tools.map((candidate) => [candidate.name, candidate]));

  return OPSPILOT_MCP_TOOL_NAMES.map((name) => {
    const tool = toolByName.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" não encontrada em createAgentTools`);
    }

    const description = tool.description ?? "";
    const inputSchema = MCP_TOOL_SCHEMAS[name];
    const call = async (input: unknown): Promise<ToolCallResult> => {
      try {
        const text = serializeResult(await tool.invoke(input));
        return { content: [{ type: "text", text }] };
      } catch (error: unknown) {
        return toolErrorResult(name, error);
      }
    };

    return { name, description, inputSchema, call };
  });
}

export function createOpsPilotMcpServer(options?: CreateOpsPilotMcpServerOptions): OpsPilotMcpServerRuntime {
  const store = options?.store ?? new SqliteOpsStore();
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const bindings = createMcpToolBindings(store);
  for (const binding of bindings) {
    server.registerTool(
      binding.name,
      {
        description: binding.description,
        inputSchema: binding.inputSchema,
      },
      async (input: unknown) => binding.call(input),
    );
  }

  return {
    server,
    toolCatalog: OPSPILOT_MCP_TOOL_NAMES,
    bindings,
  };
}

export async function startOpsPilotMcpServer(
  options?: StartOpsPilotMcpServerOptions,
): Promise<OpsPilotMcpServerRuntime> {
  const runtime = createOpsPilotMcpServer({ store: options?.store });
  const transport = options?.transport ?? new StdioServerTransport();
  await runtime.server.connect(transport);

  const diagnostics = options?.diagnostics ?? console;
  diagnostics.error("opspilot MCP server: pronto (stdio)");
  return runtime;
}

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  startOpsPilotMcpServer().catch((error: unknown) => {
    console.error("opspilot MCP server failed:", error);
    process.exitCode = 1;
  });
}
