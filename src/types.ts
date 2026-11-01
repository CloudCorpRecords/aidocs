/**
 * aidocs types.
 *
 * A core subset of the OpenAI docs MCP surface: search, fetch, listing,
 * outlines, changelog and API reference against the public OpenAI docs
 * sites. HTTP access is described by a minimal response surface so
 * tests can inject a fake fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface SearchDocsOptions { query: string; limit?: number; }
export interface FetchDocOptions { url: string; }
export interface ListDocsOptions { section?: string; limit?: number; }
export interface OutlineOptions { url: string; }
export interface SearchChangelogOptions { query: string; limit?: number; }
export interface FetchChangelogOptions { url: string; }
export interface ApiReferenceOptions { resource: string; }
export interface ListGuidesOptions { category?: string; limit?: number; }
