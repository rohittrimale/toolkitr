import { NextRequest, NextResponse } from 'next/server';
import { getCredentialsFromRequest } from '@/lib/zos/credentials';
import { executeZosTool } from '@/lib/zos/tool-executor';
import { ZOS_TOOL_NAMES } from '@/lib/zos/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner') || undefined;
  const maxResults = parseInt(searchParams.get('maxResults') || '100');

  const creds = getCredentialsFromRequest();

  try {
    const result = await executeZosTool(
      ZOS_TOOL_NAMES.LIST_JOBS,
      { owner, maxResults },
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jcl, datasetName, member } = body;

    const creds = getCredentialsFromRequest();

    let result;
    if (jcl) {
      result = await executeZosTool(
        ZOS_TOOL_NAMES.SUBMIT_JOB,
        { jcl },
        creds
      );
    } else if (datasetName) {
      result = await executeZosTool(
        ZOS_TOOL_NAMES.SUBMIT_JOB_DATASET,
        { datasetName, member },
        creds
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing jcl or datasetName' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
