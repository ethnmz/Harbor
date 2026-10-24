/**
 * SerpApi (https://serpapi.com) — live Google web and Google News results.
 * engine=google returns organic_results; engine=google_news returns news_results
 * (which may contain clustered "stories").
 */

export type SearchHit = { title: string; link: string; source: string | null; date: string | null; snippet: string | null };
export type SearchResponse = {
  engine: "google" | "google_news";
  query: string;
  results: SearchHit[];
  simulated: boolean;
  cached: boolean;
  searchId?: string;
};

/** SerpApi's per-search price on its developer plan, used for cost estimates. */
export const SERPAPI_COST_PER_SEARCH = 0.015;

const cache = new Map<string, { at: number; value: SearchResponse }>();
const CACHE_MS = 5 * 60_000;

type RawNews = {
  title?: string;
  link?: string;
  date?: string;
  snippet?: string;
  source?: { name?: string } | string;
  highlight?: RawNews;
  stories?: RawNews[];
};
type RawOrganic = { title?: string; link?: string; snippet?: string; source?: string; date?: string; displayed_link?: string };

function sourceName(s: RawNews["source"]) {
  if (!s) return null;
  return typeof s === "string" ? s : (s.name ?? null);
}

function flattenNews(items: RawNews[]): SearchHit[] {
  const out: SearchHit[] = [];
  for (const item of items) {
    const candidates = item.title && item.link ? [item] : [item.highlight, ...(item.stories ?? [])].filter(Boolean) as RawNews[];
    for (const c of candidates) {
      if (!c.title || !c.link) continue;
      out.push({ title: c.title, link: c.link, source: sourceName(c.source), date: c.date ?? null, snippet: c.snippet ?? null });
    }
  }
  return out;
}

export async function serpSearch(engine: "google" | "google_news", query: string, limit = 5): Promise<SearchResponse> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return { engine, query, results: simulatedResults(engine, query).slice(0, limit), simulated: true, cached: false };

  const cacheKey = `${engine}:${query.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.value, cached: true };

  const params = new URLSearchParams({ engine, q: query, api_key: key, hl: "en", gl: "us" });
  if (engine === "google") params.set("num", String(limit));
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  const json = (await res.json()) as {
    error?: string;
    search_metadata?: { id?: string };
    organic_results?: RawOrganic[];
    news_results?: RawNews[];
    top_stories?: RawNews[];
  };
  if (!res.ok || json.error) throw new Error(`SerpApi ${res.status}: ${json.error ?? res.statusText}`);

  const results =
    engine === "google_news"
      ? flattenNews(json.news_results ?? [])
      : [
          ...flattenNews(json.top_stories ?? []),
          ...(json.organic_results ?? []).map((r) => ({
            title: r.title ?? "",
            link: r.link ?? "",
            source: r.source ?? r.displayed_link ?? null,
            date: r.date ?? null,
            snippet: r.snippet ?? null,
          })),
        ].filter((r) => r.title && r.link);

  const value: SearchResponse = { engine, query, results: results.slice(0, limit), simulated: false, cached: false, searchId: json.search_metadata?.id };
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

/** Offline results, clearly labelled, pointing at real status pages. */
function simulatedResults(engine: string, query: string): SearchHit[] {
  const q = query.toLowerCase();
  const label = "Simulated result (set SERPAPI_API_KEY for live search)";
  const hits: SearchHit[] = [];
  if (q.includes("cloudflare"))
    hits.push(
      { title: "Cloudflare investigating elevated 5xx errors on its network", link: "https://www.cloudflarestatus.com/", source: label, date: "1 hour ago", snippet: "Customers may see 502 Bad Gateway errors for proxied sites." },
      { title: "Cloudflare System Status", link: "https://www.cloudflarestatus.com/", source: label, date: null, snippet: "Live status of Cloudflare services." },
    );
  if (q.includes("google"))
    hits.push(
      { title: "Google Workspace sign-in issues reported by users", link: "https://www.google.com/appsstatus/dashboard/", source: label, date: "2 hours ago", snippet: "Some users report problems signing in with Google accounts." },
      { title: "Google Workspace Status Dashboard", link: "https://www.google.com/appsstatus/dashboard/", source: label, date: null, snippet: "Current status of Google Workspace services." },
    );
  if (q.includes("aws") || q.includes("amazon"))
    hits.push({ title: "AWS Health Dashboard", link: "https://health.aws.amazon.com/health/status", source: label, date: null, snippet: "Service health across AWS regions." });
  if (!hits.length)
    hits.push({ title: `No recent outage reports found for "${query}"`, link: "https://downdetector.com/", source: label, date: null, snippet: engine === "google_news" ? "No matching news stories." : "No matching results." });
  return hits;
}
