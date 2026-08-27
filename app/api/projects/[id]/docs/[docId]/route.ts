import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { getProjectDocByIdDB, updateProjectDocDB, deleteProjectDocDB } from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/projects/[id]/docs/[docId]
 * Read the .md file content from server filesystem
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { docId } = resolvedParams;

  try {
    const doc = await getProjectDocByIdDB(docId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    let content = '';
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      content = fs.readFileSync(doc.filePath, 'utf-8');
    } else {
      content = `# ${doc.title}\n\nDocument file initialized.`;
    }

    return NextResponse.json({
      ...doc,
      content,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]/docs/[docId]
 * Update the .md file content on the server filesystem
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { docId } = resolvedParams;

  try {
    const doc = await getProjectDocByIdDB(docId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = await req.json();
    const { title, content } = body;

    // Write updated content to server .md file
    if (content !== undefined && doc.filePath) {
      const dir = path.dirname(doc.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(doc.filePath, content, 'utf-8');
    }

    if (title !== undefined && title.trim()) {
      await updateProjectDocDB(docId, { title: title.trim() });
    }

    return NextResponse.json({
      success: true,
      id: docId,
      title: title || doc.title,
      fileName: doc.fileName,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/docs/[docId]
 * Delete the .md file from the server filesystem and database
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { docId } = resolvedParams;

  try {
    const doc = await getProjectDocByIdDB(docId);
    if (doc) {
      if (doc.filePath && fs.existsSync(doc.filePath)) {
        try {
          fs.unlinkSync(doc.filePath);
        } catch {}
      }
      await deleteProjectDocDB(docId);
    }

    return NextResponse.json({ success: true, id: docId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
