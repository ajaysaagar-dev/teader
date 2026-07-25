import { NextResponse } from 'next/server';
import { updateIssueStatusDB } from '@/lib/db';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    if (body.status) {
      await updateIssueStatusDB(resolvedParams.id, body.status);
    }
    return NextResponse.json({ success: true, id: resolvedParams.id, status: body.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
