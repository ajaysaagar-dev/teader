import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { getProjectDocsDB, createProjectDocDB, updateProjectDocDB, getProjectByIdDB } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'data', 'docs');

function ensureDocsDir() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

function resolveDiskContent(doc: any): string {
  ensureDocsDir();
  const localPath = path.join(DOCS_DIR, doc.fileName);

  // 1. Check local file in data/docs/<fileName>
  if (fs.existsSync(localPath)) {
    try {
      const content = fs.readFileSync(localPath, 'utf-8');
      if (content && content.trim()) return content;
    } catch {}
  }

  // 2. Check doc.filePath if valid path on host
  if (doc.filePath && fs.existsSync(doc.filePath)) {
    try {
      const content = fs.readFileSync(doc.filePath, 'utf-8');
      if (content && content.trim()) {
        // Also ensure local copy in DOCS_DIR
        try {
          fs.writeFileSync(localPath, content, 'utf-8');
        } catch {}
        return content;
      }
    } catch {}
  }

  // 3. Check DB stored content
  if (doc.content && typeof doc.content === 'string' && doc.content.trim()) {
    try {
      fs.writeFileSync(localPath, doc.content, 'utf-8');
    } catch {}
    return doc.content;
  }

  // 4. Fallback default
  return `# ${doc.title || 'Document'}\n\nTechnical specification and documentation.`;
}

/**
 * GET /api/projects/[id]/docs
 * List all markdown docs for a project with actual content
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    ensureDocsDir();
    const docs = await getProjectDocsDB(projectId);

    // Resolve actual content for each document
    const populatedDocs = docs.map((doc: any) => {
      const content = resolveDiskContent(doc);
      return {
        ...doc,
        content,
      };
    });

    return NextResponse.json(populatedDocs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/docs
 * Create a new unique .md file on the server
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    ensureDocsDir();
    const body = await req.json();
    const title = (body.title || 'Untitled Document').trim();
    const initialContent = body.content || `# ${title}\n\nStart writing documentation here...`;

    const cleanSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 32);

    const docId = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const userId = (session as any).id || 1;
    const userName = (session as any).name || 'karri';
    const fileName = `proj_${projectId}_usr_${userId}_${docId}_${cleanSlug || 'doc'}.md`;
    const filePath = path.join(DOCS_DIR, fileName);

    // Write .md file to server filesystem
    fs.writeFileSync(filePath, initialContent, 'utf-8');

    const createdRecord = await createProjectDocDB({
      id: docId,
      projectId,
      userId,
      userName,
      title,
      fileName,
      filePath,
      content: initialContent,
    });

    return NextResponse.json({ ...createdRecord, content: initialContent }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
