/**
 * GET /api/auth/me
 * Returns the current signed-in user (from session cookie), or 401.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCopilotUserInfo } from "@/lib/auth/copilot-token";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Optionally enrich with Copilot plan info
  const copilotInfo = await getCopilotUserInfo(session.github_token);

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    copilot_plan: copilotInfo?.copilot_plan ?? null,
  });
}
