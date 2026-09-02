import { describe, it, expect } from 'vitest';
import {
  UpdateMemberPermissionsSchema,
  UpdateIssueDateSchema,
  UpdateHistoryEntrySchema,
  ReorderDocsSchema,
  ReorderDocFoldersSchema,
  DeleteDocFolderSchema,
} from '../lib/validation';
import {
  getMemberPermissionsDB,
  upsertMemberPermissionsDB,
  getAllMemberPermissionsDB,
  logProjectHistoryDB,
  getProjectHistoryDB,
  deleteProjectHistoryEntryDB,
  updateProjectHistoryEntryDB,
  updateIssueCreatedAtDB,
  getProjectDocFoldersDB,
  createProjectDocFolderDB,
  deleteProjectDocFolderDB,
  reorderProjectDocFoldersDB,
  reorderProjectDocsDB,
} from '../lib/db';
import { formatAddedTiming, formatExactDateTime } from '../lib/task-id';

describe('Project Member Permissions Schema Validation', () => {
  it('validates a valid permissions update payload including can_complete_tasks', () => {
    const payload = {
      userId: 5,
      permissions: {
        can_create_tasks: true,
        can_delete_tasks: true,
        can_create_docs: true,
        can_edit_docs: false,
        can_delete_docs: false,
        can_edit_history: false,
        can_delete_history: false,
        can_edit_dates: true,
        can_manage_members: false,
        can_complete_tasks: true,
      },
    };

    const result = UpdateMemberPermissionsSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userId).toBe(5);
      expect(result.data.permissions.can_delete_tasks).toBe(true);
      expect(result.data.permissions.can_edit_dates).toBe(true);
      expect(result.data.permissions.can_complete_tasks).toBe(true);
    }
  });

  it('validates partial permissions updates with can_complete_tasks', () => {
    const payload = {
      userId: '12',
      permissions: {
        can_delete_tasks: true,
        can_manage_members: true,
        can_complete_tasks: false,
      },
    };

    const result = UpdateMemberPermissionsSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.permissions.can_complete_tasks).toBe(false);
    }
  });

  it('validates update issue created date schema', () => {
    const valid = { createdAt: '2026-08-15T10:30:00.000Z' };
    const res = UpdateIssueDateSchema.safeParse(valid);
    expect(res.success).toBe(true);

    const invalid = { createdAt: '' };
    const failRes = UpdateIssueDateSchema.safeParse(invalid);
    expect(failRes.success).toBe(false);
  });

  it('validates update history entry schema', () => {
    const valid = {
      entryId: 101,
      details: { note: 'Manual audit fix' },
      createdAt: '2026-09-01T12:00:00.000Z',
    };
    const res = UpdateHistoryEntrySchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it('formats task added timings accurately', () => {
    const now = new Date();
    expect(formatAddedTiming(now.toISOString())).toBe('Just now');

    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    expect(formatAddedTiming(tenMinAgo.toISOString())).toBe('10m ago');

    const threeHoursAgo = new Date(now.getTime() - 3 * 3600 * 1000);
    expect(formatAddedTiming(threeHoursAgo.toISOString())).toBe('3h ago');

    const yesterday = new Date(now.getTime() - 25 * 3600 * 1000);
    expect(formatAddedTiming(yesterday.toISOString())).toBe('Yesterday');

    const fourDaysAgo = new Date(now.getTime() - 4 * 86400 * 1000);
    expect(formatAddedTiming(fourDaysAgo.toISOString())).toBe('4d ago');

    expect(formatAddedTiming(null)).toBe('Recently');
    expect(formatAddedTiming(undefined)).toBe('Recently');

    const exact = formatExactDateTime(now.toISOString());
    expect(exact).toContain('Added on');
  });

  it('validates docs reorder schema and folder operations schemas', () => {
    const docReorderPayload = {
      items: [
        { id: 'doc-1', orderIndex: 0, folder: 'Start' },
        { id: 'doc-2', orderIndex: 1, folder: 'Architecture' },
      ],
    };
    const docReorderRes = ReorderDocsSchema.safeParse(docReorderPayload);
    expect(docReorderRes.success).toBe(true);

    const folderReorderPayload = {
      folders: [
        { name: 'Architecture', orderIndex: 0 },
        { name: 'API Guides', orderIndex: 1 },
      ],
    };
    const folderReorderRes = ReorderDocFoldersSchema.safeParse(folderReorderPayload);
    expect(folderReorderRes.success).toBe(true);

    const deleteFolderPayload = {
      folderName: 'Architecture',
      moveToFolder: 'Start',
    };
    const deleteFolderRes = DeleteDocFolderSchema.safeParse(deleteFolderPayload);
    expect(deleteFolderRes.success).toBe(true);
  });
});

describe('Database Project Permissions & History In-Memory / DB Operations', () => {
  const testProjectId = 999;
  const testUserId = 777;

  it('returns default member permissions for a regular member with can_complete_tasks false', async () => {
    const perms = await getMemberPermissionsDB(testProjectId, testUserId);
    expect(perms).toBeDefined();
    expect(perms.can_create_tasks).toBe(true);
    expect(perms.can_delete_tasks).toBe(false);
    expect(perms.can_edit_history).toBe(false);
    expect(perms.can_edit_dates).toBe(false);
    expect(perms.can_complete_tasks).toBe(false);
  });

  it('upserts and retrieves custom member permissions including can_complete_tasks', async () => {
    const updated = await upsertMemberPermissionsDB(testProjectId, testUserId, {
      can_delete_tasks: true,
      can_edit_dates: true,
      can_delete_history: true,
      can_complete_tasks: true,
    });

    expect(updated.can_delete_tasks).toBe(true);
    expect(updated.can_edit_dates).toBe(true);
    expect(updated.can_delete_history).toBe(true);
    expect(updated.can_complete_tasks).toBe(true);
    expect(updated.can_create_tasks).toBe(true); // preserved

    const fetched = await getMemberPermissionsDB(testProjectId, testUserId);
    expect(fetched.can_delete_tasks).toBe(true);
    expect(fetched.can_edit_dates).toBe(true);
    expect(fetched.can_delete_history).toBe(true);
    expect(fetched.can_complete_tasks).toBe(true);
  });

  it('logs and queries project history entries with filtering', async () => {
    const entry1 = await logProjectHistoryDB({
      projectId: testProjectId,
      projectKey: 'TEST-PRJ',
      userId: testUserId,
      userName: 'Test Member',
      action: 'task_created',
      entityType: 'task',
      entityId: 'test-task-1',
      entityTitle: 'New Architecture Spike',
      details: { priority: 'high', status: 'todo' },
    });

    expect(entry1).toBeDefined();
    expect(entry1.action).toBe('task_created');
    expect(entry1.entityTitle).toBe('New Architecture Spike');

    const entry2 = await logProjectHistoryDB({
      projectId: testProjectId,
      projectKey: 'TEST-PRJ',
      userId: testUserId,
      userName: 'Test Member',
      action: 'doc_created',
      entityType: 'doc',
      entityId: 'doc-1',
      entityTitle: 'System Specs',
    });

    const allHistory = await getProjectHistoryDB(testProjectId);
    expect(allHistory.length).toBeGreaterThanOrEqual(2);

    // Filter by entityType
    const taskHistory = await getProjectHistoryDB(testProjectId, { entityType: 'task' });
    expect(taskHistory.some((h) => h.id === entry1.id)).toBe(true);

    const docHistory = await getProjectHistoryDB(testProjectId, { entityType: 'doc' });
    expect(docHistory.some((h) => h.id === entry2.id)).toBe(true);
  });

  it('manages doc folders and batch reordering operations', async () => {
    // 1. Create folders
    const f1 = await createProjectDocFolderDB(testProjectId, 'Architecture', 0);
    const f2 = await createProjectDocFolderDB(testProjectId, 'Deployment', 1);

    expect(f1.name).toBe('Architecture');
    expect(f2.name).toBe('Deployment');

    const folders = await getProjectDocFoldersDB(testProjectId);
    expect(folders.some((f) => f.name === 'Architecture')).toBe(true);

    // 2. Reorder folders
    await reorderProjectDocFoldersDB(testProjectId, [
      { name: 'Deployment', orderIndex: 0 },
      { name: 'Architecture', orderIndex: 1 },
    ]);

    const reorderedFolders = await getProjectDocFoldersDB(testProjectId);
    expect(reorderedFolders[0]?.name).toBe('Deployment');

    // 3. Batch reorder docs
    const reorderedDocsRes = await reorderProjectDocsDB(testProjectId, [
      { id: 'd-1', orderIndex: 0, folder: 'Deployment' },
      { id: 'd-2', orderIndex: 1, folder: 'Architecture' },
    ]);
    expect(reorderedDocsRes).toBe(true);

    // 4. Delete folder and migrate docs to Start
    const delResult = await deleteProjectDocFolderDB(testProjectId, 'Architecture', 'Start');
    expect(delResult.success).toBe(true);

    const afterDelFolders = await getProjectDocFoldersDB(testProjectId);
    expect(afterDelFolders.some((f) => f.name === 'Architecture')).toBe(false);
  });

  it('updates and deletes project history entries', async () => {
    const entry = await logProjectHistoryDB({
      projectId: testProjectId,
      projectKey: 'TEST-PRJ',
      userName: 'Admin',
      action: 'task_updated',
      entityType: 'task',
      entityId: 'task-edit-test',
      entityTitle: 'Initial Title',
    });

    const updateSuccess = await updateProjectHistoryEntryDB(entry.id, {
      entityTitle: 'Updated Audit Title',
    });
    expect(updateSuccess).toBe(true);

    const deleteSuccess = await deleteProjectHistoryEntryDB(entry.id);
    expect(deleteSuccess).toBe(true);
  });

  it('updates issue createdAt date timestamp', async () => {
    const newDate = '2025-01-01T00:00:00.000Z';
    const res = await updateIssueCreatedAtDB('issue-1', newDate);
    expect(res).toBe(true);
  });
});