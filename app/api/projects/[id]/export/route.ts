import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getProjectByIdDB, getAllIssuesDB, getProjectMembersDB, getPool } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';

const ENCRYPTION_SECRET = process.env.DUMP_ENCRYPTION_SECRET || 'teader_enterprise_secure_vault_2026_master_key';

/**
 * Encrypts data buffer with AES-256-GCM
 */
function encryptProjectBundle(plainText: string): string {
  // Derive 32-byte key from secret
  const key = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  const envelope = {
    magic: 'TEADER_SECURE_DUMP_V2',
    algorithm: 'aes-256-gcm',
    version: '2.0',
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    payload: encrypted,
    checksum: crypto.createHash('sha256').update(plainText).digest('hex'),
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * GET /api/projects/[id]/export
 * Bundles the entire project (tasks, subtasks, docs, members) into an encrypted <ProjectName>.teaderdumpfile
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const projectIdParam = resolvedParams.id;

  try {
    const project = await getProjectByIdDB(projectIdParam);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Fetch all tasks and subtasks for this project
    const allIssues = await getAllIssuesDB();
    const projectIssues = allIssues.filter(
      (i: any) =>
        String(i.projectId) === String(project.id) ||
        String(i.projectId) === String(projectIdParam) ||
        i.project === project.name ||
        String(i.key).toLowerCase().startsWith(`${String(project.key).toLowerCase()}-`)
    );

    // 2. Fetch project documentation
    let projectDocs: any[] = [];
    try {
      const p = getPool();
      const docsRes = await p.query(
        'SELECT * FROM "project_docs" WHERE "projectId" = $1 ORDER BY "updatedAt" DESC',
        [project.id]
      );
      projectDocs = docsRes.rows || [];
    } catch {}

    // 3. Fetch project members
    let projectMembers: any[] = [];
    try {
      projectMembers = await getProjectMembersDB(project.id);
    } catch {}

    // 4. Bundle complete project archive
    const unencryptedBundle = {
      app: 'Teader',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: session.id,
        name: session.name,
        email: session.email,
      },

      project: {
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description || '',
        ownerName: project.ownerName || '',
        createdAt: project.createdAt || new Date().toISOString(),
      },
      statistics: {
        tasksCount: projectIssues.length,
        docsCount: projectDocs.length,
        membersCount: projectMembers.length,
      },
      tasks: projectIssues,
      docs: projectDocs,
      members: projectMembers,
    };

    const plainTextJson = JSON.stringify(unencryptedBundle, null, 2);

    // 5. Encrypt with AES-256-GCM
    const encryptedFileContent = encryptProjectBundle(plainTextJson);

    // 6. Generate filename without spaces: <nameoftheproject>.teaderdumpfile
    const sanitizedProjectName = String(project.name || 'Project')
      .replace(/\s+/g, '') // Remove all spaces
      .replace(/[^a-zA-Z0-9_\-]/g, ''); // Remove unsafe filesystem characters

    const outputFileName = `${sanitizedProjectName || 'Project'}.teaderdumpfile`;

    return new NextResponse(encryptedFileContent, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${outputFileName}"`,
        'X-Teader-File-Name': outputFileName,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Error exporting project dump:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
