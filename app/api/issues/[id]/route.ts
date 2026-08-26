import { NextResponse } from 'next/server';
import { updateIssueStatusDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { parseBody, UpdateIssueSchema } from '@/lib/validation';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { data, error } = await parseBody(req, UpdateIssueSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  try {
    await updateIssueStatusDB(
      resolvedParams.id,
      data.status,
      data.title,
      data.description,
      data.epic,
      data.priority
    );

    return NextResponse.json({
      success: true,
      id: resolvedParams.id,
      ...data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
