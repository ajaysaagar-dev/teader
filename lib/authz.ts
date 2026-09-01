import { getPool, initDB, getMemberPermissionsDB } from './db';
import { MemberPermissions } from './types';

/**
 * Authorization helper — verifies a user is a member of the given project.
 * Checks project_members table, plus owner_id / creatorId on the projects table.
 *
 * Throws a 403-style error if the user is not a member.
 * Returns the user's role ('owner' | 'admin' | 'member') if authorized.
 */
export async function assertProjectAccess(
  userId: number | string,
  projectId: number | string
): Promise<string> {
  await initDB();
  const numUserId = Number(userId);
  const numProjId = Number(projectId);

  if (isNaN(numUserId) || isNaN(numProjId)) {
    throw Object.assign(new Error('Invalid user or project ID'), { status: 400 });
  }

  const p = getPool();

  // Check if user is the project owner/creator
  const ownerCheck = await p.query(
    `SELECT "id" FROM "projects" WHERE "id" = $1 AND ("owner_id" = $2 OR "creatorId" = $2) LIMIT 1`,
    [numProjId, numUserId]
  );
  if (ownerCheck.rows?.length > 0) {
    return 'owner';
  }

  // Check project_members table
  const memberCheck = await p.query(
    `SELECT "role" FROM "project_members" WHERE "projectId" = $1 AND "userId" = $2 LIMIT 1`,
    [numProjId, numUserId]
  );
  if (memberCheck.rows?.length > 0) {
    return memberCheck.rows[0].role || 'member';
  }

  throw Object.assign(
    new Error('Forbidden: you are not a member of this project'),
    { status: 403 }
  );
}

/**
 * Check if a user has a specific granular permission in a project.
 * Returns { role, allowed, permissions }.
 */
export async function assertPermission(
  userId: number | string,
  projectId: number | string,
  permission: keyof MemberPermissions
): Promise<{ role: string; allowed: boolean; permissions: MemberPermissions }> {
  const role = await assertProjectAccess(userId, projectId);
  const permissions = await getMemberPermissionsDB(projectId, userId);

  if (role === 'owner' || role === 'admin') {
    return { role, allowed: true, permissions };
  }

  const allowed = Boolean(permissions[permission]);
  return { role, allowed, permissions };
}

/**
 * Look up which project an issue belongs to, then assert the user has access.
 * Returns { projectId, role }.
 */
export async function assertIssueAccess(
  userId: number | string,
  issueId: string
): Promise<{ projectId: number; role: string }> {
  await initDB();
  const p = getPool();

  const issueRes = await p.query(
    `SELECT "projectId" FROM "issues" WHERE "id" = $1 OR "key" = $1 LIMIT 1`,
    [issueId]
  );

  if (!issueRes.rows?.length) {
    throw Object.assign(new Error('Issue not found'), { status: 404 });
  }

  const projectId = issueRes.rows[0].projectId;
  const role = await assertProjectAccess(userId, projectId);
  return { projectId, role };
}

/**
 * Look up which project a subtask's issue belongs to, then assert the user has access.
 * Returns { projectId, issueId, role }.
 */
export async function assertSubtaskAccess(
  userId: number | string,
  issueId: string
): Promise<{ projectId: number; issueId: string; role: string }> {
  const { projectId, role } = await assertIssueAccess(userId, issueId);
  return { projectId, issueId, role };
}
