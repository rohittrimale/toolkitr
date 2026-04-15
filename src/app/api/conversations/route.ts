import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/core/db';
import { getSession } from '@/lib/auth/session';

/**
 * Get user ID from the session. Returns null if not authenticated.
 */
async function resolveUserId(): Promise<string | null> {
  const session = await getSession();

  if (!session?.user?.login) {
    return null;
  }

  // Find or create user by GitHub login
  const dbUser = await prisma.user.findFirst({
    where: { email: { contains: session.user.login } },
  });
  if (dbUser) return dbUser.id;

  // Create user record if not found
  const newUser = await prisma.user.create({
    data: {
      github_id: Date.now(),
      email: session.user.email || `${session.user.login}@github.local`,
      name: session.user.name,
      avatar_url: session.user.avatar_url,
    },
  });
  return newUser.id;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const conversations = await prisma.conversation.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
      include: {
        messages: {
          select: { id: true },
        }
      }
    });

    const formatted = conversations.map(c => ({
      id: c.id,
      title: c.title,
      mode: c.mode,
      created_at: c.created_at,
      updated_at: c.updated_at,
      message_count: c.messages.length,
    }));

    return NextResponse.json({ conversations: formatted });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[conversations] GET error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to fetch conversations', details: errorMsg },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, mode = 'Ask' } = body;

    const conversation = await prisma.conversation.create({
      data: {
        user_id: userId,
        title: title || 'New Conversation',
        mode: mode as any,
      }
    });

    return NextResponse.json({ conversation });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[conversations] POST error:', errorMsg);
    return NextResponse.json(
      { error: 'Failed to create conversation', details: errorMsg },
      { status: 500 }
    );
  }
}
