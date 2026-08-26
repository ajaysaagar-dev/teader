import { describe, it, expect } from 'vitest';
import { buildSubtaskTree } from '../lib/db';

describe('buildSubtaskTree', () => {
  it('returns empty array for no subtasks', () => {
    expect(buildSubtaskTree([])).toEqual([]);
  });

  it('builds a flat list of root subtasks', () => {
    const flat = [
      { id: 'a', issueId: 'i1', parentId: null, title: 'A', completed: 0, isFolder: 0, type: 'subtask' },
      { id: 'b', issueId: 'i1', parentId: null, title: 'B', completed: 0, isFolder: 0, type: 'subtask' },
    ];
    const tree = buildSubtaskTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe('a');
    expect(tree[1].id).toBe('b');
    expect(tree[0].subtasks).toEqual([]);
  });

  it('nests children under their parents', () => {
    const flat = [
      { id: 'parent', issueId: 'i1', parentId: null, title: 'Parent', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'child', issueId: 'i1', parentId: 'parent', title: 'Child', completed: 0, isFolder: 0, type: 'subtask' },
    ];
    const tree = buildSubtaskTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('parent');
    expect(tree[0].subtasks).toHaveLength(1);
    expect(tree[0].subtasks[0].id).toBe('child');
  });

  it('handles deeply nested subtasks', () => {
    const flat = [
      { id: 'lvl0', issueId: 'i1', parentId: null, title: 'L0', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'lvl1', issueId: 'i1', parentId: 'lvl0', title: 'L1', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'lvl2', issueId: 'i1', parentId: 'lvl1', title: 'L2', completed: 0, isFolder: 0, type: 'subtask' },
    ];
    const tree = buildSubtaskTree(flat);
    expect(tree[0].subtasks[0].subtasks[0].id).toBe('lvl2');
  });

  it('converts mysql TINYINT 0/1 to boolean for isFolder and completed', () => {
    const flat = [
      { id: 'f1', issueId: 'i1', parentId: null, title: 'F', completed: 1, isFolder: 1, type: 'folder' },
    ];
    const tree = buildSubtaskTree(flat);
    expect(tree[0].completed).toBe(true);
    expect(tree[0].isFolder).toBe(true);
  });
});
