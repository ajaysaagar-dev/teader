import { NextResponse } from 'next/server';
import { getAllProjectsDB, createProjectDB } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let userId = searchParams.get('userId');

    if (!userId) {
      const cookieStore = await cookies();
      const userCookie = cookieStore.get('teader_user');
      if (userCookie && userCookie.value) {
        try {
          const parsed = JSON.parse(userCookie.value);
          if (parsed && parsed.id) {
            userId = String(parsed.id);
          }
        } catch {}
      }
    }

    const projects = await getAllProjectsDB(userId ? Number(userId) : undefined);
    return NextResponse.json(projects);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.key) {
      return NextResponse.json({ error: 'Project Name and Key are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userCookie = cookieStore.get('teader_user');
    let owner_id = body.owner_id || body.creatorId;
    let ownerName = body.ownerName;

    if (userCookie && userCookie.value) {
      try {
        const parsed = JSON.parse(userCookie.value);
        if (parsed && parsed.id) {
          owner_id = parsed.id;
          ownerName = parsed.name;
        }
      } catch {}
    }

    const keyUpper = body.key.trim().toUpperCase();
    const existingProjects = await getAllProjectsDB();
    const isDuplicate = existingProjects.some((p: any) => p.key.toUpperCase() === keyUpper);

    if (isDuplicate) {
      return NextResponse.json(
        { error: `Project Key '${keyUpper}' is already taken. Please use a unique key.` },
        { status: 400 }
      );
    }

    const created = await createProjectDB({
      key: keyUpper,
      name: body.name,
      description: body.description,
      owner_id,
      creatorId: owner_id,
      ownerName,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
