import { NextResponse } from 'next/server';
import { addSubtaskDB, toggleSubtaskDB } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.issueId || !body.title) {
      return NextResponse.json({ error: 'issueId and title are required' }, { status: 400 });
    }

    const subtask = await addSubtaskDB(body.issueId, body.title);
    return NextResponse.json(subtask, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (!body.subId) {
      return NextResponse.json({ error: 'subId is required' }, { status: 400 });
    }

    await toggleSubtaskDB(body.subId, Boolean(body.completed));
    return NextResponse.json({ success: true, subId: body.subId, completed: body.completed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
