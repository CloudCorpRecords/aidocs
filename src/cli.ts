#!/usr/bin/env node
/**
 * aidocs CLI.
 *   aidocs <tool-name> '<json args>'
 *   aidocs mcp
 * Keyless by design: no API key is required. Exit codes: 0, 1 error, 2 usage.
 */
import { callTool, docsBaseFromEnv, VERSION } from "./docs.js";
import type { FetchFn } from "./types.js";

const TOOL_NAMES = [
  "search_openai_docs", "fetch_openai_doc", "list_openai_docs",
  "get_openai_doc_outline", "search_openai_changelog", "fetch_openai_changelog",
  "get_api_reference", "list_openai_guides",
];

function usage(): never {
  console.error(`Usage:
  aidocs <tool> '<json args>'   tools: ${TOOL_NAMES.join(", ")}
  aidocs mcp
  aidocs --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOL_NAMES.includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("error: args must be a JSON object");
      process.exit(1);
    }
  }
  try {
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    const out = await callTool(fetchFn, docsBaseFromEnv(), cmd, args);
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
