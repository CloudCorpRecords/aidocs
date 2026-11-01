/**
 * aidocs MCP server. Core subset: 8 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly. Keyless by design: no token.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { callTool, docsBaseFromEnv, VERSION } from "./docs.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  search_openai_docs: z.object({ query: z.string(), limit: z.number().optional() }),
  fetch_openai_doc: z.object({ url: z.string() }),
  list_openai_docs: z.object({ section: z.string().optional(), limit: z.number().optional() }),
  get_openai_doc_outline: z.object({ url: z.string() }),
  search_openai_changelog: z.object({ query: z.string(), limit: z.number().optional() }),
  fetch_openai_changelog: z.object({ url: z.string() }),
  get_api_reference: z.object({ resource: z.string() }),
  list_openai_guides: z.object({ category: z.string().optional(), limit: z.number().optional() }),
};

export const TOOLS = [
  {
    name: "search_openai_docs",
    description: "Search the OpenAI documentation for pages matching a query.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search terms to match against the OpenAI documentation." },
        limit: { type: "number", description: "Maximum number of search results to return (default 10)." },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_openai_doc",
    description: "Fetch an OpenAI documentation page and return its extracted text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL of the OpenAI documentation page to fetch." },
      },
      required: ["url"],
    },
  },
  {
    name: "list_openai_docs",
    description: "List OpenAI documentation pages, optionally filtered by section.",
    inputSchema: {
      type: "object" as const,
      properties: {
        section: { type: "string", description: "Optional section substring to filter the listed documentation page URLs by." },
        limit: { type: "number", description: "Maximum number of documentation pages to list." },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_openai_doc_outline",
    description: "Return the heading outline of an OpenAI documentation page.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL of the OpenAI documentation page whose heading outline should be returned." },
      },
      required: ["url"],
    },
  },
  {
    name: "search_openai_changelog",
    description: "Search the OpenAI changelog for entries matching a query.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search terms to match against the OpenAI changelog." },
        limit: { type: "number", description: "Maximum number of changelog results to return (default 10)." },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_openai_changelog",
    description: "Fetch an OpenAI changelog page and return its extracted text.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL of the OpenAI changelog page to fetch." },
      },
      required: ["url"],
    },
  },
  {
    name: "get_api_reference",
    description: "Fetch the OpenAI API reference section for a named resource.",
    inputSchema: {
      type: "object" as const,
      properties: {
        resource: { type: "string", description: "API resource slug naming the reference section to fetch, appended to /docs/api-reference/." },
      },
      required: ["resource"],
    },
  },
  {
    name: "list_openai_guides",
    description: "List OpenAI guides, optionally filtered by category.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Optional guide category to filter the listed guides by." },
        limit: { type: "number", description: "Maximum number of guides to list (default 20)." },
      },
      required: [] as string[],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    }],
  };
}
function errorResult(err: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: err instanceof Error ? err.message : String(err),
    }],
    isError: true,
  };
}

const server = new Server(
  { name: "aidocs", version: VERSION },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, docsBaseFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
