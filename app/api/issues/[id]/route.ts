import { NextResponse } from 'next/server';
import { updateIssueStatusDB } from '@/lib/db';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    
    await updateIssueStatusDB(
      resolvedParams.id,
      body.status,
      body.title,
      body.description,
      body.epic,
      body.priority
    );
    
    return NextResponse.json({ 
      success: true, 
      id: resolvedParams.id, 
      status: body.status,
      title: body.title,
      description: body.description,
      epic: body.epic,
      priority: body.priority
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
