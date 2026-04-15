import { NextRequest, NextResponse } from 'next/server';
import { getCredentialsFromRequest } from '@/lib/zos/credentials';
import { executeZosTool } from '@/lib/zos/tool-executor';
import { ZOS_TOOL_NAMES } from '@/lib/zos/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pattern = searchParams.get('pattern') || 'YOUR.DATASET.*';
  const maxResults = parseInt(searchParams.get('maxResults') || '1000');

  const creds = getCredentialsFromRequest();

  try {
    const result = await executeZosTool(
      ZOS_TOOL_NAMES.LIST_DATASETS,
      { pattern, maxResults },
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
