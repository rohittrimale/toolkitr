import { NextRequest, NextResponse } from 'next/server';
import { getCredentialsFromRequest } from '@/lib/zos/credentials';
import { executeZosTool } from '@/lib/zos/tool-executor';
import { ZOS_TOOL_NAMES } from '@/lib/zos/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'users';
  const pattern = searchParams.get('pattern') || 'YOUR*';

  const creds = getCredentialsFromRequest();

  try {
    let result;

    switch (type) {
      case 'users':
        result = await executeZosTool(ZOS_TOOL_NAMES.LIST_RACF_USERS, { pattern }, creds);
        break;
      case 'groups':
        result = await executeZosTool(ZOS_TOOL_NAMES.LIST_RACF_GROUPS, { pattern }, creds);
        break;
      case 'datasets':
        result = await executeZosTool(ZOS_TOOL_NAMES.LIST_RACF_DATASETS, { pattern }, creds);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}` },
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
