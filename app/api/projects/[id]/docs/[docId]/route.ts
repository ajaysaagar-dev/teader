import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { getProjectDocByIdDB, updateProjectDocDB, deleteProjectDocDB } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'data', 'docs');

function ensureDocsDir() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

/**
 * GET /api/projects/[id]/docs/[docId]
 * Read the actual .md file content from server filesystem / DB
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
    ensureDocsDir();
    const doc = await getProjectDocByIdDB(docId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const localPath = path.join(DOCS_DIR, doc.fileName);
    let content = '';

    // 1. Try reading from local data/docs/<fileName>
    if (fs.existsSync(localPath)) {
      try {
        content = fs.readFileSync(localPath, 'utf-8');
      } catch {}
    }

    // 2. Try doc.filePath if on disk
    if (!content && doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        content = fs.readFileSync(doc.filePath, 'utf-8');
        if (content) {
          fs.writeFileSync(localPath, content, 'utf-8');
        }
      } catch {}
    }

    // 3. Try reading from DB content column
    if (!content && doc.content && typeof doc.content === 'string') {
      content = doc.content;
      try {
        fs.writeFileSync(localPath, content, 'utf-8');
      } catch {}
    }

    // 4. Default fallback if still empty
    if (!content) {
      content = `# ${doc.title}\n\nDocument initialized.`;
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
 * Update the .md file content on the server filesystem and database
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
    ensureDocsDir();
    const doc = await getProjectDocByIdDB(docId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = await req.json();
    const { title, content } = body;
    const localPath = path.join(DOCS_DIR, doc.fileName);

    // 1. Write updated content to server .md file on disk
    if (content !== undefined) {
      try {
        fs.writeFileSync(localPath, content, 'utf-8');
      } catch (e: any) {
        console.warn('Could not write doc to disk:', e.message);
      }
    }

    // 2. Update database record with title, content, and localPath
    await updateProjectDocDB(docId, {
      title: title !== undefined ? title.trim() : undefined,
      content: content !== undefined ? content : undefined,
      filePath: localPath,
    });

    const docUpdatePayload = {
      id: docId,
      projectId: (doc as any).projectId || resolvedParams.id,
      title: title || doc.title,
      fileName: doc.fileName,
      content,
      updatedAt: new Date().toISOString(),
    };

    broadcastRealtimeEvent({
      type: 'DOC_UPDATED',
      projectId: (doc as any).projectId || resolvedParams.id,
      payload: docUpdatePayload,
      senderSessionId: (session as any).id,
    });

    return NextResponse.json({
      success: true,
      id: docId,
      title: title || doc.title,
      fileName: doc.fileName,
      updatedAt: docUpdatePayload.updatedAt,
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
  const { id: projectId, docId } = resolvedParams;

  try {
    ensureDocsDir();
    const doc = await getProjectDocByIdDB(docId);
    if (doc) {
      const localPath = path.join(DOCS_DIR, doc.fileName);
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch {}
      }
      if (doc.filePath && fs.existsSync(doc.filePath) && doc.filePath !== localPath) {
        try {
          fs.unlinkSync(doc.filePath);
        } catch {}
      }
      await deleteProjectDocDB(docId, (doc as any).projectId || projectId);

      broadcastRealtimeEvent({
        type: 'DOC_DELETED',
        projectId: (doc as any).projectId || projectId,
        payload: { id: docId, fileName: doc.fileName },
        senderSessionId: (session as any).id,
      });
    }

    return NextResponse.json({ success: true, id: docId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
