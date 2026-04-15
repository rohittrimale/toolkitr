import { NextRequest, NextResponse } from "next/server";

// MCP server configuration — stored in memory (would be in DB for production)
const mcpServers: Array<{
  name: string;
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
}> = [
  // Example MCP servers (disabled by default)
  { name: "filesystem", type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", process.env.FILE_DOWNLOAD_PATH || "/tmp"], enabled: false },
  { name: "memory", type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"], enabled: false },
  { name: "brave-search", type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"], enabled: false },
];

export async function GET() {
  return NextResponse.json({ servers: mcpServers });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string;
      type: "stdio" | "http";
      command?: string;
      args?: string[];
      url?: string;
      enabled?: boolean;
    };

    const existing = mcpServers.findIndex(s => s.name === body.name);
    const server = {
      name: body.name,
      type: body.type,
      command: body.command,
      args: body.args,
      url: body.url,
      enabled: body.enabled ?? true,
    };

    if (existing >= 0) {
      mcpServers[existing] = server;
    } else {
      mcpServers.push(server);
    }

    return NextResponse.json({ success: true, server });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("name");
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const idx = mcpServers.findIndex(s => s.name === name);
    if (idx >= 0) mcpServers.splice(idx, 1);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
