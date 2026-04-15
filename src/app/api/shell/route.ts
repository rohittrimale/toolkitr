import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      command: string;
      shell?: string;
      timeout?: number;
    };

    const { command, shell = "bash", timeout = 30 } = body;

    if (!command) {
      return NextResponse.json({ error: "Missing command" }, { status: 400 });
    }

    // Safety: block dangerous commands
    const blocked = ["rm -rf /", "format", "del /s /q", "shutdown", "reboot"];
    if (blocked.some(b => command.toLowerCase().includes(b))) {
      return NextResponse.json({ error: "Command blocked for safety" }, { status: 403 });
    }

    const shellCmd = shell === "powershell"
      ? `powershell -Command "${command.replace(/"/g, '\\"')}"`
      : command;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(NextResponse.json({
          stdout: "",
          stderr: "Command timed out",
          exitCode: 124,
        }));
      }, timeout * 1000);

      exec(shellCmd, { timeout: timeout * 1000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        clearTimeout(timer);
        resolve(NextResponse.json({
          stdout: stdout || "",
          stderr: stderr || "",
          exitCode: error?.code ?? 0,
        }));
      });
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
