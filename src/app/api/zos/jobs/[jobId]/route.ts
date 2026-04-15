import { NextRequest, NextResponse } from "next/server";
import { getCredentialsFromRequest } from "@/lib/zos/credentials";
import { exec } from "@/lib/zos/ssh-pool";
import { zosCache, CacheService } from "@/lib/zos/cache";

// GET /api/zos/jobs/[jobId] - Get job status
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const creds = getCredentialsFromRequest();

    // Check cache
    const cacheKey = CacheService.keyJob(creds.userId, creds.sshHost, creds.sshPort, jobId);
    const cached = zosCache.get(cacheKey);
    if (cached) return NextResponse.json({ success: true, job: cached });

    const command = `tsocmd "STATUS ${jobId}" 2>&1`;
    const result = await exec(creds, command, 30000);

    if (result.exitCode !== 0) {
      return NextResponse.json(
        { success: false, error: result.stdout || `Failed to get job ${jobId}` },
        { status: 404 }
      );
    }

    // Parse job info from SDSF output
    const lines = result.stdout.split("\n");
    const job: Record<string, string> = { jobId };

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
      if (match) {
        job.jobName = match[2];
        job.status = match[3];
        job.owner = match[4];
      }
      if (line.includes("RC=")) {
        const rcMatch = line.match(/RC=(\S+)/);
        if (rcMatch) job.rc = rcMatch[1];
      }
    }

    // Cache result
    zosCache.set(cacheKey, job, 30);

    return NextResponse.json({ success: true, job });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

// DELETE /api/zos/jobs/[jobId] - Cancel job
export async function DELETE(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const creds = getCredentialsFromRequest();

    const command = `tsocmd "CANCEL ${jobId}" 2>&1`;
    const result = await exec(creds, command, 30000);

    if (result.exitCode !== 0 && !result.stdout.includes("IEE301I")) {
      return NextResponse.json(
        { success: false, error: result.stdout || "Failed to cancel job" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: `Job ${jobId} cancelled` });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

// POST /api/zos/jobs/[jobId] - Hold/Release job
export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    const body = await req.json();
    const action = body.action as string; // "hold" | "release" | "spool"
    const creds = getCredentialsFromRequest();

    if (action === "spool") {
      // Get spool output
      const command = `tsocmd "OUTPUT ${jobId}" 2>&1`;
      const result = await exec(creds, command, 30000);

      if (result.exitCode !== 0) {
        return NextResponse.json(
          { success: false, error: result.stdout || "Failed to get spool" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, spool: result.stdout.split("\n") });
    }

    const command = `tsocmd "${action?.toUpperCase()} ${jobId}" 2>&1`;
    const result = await exec(creds, command, 30000);

    if (result.exitCode !== 0) {
      return NextResponse.json(
        { success: false, error: result.stdout || `Failed to ${action} job` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: `Job ${jobId} ${action}ed` });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
