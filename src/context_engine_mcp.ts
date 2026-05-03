import { info, warning } from "@actions/core";
import { jsonSchema, tool } from "ai";
import config from "./config";

type JsonObject = Record<string, unknown>;

export type McpToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: JsonObject;
};

type ContextEngineMcpOptions = {
  url: string;
  apiKey: string;
  collection?: string;
};

const DEFAULT_TOOL_NAMES = [
  "repo_search",
  "batch_search",
  "symbol_graph",
  "batch_symbol_graph",
  "graph_query",
  "batch_graph_query",
  "search_tests_for",
  "search_config_for",
  "search_commits_for",
];

const CODE_SEARCH_TOOLS = new Set([
  "search",
  "repo_search",
  "code_search",
  "batch_search",
  "search_tests_for",
  "search_config_for",
]);

const OUTPUT_FORMAT_TOOLS = new Set([
  ...CODE_SEARCH_TOOLS,
  "symbol_graph",
  "batch_symbol_graph",
  "graph_query",
  "batch_graph_query",
]);

function parseSseJson(text: string): unknown {
  const data = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]")
    .join("\n");
  return JSON.parse(data || text);
}

function sanitizeErrorMessage(message: unknown): string {
  return String(message || "unknown error").replace(/[\r\n]+/g, " ").slice(0, 300);
}

async function parseMcpResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Context Engine MCP HTTP ${response.status}`);
  }
  if (!text.trim()) return undefined;
  const parsed = text.trimStart().startsWith("event:") || text.includes("\ndata:")
    ? parseSseJson(text)
    : JSON.parse(text);
  if (parsed?.error) {
    const message = sanitizeErrorMessage(parsed.error?.message || JSON.stringify(parsed.error));
    throw new Error(`Context Engine MCP error: ${message}`);
  }
  return parsed?.result ?? parsed;
}

function withReviewerDefaults(name: string, args: unknown, collection?: string): JsonObject {
  const next: JsonObject = args && typeof args === "object" && !Array.isArray(args)
    ? { ...(args as JsonObject) }
    : {};
  if (collection && next.collection == null) next.collection = collection;
  if (next.limit == null) next.limit = 5;
  if (OUTPUT_FORMAT_TOOLS.has(name) && next.output_format == null) next.output_format = "toon";
  if (CODE_SEARCH_TOOLS.has(name)) {
    if (next.compact == null) next.compact = true;
    if (next.include_snippet == null) next.include_snippet = true;
  }
  return next;
}

export class ContextEngineMcpClient {
  private sessionId: string | undefined;
  private initialized = false;
  private requestId = 1;

  constructor(private readonly options: ContextEngineMcpOptions) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${this.options.apiKey}`,
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    if (this.options.collection) headers["x-collection"] = this.options.collection;
    return headers;
  }

  private async request(method: string, params?: JsonObject, notification = false): Promise<any> {
    const body: JsonObject = { jsonrpc: "2.0", method };
    if (!notification) body.id = this.requestId++;
    if (params) body.params = params;
    const response = await fetch(this.options.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const session = response.headers.get("mcp-session-id");
    if (session) this.sessionId = session;
    return parseMcpResponse(response);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "context-engine-reviewer", version: "1.0.0" },
    });
    try {
      await this.request("notifications/initialized", undefined, true);
    } catch {
      // Some MCP HTTP servers do not return a body for notifications; ignore.
    }
    this.initialized = true;
  }

  async listTools(): Promise<McpToolDefinition[]> {
    await this.initialize();
    const result = await this.request("tools/list");
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async callTool(name: string, args: unknown): Promise<unknown> {
    await this.initialize();
    return this.request("tools/call", {
      name,
      arguments: withReviewerDefaults(name, args, this.options.collection),
    });
  }
}

function selectedToolNames(): Set<string> {
  const configured = (config as any).contextEngineTools as string[] | undefined;
  return new Set((configured?.length ? configured : DEFAULT_TOOL_NAMES).map((name) => name.trim()).filter(Boolean));
}

function safeInputSchema(schema: unknown): JsonObject {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) return schema as JsonObject;
  return { type: "object", additionalProperties: true };
}

export function isContextEngineMcpEnabled(): boolean {
  return Boolean((config as any).contextEngineApiKey && (config as any).contextEngineMcpUrl);
}

export async function createContextEngineTools(): Promise<Record<string, any> | undefined> {
  if (!isContextEngineMcpEnabled()) return undefined;

  const client = new ContextEngineMcpClient({
    url: (config as any).contextEngineMcpUrl,
    apiKey: (config as any).contextEngineApiKey,
    collection: (config as any).contextEngineCollection,
  });
  const allowed = selectedToolNames();
  const maxTools = Math.max(1, Number((config as any).contextEngineMaxTools || DEFAULT_TOOL_NAMES.length));

  try {
    const remoteTools = (await client.listTools())
      .filter((remoteTool) => allowed.has(remoteTool.name))
      .slice(0, maxTools);
    const tools: Record<string, any> = {};
    for (const remoteTool of remoteTools) {
      tools[remoteTool.name] = tool({
        description: remoteTool.description || `Call Context Engine MCP tool ${remoteTool.name}`,
        inputSchema: jsonSchema(safeInputSchema(remoteTool.inputSchema)),
        execute: async (input: unknown) => client.callTool(remoteTool.name, input),
      });
    }
    if (process.env.DEBUG) info(`[context-engine] enabled MCP reviewer tools: ${Object.keys(tools).join(", ")}`);
    return Object.keys(tools).length ? tools : undefined;
  } catch (error) {
    warning(`Context Engine MCP tools disabled: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export function appendContextEngineToolInstructions(system?: string): string | undefined {
  if (!isContextEngineMcpEnabled()) return system;
  const instructions = `

<CONTEXT_ENGINE_TOOLS>
Context Engine MCP tools may be available. Use explicit repository tools such as repo_search, batch_search, symbol_graph, batch_symbol_graph, graph_query, batch_graph_query, search_tests_for, search_config_for, and search_commits_for when the PR diff is insufficient and repository context would materially improve review accuracy.
Only use returned repository context to assess code introduced in this PR. Do not invent issues from unrelated unchanged code.
</CONTEXT_ENGINE_TOOLS>`;
  return `${system || ""}${instructions}`;
}