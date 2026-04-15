import { NextRequest, NextResponse } from 'next/server';
import { getCredentialsFromRequest } from '@/lib/zos/credentials';
import { executeZosTool } from '@/lib/zos/tool-executor';
import { ZOS_TOOL_NAMES } from '@/lib/zos/tools';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';
  const host = searchParams.get('host');
  const count = parseInt(searchParams.get('count') || '4');

  const creds = getCredentialsFromRequest();

  try {
    let result;

    switch (action) {
      case 'status':
        result = await executeZosTool(ZOS_TOOL_NAMES.GET_TCPIP_STATUS, {}, creds);
        break;
      case 'connections':
        result = await executeZosTool(ZOS_TOOL_NAMES.LIST_TCP_CONNECTIONS, {}, creds);
        break;
      case 'ping':
        if (!host) {
          return NextResponse.json(
            { success: false, error: 'Missing host parameter' },
            { status: 400 }
          );
        }
        result = await executeZosTool(ZOS_TOOL_NAMES.PING_HOST, { host, count }, creds);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
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
