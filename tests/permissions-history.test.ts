import { describe, it, expect } from 'vitest';
import {
  UpdateMemberPermissionsSchema,
  UpdateIssueDateSchema,
  UpdateHistoryEntrySchema,
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
} from '../lib/db';

describe('Project Member Permissions Schema Validation', () => {
  it('validates a valid permissions update payload', () => {
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
      },
    };

    const result = UpdateMemberPermissionsSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userId).toBe(5);
      expect(result.data.permissions.can_delete_tasks).toBe(true);
      expect(result.data.permissions.can_edit_dates).toBe(true);
    }
  });

  it('validates partial permissions updates', () => {
    const payload = {
      userId: '12',
      permissions: {
        can_delete_tasks: true,
        can_manage_members: true,
      },
    };

    const result = UpdateMemberPermissionsSchema.safeParse(payload);
    expect(result.success).toBe(true);
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
});

describe('Database Project Permissions & History In-Memory / DB Operations', () => {
  const testProjectId = 999;
  const testUserId = 777;

  it('returns default member permissions for a regular member', async () => {
    const perms = await getMemberPermissionsDB(testProjectId, testUserId);
    expect(perms).toBeDefined();
    expect(perms.can_create_tasks).toBe(true);
    expect(perms.can_delete_tasks).toBe(false);
    expect(perms.can_edit_history).toBe(false);
    expect(perms.can_edit_dates).toBe(false);
  });

  it('upserts and retrieves custom member permissions', async () => {
    const updated = await upsertMemberPermissionsDB(testProjectId, testUserId, {
      can_delete_tasks: true,
      can_edit_dates: true,
      can_delete_history: true,
    });

    expect(updated.can_delete_tasks).toBe(true);
    expect(updated.can_edit_dates).toBe(true);
    expect(updated.can_delete_history).toBe(true);
    expect(updated.can_create_tasks).toBe(true); // preserved

    const fetched = await getMemberPermissionsDB(testProjectId, testUserId);
    expect(fetched.can_delete_tasks).toBe(true);
    expect(fetched.can_edit_dates).toBe(true);
    expect(fetched.can_delete_history).toBe(true);
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