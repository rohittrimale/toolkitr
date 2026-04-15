/**
 * POST /api/auth/device/start
 * Initiates GitHub Device Flow using VS Code's OAuth client ID.
 * VS Code client ID is pre-authorized for copilot_internal/v2/token.
 * Returns { user_code, verification_uri, device_code, interval, expires_in }
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// VS Code's GitHub OAuth app client ID — same one the VS Code extension uses.
// This is required because copilot_internal/v2/token only accepts tokens
// obtained through approved OAuth apps (VS Code's being one of them).
const VSCODE_CLIENT_ID = "01ab8ac9400c4e429b23";

export async function POST() {
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: VSCODE_CLIENT_ID,
      scope: "read:user",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { error: `Device code request failed: ${body}` },
      { status: res.status }
    );
  }

  const data = await res.json() as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  return NextResponse.json(data);
}
