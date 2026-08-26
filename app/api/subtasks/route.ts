import { NextResponse } from 'next/server';
import { addSubtaskDB, updateSubtaskDB, toggleSubtaskDB, deleteSubtaskDB } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.issueId || !body.title) {
      return NextResponse.json({ error: 'issueId and title are required' }, { status: 400 });
    }

    const subtask = await addSubtaskDB(
      body.issueId,
      body.title,
      body.parentId || null,
      Boolean(body.isFolder),
      body.type || (body.isFolder ? 'folder' : 'subtask')
    );
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

    await updateSubtaskDB(body.subId, {
      title: body.title,
      completed: body.completed,
      parentId: body.parentId !== undefined ? body.parentId : undefined,
      issueId: body.issueId,
    });

    return NextResponse.json({ 
      success: true, 
      subId: body.subId, 
      completed: body.completed,
      title: body.title,
      parentId: body.parentId,
      issueId: body.issueId
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subId = searchParams.get('id') || (await req.json().catch(() => ({})))?.subId;
    if (!subId) {
      return NextResponse.json({ error: 'subId or id is required' }, { status: 400 });
    }

    await deleteSubtaskDB(subId);
    return NextResponse.json({ success: true, subId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
