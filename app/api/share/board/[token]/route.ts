import { NextResponse } from 'next/server';
import { getBoardShareByTokenDB } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  try {
    const result = await getBoardShareByTokenDB(token);
    if (!result) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    const { share, board } = result;

    // Check expiry
    if (share.expiresAt) {
      const expiryDate = new Date(share.expiresAt);
      if (expiryDate.getTime() < Date.now()) {
        return NextResponse.json({ error: 'This shared link has expired' }, { status: 410 });
      }
    }

    return NextResponse.json({
      board: {
        id: board.id,
        title: board.title,
        data: board.data,
      },
      share: {
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/share/board/[token] error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
