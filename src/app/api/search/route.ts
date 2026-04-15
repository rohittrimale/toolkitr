/**
 * GET /api/search?q=<query>
 *
 * Web search endpoint.
 * Priority:
 *   1. Brave Search API  (if BRAVE_SEARCH_API_KEY env var is set)
 *   2. DuckDuckGo Instant Answer API  (free, no key)
 *
 * Returns: { results: [{ title, url, snippet }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  source: "brave" | "duckduckgo";
}

// ─── Brave Search ─────────────────────────────────────────────────────────────

async function braveSearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Brave Search ${res.status}`);
  const data = await res.json() as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
      }>;
    };
  };
  return (data.web?.results ?? []).slice(0, 5).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.description ?? "",
  }));
}

// ─── DuckDuckGo Instant Answer ─────────────────────────────────────────────────

async function ddgSearch(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Assistent/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`DDG ${res.status}`);
  const data = await res.json() as {
    Abstract?: string;
    AbstractURL?: string;
    AbstractSource?: string;
    AbstractText?: string;
    RelatedTopics?: Array<{
      Text?: string;
      FirstURL?: string;
      Topics?: Array<{ Text?: string; FirstURL?: string }>;
    }>;
  };

  const results: SearchResult[] = [];

  // Main abstract
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.AbstractSource ?? query,
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  // Related topics
  for (const topic of (data.RelatedTopics ?? []).slice(0, 4)) {
    if (topic.Text && topic.FirstURL) {
      results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, snippet: topic.Text });
    }
    // Nested topic groups
    for (const sub of (topic.Topics ?? []).slice(0, 2)) {
      if (sub.Text && sub.FirstURL) {
        results.push({ title: sub.Text.slice(0, 80), url: sub.FirstURL, snippet: sub.Text });
      }
    }
    if (results.length >= 5) break;
  }

  return results;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Missing query parameter q" }, { status: 400 });
  }

  // Client can pass their Brave key via header (forwarded from settings)
  const braveKey =
    req.headers.get("x-brave-key") ??
    process.env.BRAVE_SEARCH_API_KEY ??
    "";

  try {
    if (braveKey) {
      const results = await braveSearch(q, braveKey);
      return NextResponse.json<SearchResponse>({ results, query: q, source: "brave" });
    }
    // Fallback: DDG
    const results = await ddgSearch(q);
    return NextResponse.json<SearchResponse>({ results, query: q, source: "duckduckgo" });
  } catch {
    // Return empty results rather than erroring the whole request
    return NextResponse.json<SearchResponse>({
      results: [],
      query: q,
      source: "duckduckgo",
    });
  }
}
