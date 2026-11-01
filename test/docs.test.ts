import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  docsBaseFromEnv,
  extractOutline,
  fetchOpenaiChangelog,
  fetchOpenaiDoc,
  getApiReference,
  getOpenaiDocOutline,
  htmlToText,
  listOpenaiDocs,
  listOpenaiGuides,
  searchOpenaiChangelog,
  searchOpenaiDocs,
} from "../src/docs.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded { url: string; method: string; headers: Record<string, string>; body: unknown; }

function fakeFetch(steps: Array<{ match: string; payload?: unknown; html?: string; status?: number }>) {
  const calls: Recorded[] = [];
  const fn: FetchFn = async (url, init) => {
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body: init?.body });
    const step = steps.find((s) => url.includes(s.match)) ?? { match: "", payload: {} };
    const text = step.html ?? JSON.stringify(step.payload ?? {});
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => text,
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://platform.openai.com/docs";
const PAGE = "<html><head><style>.x{}</style><script>bad()</script></head><body><h1>Intro</h1><p>Hello <b>world</b> &amp; friends</p><h2>Setup</h2><a href=\"/docs/guides\">Guides</a></body></html>";
const SITEMAP = "<?xml version=\"1.0\"?><urlset><url><loc>https://platform.openai.com/docs/guides/chat</loc></url><url><loc>https://platform.openai.com/docs/models</loc></url></urlset>";

describe("aidocs core", () => {
  it("is keyless: base defaults with no env and no key demanded", () => {
    assert.equal(docsBaseFromEnv({}), "https://platform.openai.com/docs");
    assert.equal(docsBaseFromEnv({ OPENAI_DOCS_BASE_URL: "https://example.test/docs/" }), "https://example.test/docs");
  });

  it("htmlToText strips tags/scripts and decodes entities; outline extracts headings", () => {
    assert.equal(htmlToText(PAGE), "Intro Hello world & friends Setup Guides");
    assert.deepEqual(extractOutline(PAGE), [{ level: 1, text: "Intro" }, { level: 2, text: "Setup" }]);
  });

  it("search_openai_docs hits the search endpoint shape with query and limit", async () => {
    const { fn, calls } = fakeFetch([{ match: "/api/search", payload: { results: [{ title: "Chat" }] } }]);
    const out = (await searchOpenaiDocs(fn, BASE, { query: "chat completions", limit: 3 })) as Record<string, unknown>;
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://platform.openai.com/docs/api/search?q=chat%20completions&limit=3");
    assert.deepEqual(out.results, [{ title: "Chat" }]);
  });

  it("search falls back to the sitemap when the search endpoint fails", async () => {
    const { fn, calls } = fakeFetch([
      { match: "/api/search", payload: { error: "nope" }, status: 404 },
      { match: "/sitemap.xml", html: SITEMAP },
    ]);
    const out = (await searchOpenaiDocs(fn, BASE, { query: "chat" })) as Record<string, unknown>;
    assert.equal(calls[1].url, "https://platform.openai.com/docs/sitemap.xml");
    assert.equal(out.source, "sitemap-fallback");
    assert.deepEqual(out.results, ["https://platform.openai.com/docs/guides/chat"]);
  });

  it("fetch_openai_doc returns extracted text for the given URL", async () => {
    const { fn, calls } = fakeFetch([{ match: "example", html: PAGE }]);
    const out = (await fetchOpenaiDoc(fn, BASE, { url: "https://platform.openai.com/docs/example" })) as Record<string, unknown>;
    assert.equal(calls[0].url, "https://platform.openai.com/docs/example");
    assert.match(String(out.text), /Hello world/);
  });

  it("list_openai_docs parses the sitemap and filters by section and limit", async () => {
    const { fn, calls } = fakeFetch([{ match: "/sitemap.xml", html: SITEMAP }]);
    const all = (await listOpenaiDocs(fn, BASE, {})) as Record<string, unknown>;
    assert.equal(calls[0].url, "https://platform.openai.com/docs/sitemap.xml");
    assert.equal((all.results as string[]).length, 2);
    const filtered = (await listOpenaiDocs(fn, BASE, { section: "guides", limit: 1 })) as Record<string, unknown>;
    assert.deepEqual(filtered.results, ["https://platform.openai.com/docs/guides/chat"]);
  });

  it("get_openai_doc_outline returns headings only", async () => {
    const { fn } = fakeFetch([{ match: "page", html: PAGE }]);
    const out = (await getOpenaiDocOutline(fn, BASE, { url: "https://platform.openai.com/docs/page" })) as Record<string, unknown>;
    assert.deepEqual(out.outline, [{ level: 1, text: "Intro" }, { level: 2, text: "Setup" }]);
  });

  it("search_openai_changelog shapes the changelog search URL", async () => {
    const { fn, calls } = fakeFetch([{ match: "/changelog", html: PAGE }]);
    const out = (await searchOpenaiChangelog(fn, BASE, { query: "gpt", limit: 2 })) as Record<string, unknown>;
    assert.equal(calls[0].url, "https://platform.openai.com/docs/changelog?search=gpt&limit=2");
    assert.equal(out.query, "gpt");
  });

  it("fetch_openai_changelog returns extracted text", async () => {
    const { fn } = fakeFetch([{ match: "changelog", html: PAGE }]);
    const out = (await fetchOpenaiChangelog(fn, BASE, { url: "https://platform.openai.com/docs/changelog/x" })) as Record<string, unknown>;
    assert.match(String(out.text), /Hello world/);
  });

  it("get_api_reference maps a resource to the api-reference path", async () => {
    const { fn, calls } = fakeFetch([{ match: "/api-reference/", html: PAGE }]);
    const out = (await getApiReference(fn, BASE, { resource: "Chat Completions" })) as Record<string, unknown>;
    assert.equal(calls[0].url, "https://platform.openai.com/docs/api-reference/chat-completions");
    assert.equal(out.url, "https://platform.openai.com/docs/api-reference/chat-completions");
  });

  it("list_openai_guides fetches /guides with optional category", async () => {
    const { fn, calls } = fakeFetch([{ match: "/guides", html: PAGE }]);
    const out = (await listOpenaiGuides(fn, BASE, { category: "text", limit: 5 })) as Record<string, unknown>;
    assert.equal(calls[0].url, "https://platform.openai.com/docs/guides?category=text");
    assert.deepEqual(out.results, [{ url: "/docs/guides", title: "Guides" }]);
  });

  it("surfaces upstream non-2xx honestly", async () => {
    const { fn } = fakeFetch([{ match: "missing", html: "not found", status: 404 }]);
    await assert.rejects(() => fetchOpenaiDoc(fn, BASE, { url: "https://platform.openai.com/docs/missing" }), /OpenAI docs error 404: not found/);
  });

  it("propagates network failure from the injected fetch", async () => {
    const fn: FetchFn = async () => { throw new Error("socket hang up"); };
    await assert.rejects(() => fetchOpenaiDoc(fn, BASE, { url: "https://x.test/a" }), /socket hang up/);
  });
});
