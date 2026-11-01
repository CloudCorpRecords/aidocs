/**
 * aidocs core: an 8-tool core subset of the OpenAI docs MCP surface,
 * implemented clean-room against the public OpenAI documentation sites
 * (https://platform.openai.com/docs and https://developers.openai.com).
 *
 * Keyless by design: the docs sites are public, so there is NO API key
 * and no missing-key error. All HTTP goes through an injected FetchFn.
 * A network or upstream failure surfaces the underlying error honestly.
 *
 * URL shaping (documented, deterministic):
 * - search uses GET {docs}/api/search?q=<query>&limit=<n> and falls back
 *   to parsing the sitemap when the search endpoint returns non-2xx.
 * - list uses GET {docs}/sitemap.xml and filters <loc> entries.
 * - fetch / outline / changelog fetch the given page URL directly and
 *   extract text / headings from the returned HTML.
 * - API reference maps a resource slug to
 *   https://platform.openai.com/docs/api-reference/<resource>.
 * - guides list uses GET {docs}/guides, optionally ?category=<c>.
 */
import type {
  ApiReferenceOptions,
  FetchChangelogOptions,
  FetchDocOptions,
  FetchFn,
  ListDocsOptions,
  ListGuidesOptions,
  OutlineOptions,
  SearchChangelogOptions,
  SearchDocsOptions,
} from "./types.js";

export const VERSION = "0.1.0";
export const DOCS_BASE = "https://platform.openai.com/docs";
export const DEV_BASE = "https://developers.openai.com";

export function docsBaseFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.OPENAI_DOCS_BASE_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DOCS_BASE).replace(/\/+$/, "");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractOutline(html: string): Array<{ level: number; text: string }> {
  const out: Array<{ level: number; text: string }> = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ level: Number(m[1]), text: htmlToText(m[2]) });
  }
  return out;
}

export function extractLinks(html: string, limit?: number): Array<{ title: string; url: string }> {
  const out: Array<{ title: string; url: string }> = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ url: m[1], title: htmlToText(m[2]) });
    if (limit !== undefined && out.length >= limit) break;
  }
  return out;
}

function parseSitemap(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) urls.push(m[1]);
  return urls;
}

async function getText(fetchFn: FetchFn, url: string): Promise<string> {
  const res = await fetchFn(url, {
    method: "GET",
    headers: { Accept: "text/html, application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI docs error ${res.status}: ${text}`);
  return text;
}

function tryJson(text: string): unknown {
  try { return JSON.parse(text) as unknown; } catch { return null; }
}

export async function searchOpenaiDocs(fetchFn: FetchFn, base: string, opts: SearchDocsOptions): Promise<unknown> {
  const limit = opts.limit ?? 10;
  const url = `${base}/api/search?q=${encodeURIComponent(opts.query)}&limit=${limit}`;
  const res = await fetchFn(url, { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) {
    // Documented fallback: sitemap scan filtered by the query terms.
    const xml = await getText(fetchFn, `${base}/sitemap.xml`);
    const needle = opts.query.toLowerCase();
    const results = parseSitemap(xml).filter((u) => u.toLowerCase().includes(needle)).slice(0, limit);
    return { query: opts.query, results, source: "sitemap-fallback" };
  }
  const parsed = tryJson(text);
  return parsed ?? { query: opts.query, results: extractLinks(text, limit) };
}

export async function fetchOpenaiDoc(fetchFn: FetchFn, _base: string, opts: FetchDocOptions): Promise<unknown> {
  const html = await getText(fetchFn, opts.url);
  return { url: opts.url, text: htmlToText(html) };
}

export async function listOpenaiDocs(fetchFn: FetchFn, base: string, opts: ListDocsOptions): Promise<unknown> {
  const xml = await getText(fetchFn, `${base}/sitemap.xml`);
  let urls = parseSitemap(xml);
  if (opts.section) urls = urls.filter((u) => u.includes(opts.section!));
  if (opts.limit !== undefined) urls = urls.slice(0, opts.limit);
  return { results: urls };
}

export async function getOpenaiDocOutline(fetchFn: FetchFn, _base: string, opts: OutlineOptions): Promise<unknown> {
  const html = await getText(fetchFn, opts.url);
  return { url: opts.url, outline: extractOutline(html) };
}

export async function searchOpenaiChangelog(fetchFn: FetchFn, base: string, opts: SearchChangelogOptions): Promise<unknown> {
  const limit = opts.limit ?? 10;
  const url = `${base}/changelog?search=${encodeURIComponent(opts.query)}&limit=${limit}`;
  const html = await getText(fetchFn, url);
  const parsed = tryJson(html);
  if (parsed) return parsed;
  return { query: opts.query, results: extractLinks(html, limit) };
}

export async function fetchOpenaiChangelog(fetchFn: FetchFn, _base: string, opts: FetchChangelogOptions): Promise<unknown> {
  const html = await getText(fetchFn, opts.url);
  return { url: opts.url, text: htmlToText(html) };
}

export async function getApiReference(fetchFn: FetchFn, base: string, opts: ApiReferenceOptions): Promise<unknown> {
  const slug = opts.resource.trim().replace(/^\/+/, "").replace(/\s+/g, "-").toLowerCase();
  const url = `${base}/api-reference/${slug}`;
  const html = await getText(fetchFn, url);
  return { resource: opts.resource, url, text: htmlToText(html), outline: extractOutline(html) };
}

export async function listOpenaiGuides(fetchFn: FetchFn, base: string, opts: ListGuidesOptions): Promise<unknown> {
  const qs = opts.category ? `?category=${encodeURIComponent(opts.category)}` : "";
  const html = await getText(fetchFn, `${base}/guides${qs}`);
  return { results: extractLinks(html, opts.limit ?? 20) };
}

export async function callTool(fetchFn: FetchFn, base: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_openai_docs": return searchOpenaiDocs(fetchFn, base, args as unknown as SearchDocsOptions);
    case "fetch_openai_doc": return fetchOpenaiDoc(fetchFn, base, args as unknown as FetchDocOptions);
    case "list_openai_docs": return listOpenaiDocs(fetchFn, base, args as unknown as ListDocsOptions);
    case "get_openai_doc_outline": return getOpenaiDocOutline(fetchFn, base, args as unknown as OutlineOptions);
    case "search_openai_changelog": return searchOpenaiChangelog(fetchFn, base, args as unknown as SearchChangelogOptions);
    case "fetch_openai_changelog": return fetchOpenaiChangelog(fetchFn, base, args as unknown as FetchChangelogOptions);
    case "get_api_reference": return getApiReference(fetchFn, base, args as unknown as ApiReferenceOptions);
    case "list_openai_guides": return listOpenaiGuides(fetchFn, base, args as unknown as ListGuidesOptions);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
