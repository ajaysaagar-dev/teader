import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { getProjectDocsDB, createProjectDocDB, getProjectByIdDB } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.join(process.cwd(), 'data', 'docs');

function ensureDocsDir() {
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

/**
 * GET /api/projects/[id]/docs
 * List all markdown docs for a project
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
    let docs = await getProjectDocsDB(projectId);

    // If no docs exist yet for this project, auto-seed the default README / Architecture spec file
    if (docs.length === 0) {
      const project = await getProjectByIdDB(projectId);
      const projectName = project?.name || 'Project Workspace';
      const projectKey = project?.key || 'PRJ';
      const docId = `doc_${Date.now()}_init`;
      const fileName = `proj_${projectId}_usr_${(session as any).id || 1}_${docId}_architecture_specs.md`;
      const filePath = path.join(DOCS_DIR, fileName);

      const initialContent = `# ${projectName} — Architecture & Technical Specifications

## 1. Overview & System Goals
This document serves as the single source of truth for **${projectName}** (${projectKey}).
All architectural decisions, schema conventions, and milestone deliverables are maintained here.

---

## 2. Core Architecture
- **Framework**: Next.js 16 (App Router + Turbopack)
- **State & Real-time**: React 19 Client Components with Optimistic UI updates
- **Database Layer**: MySQL 8.0 Connection Pooling with high-availability in-memory fallback
- **Authentication**: JWT HttpOnly Cookies + Role-Based Access Control

---

## 3. Workflow & Branching Conventions
- Feature Branches: \`feat/${projectKey.toLowerCase()}-<id>-<name>\`
- Fix Branches: \`fix/${projectKey.toLowerCase()}-<id>-<name>\`
- Commit Message Convention: \`feat(scope): detailed message\`

---

## 4. Key Milestones & Epics
1. **MVP Launch**: Core issue tracker & Kanban board
2. **Phase 2**: Dependency DAG graph & real-time time tracking
3. **Phase 3**: Automation rules engine & cross-project "My Work" dashboard
`;

      fs.writeFileSync(filePath, initialContent, 'utf-8');

      const created = await createProjectDocDB({
        id: docId,
        projectId,
        userId: (session as any).id || 1,
        userName: (session as any).name || 'karri',
        title: 'Architecture & Technical Specifications',
        fileName,
        filePath,
      });

      docs = [created];
    }

    return NextResponse.json(docs);
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
    });

    return NextResponse.json({ ...createdRecord, content: initialContent }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
