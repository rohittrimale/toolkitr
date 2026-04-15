import { NextRequest, NextResponse } from 'next/server';
import { getCredentialsFromRequest } from '@/lib/zos/credentials';
import { executeZosTool } from '@/lib/zos/tool-executor';
import { ZOS_TOOL_NAMES } from '@/lib/zos/tools';
import { readUssFile, writeUssFile, deleteUssFile } from '@/lib/zos/services/uss-service';

// GET /api/zos/uss?path=/path&action=list|read
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '/u/username';
  const action = searchParams.get('action') || 'list';

  const creds = getCredentialsFromRequest();

  try {
    if (action === 'read') {
      const content = await readUssFile(path, creds);
      return NextResponse.json({ success: true, content });
    }

    const result = await executeZosTool(
      ZOS_TOOL_NAMES.LIST_USS_FILES,
      { path },
      creds
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST /api/zos/uss - Write or delete USS file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, content, action } = body;
    const creds = getCredentialsFromRequest();

    if (!path) {
      return NextResponse.json({ success: false, error: 'Missing path' }, { status: 400 });
    }

    if (action === 'delete') {
      await deleteUssFile(path, creds);
      return NextResponse.json({ success: true, message: `Deleted ${path}` });
    }

    if (content === undefined) {
      return NextResponse.json({ success: false, error: 'Missing content' }, { status: 400 });
    }

    await writeUssFile(path, content, creds);
    return NextResponse.json({ success: true, message: `Written to ${path}` });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
