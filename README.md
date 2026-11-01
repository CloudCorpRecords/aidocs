# aidocs

OpenAI documentation as MCP tools, talking to the public OpenAI docs
sites. aidocs is a clean-room rebuild of the core surface of the
OpenAI docs MCP server, under a new name: fresh code, no copied
branding. It is keyless by design — the documentation sites are
public, so no API key is required or demanded.

## Tools (core subset, 8)

`search_openai_docs`, `fetch_openai_doc`, `list_openai_docs`,
`get_openai_doc_outline`, `search_openai_changelog`,
`fetch_openai_changelog`, `get_api_reference`, `list_openai_guides`.

Not in this subset: model listing and metadata tools, assistants and
threads tools, audio and realtime docs tools, cookbook browsing beyond
guides, community tools, and billing/usage docs tools.

## Setup

No credentials. Optionally override the docs base with
`OPENAI_DOCS_BASE_URL` (default `https://platform.openai.com/docs`).
Fetch failures surface the underlying network or upstream error.

## CLI

```bash
npx @reneturcios/aidocs search_openai_docs '{"query":"function calling"}'
npx @reneturcios/aidocs mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "aidocs": {
      "command": "npx",
      "args": ["-y", "@reneturcios/aidocs", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/aidocs
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
