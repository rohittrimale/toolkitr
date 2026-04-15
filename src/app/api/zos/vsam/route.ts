import { NextRequest, NextResponse } from 'next/server';
import { getCredentialsFromRequest } from '@/lib/zos/credentials';
import { executeZosTool } from '@/lib/zos/tool-executor';
import { ZOS_TOOL_NAMES } from '@/lib/zos/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pattern = searchParams.get('pattern') || 'YOUR.DATASET.**';

  const creds = getCredentialsFromRequest();

  try {
    const result = await executeZosTool(
      ZOS_TOOL_NAMES.LIST_VSAM_DATASETS,
      { pattern },
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
    const { datasetName, action } = body;

    const creds = getCredentialsFromRequest();

    if (action === 'info') {
      const result = await executeZosTool(
        ZOS_TOOL_NAMES.GET_VSAM_INFO,
        { datasetName },
        creds
      );
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
