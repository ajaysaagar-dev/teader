import { NextResponse } from 'next/server';
import { getAllIssuesDB, createIssueDB } from '@/lib/db';

export async function GET() {
  try {
    const issues = await getAllIssuesDB();
    return NextResponse.json(issues);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const created = await createIssueDB({
      title: body.title,
      description: body.description,
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      project: body.project,
      projectId: body.projectId ? Number(body.projectId) : undefined,
      labels: body.labels,
      subtasks: body.subtasks,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
