/**
 * POST /api/auth/device/poll
 * Polls GitHub for the device flow access token.
 * When the user has authorized, fetches their profile and sets the session cookie.
 * Body: { device_code: string }
 * Returns:
 *   { status: "pending" }            — user hasn't authorized yet
 *   { status: "authorized", user }   — success, session cookie set
 *   { status: "error", error }       — expired or other error
 */
import { NextRequest, NextResponse } from "next/server";
import { makeSessionCookie, SESSION_COOKIE_NAME, type SessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const VSCODE_CLIENT_ID = "01ab8ac9400c4e429b23";

export async function POST(req: NextRequest) {
  let body: { device_code?: string };
  try {
    body = await req.json() as { device_code?: string };
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid request body" }, { status: 400 });
  }
  const { device_code } = body;

  if (!device_code) {
    return NextResponse.json({ status: "error", error: "Missing device_code" }, { status: 400 });
  }

  // Poll GitHub for the access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: VSCODE_CLIENT_ID,
      device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ status: "error", error: "Token poll request failed" }, { status: 500 });
  }

  const tokenData = await tokenRes.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error === "authorization_pending" || tokenData.error === "slow_down") {
    return NextResponse.json({ status: "pending" });
  }

  if (tokenData.error === "expired_token") {
    return NextResponse.json({ status: "error", error: "Code expired — please try again" }, { status: 400 });
  }

  if (tokenData.error) {
    return NextResponse.json(
      { status: "error", error: tokenData.error_description ?? tokenData.error },
      { status: 400 }
    );
  }

  if (!tokenData.access_token) {
    return NextResponse.json({ status: "pending" });
  }

  const githubToken = tokenData.access_token;

  // Fetch GitHub user profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Assistent/1.0",
    },
  });

  if (!userRes.ok) {
    return NextResponse.json({ status: "error", error: "Failed to fetch user profile" }, { status: 500 });
  }

  const ghUser = await userRes.json() as {
    login: string;
    name: string | null;
    avatar_url: string;
    email: string | null;
  };

  const user: SessionUser = {
    login: ghUser.login,
    name: ghUser.name,
    avatar_url: ghUser.avatar_url,
    email: ghUser.email,
  };

  const sessionValue = makeSessionCookie({ github_token: githubToken, user });

  const response = NextResponse.json({ status: "authorized", user });

  response.cookies.set(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  });

  return response;
}
