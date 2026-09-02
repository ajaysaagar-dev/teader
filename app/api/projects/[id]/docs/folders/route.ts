import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess, assertPermission } from '@/lib/authz';
import { 
  getProjectDocFoldersDB, 
  createProjectDocFolderDB, 
  deleteProjectDocFolderDB, 
  reorderProjectDocFoldersDB,
  getProjectByIdDB 
} from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { logHistory } from '@/lib/history';
import { ReorderDocFoldersSchema, DeleteDocFolderSchema, parseBody } from '@/lib/validation';

/**
 * GET /api/projects/[id]/docs/folders
 * List all doc folders in display order
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
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : (Number(rawProjectId) || rawProjectId);

    await assertProjectAccess(session.id, targetProjId);
    const folders = await getProjectDocFoldersDB(targetProjId);

    return NextResponse.json(folders);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * POST /api/projects/[id]/docs/folders
 * Create or register a new doc folder
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
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : (Number(rawProjectId) || rawProjectId);

    const { allowed } = await assertPermission(session.id, targetProjId, 'can_create_docs');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to create documentation folders.' }, { status: 403 });
    }

    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const orderIndex = body.orderIndex !== undefined ? Number(body.orderIndex) : 0;
    const folder = await createProjectDocFolderDB(targetProjId, name, orderIndex);

    await logHistory({
      projectId: targetProjId,
      projectKey: project?.key,
      userId: session.id,
      userName: session.name || session.email || 'User',
      userAvatar: session.avatar,
      action: 'doc_folder_created',
      entityType: 'doc_folder',
      entityId: String(folder.id || name),
      entityTitle: name,
      details: { folderName: name, orderIndex },
      senderSessionId: session.id,
    });

    broadcastRealtimeEvent({
      type: 'DOC_FOLDER_CREATED',
      projectId: String(targetProjId),
      payload: folder,
      senderSessionId: session.id,
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * PUT /api/projects/[id]/docs/folders
 * Reorder folders by drag-and-drop
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;

  try {
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : (Number(rawProjectId) || rawProjectId);

    await assertProjectAccess(session.id, targetProjId);

    const { data, error } = await parseBody(req, ReorderDocFoldersSchema);
    if (error) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }

    await reorderProjectDocFoldersDB(targetProjId, data.folders);

    broadcastRealtimeEvent({
      type: 'DOC_FOLDERS_REORDERED',
      projectId: String(targetProjId),
      payload: { folders: data.folders },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, folders: data.folders });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * DELETE /api/projects/[id]/docs/folders
 * Delete a doc folder and migrate its documents to 'Start'
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;

  try {
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : (Number(rawProjectId) || rawProjectId);

    const { allowed } = await assertPermission(session.id, targetProjId, 'can_delete_docs');
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete documentation folders.' }, { status: 403 });
    }

    const { data, error } = await parseBody(req, DeleteDocFolderSchema);
    if (error) {
      return NextResponse.json({ error: 'Validation failed', issues: error.issues }, { status: 400 });
    }

    const { folderName, moveToFolder = 'Start' } = data;
    if (folderName.toLowerCase() === 'start') {
      return NextResponse.json({ error: 'Cannot delete the default Start folder' }, { status: 400 });
    }

    const result = await deleteProjectDocFolderDB(targetProjId, folderName, moveToFolder);

    await logHistory({
      projectId: targetProjId,
      projectKey: project?.key,
      userId: session.id,
      userName: session.name || session.email || 'User',
      userAvatar: session.avatar,
      action: 'doc_folder_deleted',
      entityType: 'doc_folder',
      entityId: folderName,
      entityTitle: folderName,
      details: { folderName, moveToFolder, movedDocsCount: result.movedDocsCount },
      senderSessionId: session.id,
    });

    broadcastRealtimeEvent({
      type: 'DOC_FOLDER_DELETED',
      projectId: String(targetProjId),
      payload: { folderName, moveToFolder },
      senderSessionId: session.id,
    });

    return NextResponse.json({ success: true, folderName, moveToFolder, movedDocsCount: result.movedDocsCount });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
