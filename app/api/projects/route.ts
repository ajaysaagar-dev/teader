import { NextResponse } from 'next/server';
import { getAllProjectsDB, createProjectDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import { parseBody, CreateProjectSchema } from '@/lib/validation';

export async function GET(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const projects = await getAllProjectsDB(session.id);
    return NextResponse.json(projects);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await parseBody(req, CreateProjectSchema);
  if (error) {
    return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
  }

  const owner_id = session.id;
  const ownerName = session.name;

  const keyUpper = (data.key || '').trim().toUpperCase() || undefined;

  if (keyUpper) {
    const existingProjects = await getAllProjectsDB();
    const isDuplicate = (existingProjects as any[]).some((p: any) => p.key.toUpperCase() === keyUpper);
    if (isDuplicate) {
      return NextResponse.json(
        { error: `Project Key '${keyUpper}' is already taken. Please use a unique key.` },
        { status: 400 }
      );
    }
  }

  try {
    const created = await createProjectDB({
      key: keyUpper,
      name: data.name,
      description: data.description,
      owner_id,
      creatorId: owner_id,
      ownerName,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
