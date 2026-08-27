import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { leaveProjectDB } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await leaveProjectDB(session.id, projectId);

    return NextResponse.json({ success: true, message: 'Left project successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to leave project' },
      { status: 500 }
    );
  }
}
