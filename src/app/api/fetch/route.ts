import { NextResponse } from "next/server";

/**
 * GET /api/fetch?url=<encoded-url>
 *
 * Server-side proxy that fetches a public URL and returns its text content.
 * This avoids CORS restrictions in the browser.
 *
 * Security controls:
 *  - Only http: and https: schemes are accepted
 *  - Private/loopback IPs are blocked to prevent SSRF (CWE-918)
 *  - Response is truncated to 30,000 chars to prevent context flooding
 *  - 10-second timeout
 */

const BLOCKED_HOSTNAMES = /^(localhost|127\.\d+\.\d+\.\d+|::1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/i;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
  }

  // Validate scheme and block SSRF targets
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Only http and https URLs are supported" }, { status: 400 });
  }

  if (BLOCKED_HOSTNAMES.test(parsed.hostname)) {
    return NextResponse.json({ error: "Private/loopback addresses are not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AssistantBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
      // Do not follow redirects to external auth pages blindly
      redirect: "follow",
    });

    const html = await res.text();

    // Strip scripts, styles, and HTML tags to get readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 30_000);

    return NextResponse.json({ text, url: rawUrl, status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
