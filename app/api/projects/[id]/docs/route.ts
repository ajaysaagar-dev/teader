import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { getProjectDocsDB, createProjectDocDB, updateProjectDocDB, getProjectByIdDB } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
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
  const rawProjectId = resolvedParams.id;

  try {
    ensureDocsDir();
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : (Number(rawProjectId) || rawProjectId);
    const projName = project?.name || 'Project Workspace';

    // Verify the user is a member of this project
    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    let docs = await getProjectDocsDB(targetProjId);

    // Also scan DOCS_DIR to recover any files on disk matching this project
    try {
      const diskFiles = fs.readdirSync(DOCS_DIR);
      const prefix1 = `proj_${targetProjId}_`;
      const prefix2 = `proj_${rawProjectId}_`;

      for (const fName of diskFiles) {
        if (fName.endsWith('.md') && (fName.startsWith(prefix1) || fName.startsWith(prefix2))) {
          const alreadyTracked = docs.some((d: any) => d.fileName === fName);
          if (!alreadyTracked) {
            const diskPath = path.join(DOCS_DIR, fName);
            let diskContent = '';
            try {
              diskContent = fs.readFileSync(diskPath, 'utf-8');
            } catch {}

            // Extract title from filename or first line
            const titleMatch = diskContent.match(/^#\s+(.+)$/m);
            const extractedTitle = titleMatch
              ? titleMatch[1].trim()
              : fName.replace(/^proj_[^_]+_usr_[^_]+_doc_[^_]+_/, '').replace(/\.md$/, '').replace(/_/g, ' ');

            const recoveredDoc = await createProjectDocDB({
              id: `doc_rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              projectId: targetProjId,
              userId: (session as any).id || 1,
              userName: (session as any).name || 'karri',
              title: extractedTitle || 'Document',
              fileName: fName,
              filePath: diskPath,
              content: diskContent,
            });

            docs.unshift(recoveredDoc);
          }
        }
      }
    } catch {}

    // If still 0 docs, create the default starter documentation file so it is never empty
    if (docs.length === 0) {
      const defaultTitle = `${projName} Architecture & Overview`;
      const initialContent = `# ${defaultTitle}\n\nTechnical specification and architecture documentation for **${projName}**.\n\n## 1. Overview\nComprehensive system architecture and component specifications.\n\n## 2. Architecture & Components\n- Core API routing and validation\n- State synchronization and realtime updates\n- Interactive markdown documentation engine\n\n## 3. Implementation Steps\n- [x] Initialize project workspace\n- [x] Configure database schemas\n- [ ] Implement team workflows\n\n\`\`\`ts\n// Example configuration\nexport const config = {\n  project: '${projName}',\n  version: '1.0.0',\n  mode: 'production'\n};\n\`\`\`\n`;
      const docId = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const userId = (session as any).id || 1;
      const userName = (session as any).name || 'karri';
      const cleanSlug = 'architecture_and_overview';
      const fileName = `proj_${targetProjId}_usr_${userId}_${docId}_${cleanSlug}.md`;
      const filePath = path.join(DOCS_DIR, fileName);

      try {
        fs.writeFileSync(filePath, initialContent, 'utf-8');
      } catch {}

      const created = await createProjectDocDB({
        id: docId,
        projectId: targetProjId,
        userId,
        userName,
        title: defaultTitle,
        fileName,
        filePath,
        content: initialContent,
      });

      docs = [created];
    }

    // Resolve actual content for each document
    const populatedDocs = docs.map((doc: any) => {
      const content = resolveDiskContent(doc);
      return {
        ...doc,
        folder: doc.folder && doc.folder.trim() ? doc.folder.trim() : 'Start',
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
  const rawProjectId = resolvedParams.id;

  try {
    ensureDocsDir();
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : (Number(rawProjectId) || rawProjectId);

    // Verify the user is a member of this project
    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    const body = await req.json();
    const title = (body.title || 'Untitled Document').trim();
    const folder = (body.folder || 'Start').trim();
    const initialContent = body.content || `# ${title}\n\nStart writing documentation here...`;

    const cleanSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 32);

    const docId = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const userId = (session as any).id || 1;
    const userName = (session as any).name || 'karri';
    const fileName = `proj_${targetProjId}_usr_${userId}_${docId}_${cleanSlug || 'doc'}.md`;
    const filePath = path.join(DOCS_DIR, fileName);

    // Write .md file to server filesystem
    fs.writeFileSync(filePath, initialContent, 'utf-8');

    const createdRecord = await createProjectDocDB({
      id: docId,
      projectId: targetProjId,
      userId,
      userName,
      title,
      fileName,
      filePath,
      folder,
      content: initialContent,
    });

    const docPayload = { ...createdRecord, folder, content: initialContent };

    broadcastRealtimeEvent({
      type: 'DOC_CREATED',
      projectId: String(targetProjId),
      payload: docPayload,
      senderSessionId: (session as any).id,
    });

    return NextResponse.json(docPayload, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
