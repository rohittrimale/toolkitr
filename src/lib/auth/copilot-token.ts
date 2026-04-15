/**
 * GitHub Copilot token management.
 * Exchanges a GitHub OAuth token for a short-lived Copilot access token.
 */

interface CopilotTokenCache {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CopilotTokenCache>();

export async function getCopilotToken(githubToken: string): Promise<string> {
  const cached = tokenCache.get(githubToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const res = await fetch("https://api.github.com/copilot_internal/v2/token", {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/json",
      "User-Agent": "Toolkitr-AI-Copilot/1.0",
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Copilot token exchange failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as { token?: string; expires_at?: number };
  if (!data.token) throw new Error("No token in Copilot response");

  const expiresAt = data.expires_at ? data.expires_at * 1000 : Date.now() + 30 * 60 * 1000;
  tokenCache.set(githubToken, { token: data.token, expiresAt });

  return data.token;
}

export function invalidateCopilotToken(githubToken: string): void {
  tokenCache.delete(githubToken);
}

export async function getCopilotUserInfo(githubToken: string): Promise<{ login: string; name: string; email: string; avatar_url: string; copilot_plan?: string } | null> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/json",
        "User-Agent": "Toolkitr-AI-Copilot/1.0",
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
