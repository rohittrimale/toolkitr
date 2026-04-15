import { NextRequest, NextResponse } from "next/server";

// MCP tools endpoint — exposes our tools via MCP-compatible HTTP API
// Other AI tools (Claude Desktop, Cursor) can connect to this

// Store for MCP server configs
const mcpServers: Array<{
  name: string;
  url: string;
  enabled: boolean;
}> = [];

export async function GET() {
  // List available tools in MCP format
  const { toolRegistry } = await import("@/lib/tools/registry");
  const tools = toolRegistry.list();

  return NextResponse.json({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: "object",
        properties: Object.fromEntries(
          t.parameters.map(p => [p.name, {
            type: p.type,
            description: p.description,
            ...(p.enum ? { enum: p.enum } : {}),
          }])
        ),
        required: t.parameters.filter(p => p.required).map(p => p.name),
      },
    })),
  });
}

export async function POST(req: NextRequest) {
  // Execute a tool
  try {
    const body = await req.json() as { name: string; arguments?: Record<string, unknown> };
    const { toolRegistry } = await import("@/lib/tools/registry");
    const result = await toolRegistry.execute(body.name, body.arguments || {});

    return NextResponse.json({
      content: [{ type: "text", text: result.content }],
      isError: !result.success,
    });
  } catch (err) {
    return NextResponse.json({
      content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    });
  }
}
