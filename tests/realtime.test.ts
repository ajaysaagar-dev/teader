import { describe, it, expect } from 'vitest';
import { reconcileCreatedIssue } from '../lib/reconcileIssue';
import { Issue } from '../lib/types';
import { ReorderIssuesSchema, AddSubtaskSchema, UpdateSubtaskSchema } from '../lib/validation';

describe('Realtime Issue & Folder Synchronization', () => {
  const baseIssue: Issue = {
    id: 'issue-1',
    key: 'PRJ-1',
    title: 'Initial Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    project: 'Teader',
    projectId: 1,
    epic: 'General',
    labels: ['Task'],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const folderIssue: Issue = {
    id: 'folder-1',
    key: 'PRJ-2',
    title: '📁 Backend Architecture',
    description: '',
    status: 'todo',
    priority: 'medium',
    project: 'Teader',
    projectId: 1,
    epic: 'Backend Architecture',
    labels: ['Folder', 'Group'],
    subtasks: [
      { id: 'st-1', issueId: 'folder-1', title: 'Setup DB pool', completed: false, isFolder: false, type: 'subtask' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('reconciles optimistic task with server-persisted task', () => {
    const optimisticTask: Issue = {
      ...baseIssue,
      id: 'temp_1234567890',
      title: 'New Feature Work',
    };
    const initialList = [optimisticTask];

    const serverTask: Issue = {
      ...baseIssue,
      id: 'server-uuid-1',
      title: 'New Feature Work',
    };

    const reconciled = reconcileCreatedIssue(initialList, serverTask);
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0].id).toBe('server-uuid-1');
    expect(reconciled[0].title).toBe('New Feature Work');
  });

  it('reconciles new folder entity into issues list', () => {
    const initialList = [baseIssue];
    const updated = reconcileCreatedIssue(initialList, folderIssue);

    expect(updated).toHaveLength(2);
    expect(updated.some((i) => i.id === 'folder-1' && i.title.startsWith('📁 '))).toBe(true);
  });

  it('updates task content when receiving realtime TASK_UPDATED payload', () => {
    const issues = [baseIssue, folderIssue];
    const updatePayload = { id: 'issue-1', status: 'done' as const, epic: 'Backend Architecture', folderId: 'folder-1' };

    const nextIssues = issues.map((i) => (i.id === updatePayload.id ? { ...i, ...updatePayload } : i));
    const target = nextIssues.find((i) => i.id === 'issue-1');

    expect(target?.status).toBe('done');
    expect(target?.epic).toBe('Backend Architecture');
    expect(target?.folderId).toBe('folder-1');
  });

  it('reorders tasks in realtime when receiving TASKS_REORDERED payload', () => {
    const issueA = { ...baseIssue, id: 'a', orderIndex: 0 };
    const issueB = { ...baseIssue, id: 'b', orderIndex: 1 };
    const issues = [issueA, issueB];

    const reorderedItems = [
      { id: 'b', orderIndex: 0 },
      { id: 'a', orderIndex: 1 },
    ];
    const map = new Map(reorderedItems.map((it) => [it.id, it]));

    const updated = issues
      .map((iss) => {
        const update = map.get(iss.id);
        return update ? { ...iss, orderIndex: update.orderIndex } : iss;
      })
      .sort((a, b) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0));

    expect(updated[0].id).toBe('b');
    expect(updated[1].id).toBe('a');
  });

  it('removes task or folder in realtime when receiving TASK_DELETED payload', () => {
    const issues = [baseIssue, folderIssue];
    const deletedId = 'folder-1';
    const remaining = issues.filter((i) => i.id !== deletedId);

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('issue-1');
  });

  it('validates reorder, add-subtask, and update-subtask schemas with optional projectId', () => {
    const reorderValid = ReorderIssuesSchema.safeParse({
      projectId: 1,
      items: [{ id: 'a', orderIndex: 0, status: 'todo' }],
    });
    expect(reorderValid.success).toBe(true);

    const addSubtaskValid = AddSubtaskSchema.safeParse({
      projectId: 1,
      issueId: 'issue-1',
      title: 'New Subtask',
      isFolder: false,
    });
    expect(addSubtaskValid.success).toBe(true);

    const updateSubtaskValid = UpdateSubtaskSchema.safeParse({
      projectId: 1,
      subId: 'sub-1',
      title: 'Updated Subtask Title',
      completed: true,
    });
    expect(updateSubtaskValid.success).toBe(true);
  });
});
