/**
 * GET /api/auth/callback
 * GitHub OAuth callback — exchanges code for GitHub access token,
 * fetches user profile, creates/updates User record, and sets encrypted session cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/core/db";
import { makeSessionCookie, SESSION_COOKIE_NAME, type SessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = req.nextUrl;

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // Verify state to prevent CSRF
  const storedState = req.cookies.get("gh_oauth_state")?.value;
  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/?error=oauth_state_mismatch`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?error=not_configured`);
  }

  // Exchange code → GitHub access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${appUrl}/api/auth/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/?error=token_exchange_failed`);
  }

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(tokenData.error ?? "no_token")}`);
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
    return NextResponse.redirect(`${appUrl}/?error=user_fetch_failed`);
  }

  const ghUser = await userRes.json() as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
    email: string | null;
  };

  // Create or update User in database
  await prisma.user.upsert({
    where: { github_id: ghUser.id },
    update: {
      name: ghUser.name,
      avatar_url: ghUser.avatar_url,
      ...(ghUser.email && { email: ghUser.email }),
    },
    create: {
      github_id: ghUser.id,
      email: ghUser.email || `user-${ghUser.id}@github.local`,
      name: ghUser.name,
      avatar_url: ghUser.avatar_url,
    },
  });

  const user: SessionUser = {
    login: ghUser.login,
    name: ghUser.name,
    avatar_url: ghUser.avatar_url,
    email: ghUser.email,
  };

  const sessionValue = makeSessionCookie({ github_token: githubToken, user });

  const response = NextResponse.redirect(`${appUrl}/`);

  // Clear the state cookie
  response.cookies.set("gh_oauth_state", "", { maxAge: 0, path: "/" });

  // Set encrypted session cookie (httpOnly, not accessible from JS)
  response.cookies.set(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  });

  return response;
}
