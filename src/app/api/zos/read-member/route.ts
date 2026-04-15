import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/auth/rate-limit-middleware";
import { exec } from "@/lib/zos/ssh-pool";
import type { ZosCredentials } from "@/lib/zos/credentials";

export const dynamic = "force-dynamic";

interface ReadMemberRequest {
  datasetName: string;
  member?: string;
  credentials: {
    sshHost: string;
    sshPort?: number;
    userId: string;
    password: string;
  };
}

export async function POST(req: NextRequest) {
  // ─── RATE LIMITING: Enforce API limits ───────────────────────────────────
  const rateLimitResult = await enforceRateLimit(req);
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  console.log('[Z/OS Read Member] POST handler called');
  
  try {
    const body = (await req.json()) as ReadMemberRequest;
    const { datasetName, member, credentials } = body;

    if (!datasetName) {
      return NextResponse.json(
        { error: "Missing datasetName parameter" },
        { status: 400 }
      );
    }

    if (!credentials?.sshHost || !credentials?.userId) {
      return NextResponse.json(
        { error: "Missing SSH credentials (sshHost, userId required)" },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const dsn = datasetName.toUpperCase().replace(/['"]/g, '').trim();
    const mem = member ? member.toUpperCase().replace(/[^A-Z0-9@#$]/g, '').substring(0, 8) : null;

    console.log('[Z/OS Read Member] Parameters:', { dsn, mem, host: credentials.sshHost });

    // Use direct cat command to read MVS dataset/member
    // Format: cat "//'DATASET(MEMBER)'" or cat "//'DATASET'"
    const memberSpec = mem ? `${dsn}(${mem})` : dsn;
    const command = `cat "//'${memberSpec}'"`;
    
    console.log('[Z/OS Read Member] Executing command:', command);

    const result = await exec(credentials as ZosCredentials, command, 60000);

    console.log('[Z/OS Read Member] Execution result:', {
      exitCode: result.exitCode,
      stdoutLength: result.stdout?.length || 0,
      hasError: !!result.stderr
    });

    if (result.exitCode !== 0 || result.stdout.includes('NOT FOUND') || result.stdout.includes('ERROR')) {
      return NextResponse.json(
        {
          success: false,
          error: "Member not found or read failed",
          details: result.stderr || result.stdout || "No output",
          raw: {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr
          }
        },
        { status: 400 }
      );
    }

    const finalContent = result.stdout.trim();

    return NextResponse.json({
      success: true,
      datasetName: dsn,
      member: mem,
      content: finalContent,
      lineCount: finalContent.split('\n').length,
      byteCount: Buffer.byteLength(finalContent, 'utf8')
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Z/OS Read Member] Error:', errorMsg);
    
    return NextResponse.json(
      { 
        error: "Failed to read member",
        details: errorMsg
      },
      { status: 500 }
    );
  }
}
