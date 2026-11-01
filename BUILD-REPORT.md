# aidocs — BUILD REPORT

Original: openai-docs (OpenAI docs MCP server) → Rebuild: aidocs
Tier C core subset. Local only, nothing pushed or published.

## Scope
8 tools against the public OpenAI documentation sites
(https://platform.openai.com/docs, base overridable via
OPENAI_DOCS_BASE_URL; developers.openai.com is the same docs family),
all HTTP behind an injectable FetchFn. Keyless by design: NO API key
is required and none is demanded — state that plainly. Tools:
search_openai_docs (GET {base}/api/search?q=&limit=, with a documented
sitemap fallback on non-2xx), fetch_openai_doc (GET the page URL,
fresh HTML-to-text extraction), list_openai_docs (GET
{base}/sitemap.xml, <loc> parsing, section/limit filters),
get_openai_doc_outline (h1-h3 heading extraction),
search_openai_changelog (GET {base}/changelog?search=&limit=),
fetch_openai_changelog (GET the page URL, extracted text),
get_api_reference (resource slug → {base}/api-reference/<slug>, text
plus outline), list_openai_guides (GET {base}/guides, optional
?category=, link extraction).

Omitted groups (fixture `_source` lists them): model listing and
model metadata tools, assistants and threads tools, audio and
realtime docs tools, cookbook and examples browsing beyond guides,
community/forum tools, billing/usage docs tools.

Ground truth: schemas are docs-derived from the public OpenAI docs
sites. Fixture: harness/fixtures/openai-docs-tools-original.json
(labelled core-subset, Tier C subset parity only).

## Verified (foreground, from disk)
- Tools: 8/8 — parity.json identical_tools = 8 = total.
- Unit tests: 13/13 pass (fake FetchFn; URL/method/header shaping for
  every tool, search-endpoint shape plus sitemap fallback, HTML-to-text
  and outline extraction, upstream non-2xx surfacing, network-failure
  propagation, keyless base resolution).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0; unknown command exits 2 with Usage.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Keyless check: with no key env set at all, parity stdio tools/list
  succeeded, and a CLI fetch_openai_doc call against an invalid host
  failed with "error: fetch failed" (exit 1) — it attempted the fetch
  and surfaced the network error; it did NOT demand any key.
- server.json description 62 chars (≤100); OCI entry has no version
  field; npm entry carries version 0.1.0; Dockerfile label
  io.github.CloudCorpRecords/aidocs; full 19-file factory set present.

## Honest gaps
- No live OpenAI docs call was verified end-to-end — request/response
  behaviour is fake-fetch proven only; the one live attempt was to an
  intentionally invalid host to prove the keyless fetch path.
- The docs search endpoint shape (/api/search) is a documented-shape
  implementation with a sitemap fallback, not a recorded live contract;
  the real site's search backend may differ.
- HTML-to-text extraction is a simple fresh tag-stripper; heavily
  script-rendered pages may yield sparse text.
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
