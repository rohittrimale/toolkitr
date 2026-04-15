import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/core/db';

const TEST_MODE = process.env.NODE_ENV === 'development';

async function getTestUserId(): Promise<string> {
  let testUser = await prisma.user.findUnique({
    where: { email: 'test@local' }
  });
  
  if (!testUser) {
    const maxUser = await prisma.user.findFirst({
      orderBy: { github_id: 'desc' }
    });
    const nextId = (maxUser?.github_id || 0) + 1;
    
    testUser = await prisma.user.create({
      data: {
        github_id: nextId,
        email: 'test@local',
        name: 'Test User',
        role: 'USER',
      }
    });
  }
  return testUser.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = TEST_MODE ? await getTestUserId() : null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = params.id;
    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('[conversation] PATCH parse error:', parseErr);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { title } = body;

    const conversation = await prisma.conversation.update({
      where: { id: conversationId, user_id: userId },
      data: { title },
    });

    return NextResponse.json({ conversation });
  } catch (err) {
    console.error('[conversation] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// PUT - same as PATCH for backward compatibility
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = TEST_MODE ? await getTestUserId() : null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = params.id;
    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('[conversation] PUT parse error:', parseErr);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { title } = body;

    const conversation = await prisma.conversation.update({
      where: { id: conversationId, user_id: userId },
      data: { title },
    });

    return NextResponse.json({ conversation });
  } catch (err) {
    console.error('[conversation] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = TEST_MODE ? await getTestUserId() : null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = params.id;

    await prisma.conversation.delete({
      where: { id: conversationId, user_id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[conversation] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
