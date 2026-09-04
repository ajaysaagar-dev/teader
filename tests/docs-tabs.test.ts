import { describe, it, expect } from 'vitest';

interface TabState {
  openDocIds: string[];
  selectedDocId: string | null;
  drafts: Record<string, { content: string; title: string }>;
}

function createTabManager(initialDocIds: string[] = [], initialActiveId: string | null = null) {
  let state: TabState = {
    openDocIds: [...initialDocIds],
    selectedDocId: initialActiveId,
    drafts: {},
  };

  const openDoc = (docId: string, currentContent?: string, currentTitle?: string) => {
    if (state.selectedDocId && (currentContent !== undefined || currentTitle !== undefined)) {
      state.drafts[state.selectedDocId] = {
        content: currentContent ?? '',
        title: currentTitle ?? '',
      };
    }

    if (!state.openDocIds.includes(docId)) {
      state.openDocIds.push(docId);
    }
    state.selectedDocId = docId;
  };

  const closeTab = (docId: string) => {
    delete state.drafts[docId];
    const tabIndex = state.openDocIds.indexOf(docId);
    state.openDocIds = state.openDocIds.filter((id) => id !== docId);

    if (state.selectedDocId === docId) {
      if (state.openDocIds.length > 0) {
        const nextIndex = Math.min(Math.max(0, tabIndex - 1), state.openDocIds.length - 1);
        state.selectedDocId = state.openDocIds[nextIndex];
      } else {
        state.selectedDocId = null;
      }
    }
  };

  const closeOtherTabs = (keepDocId: string) => {
    state.openDocIds = [keepDocId];
    state.selectedDocId = keepDocId;
    state.drafts = state.drafts[keepDocId] ? { [keepDocId]: state.drafts[keepDocId] } : {};
  };

  const closeTabsToRight = (targetDocId: string) => {
    const idx = state.openDocIds.indexOf(targetDocId);
    if (idx === -1) return;
    state.openDocIds = state.openDocIds.slice(0, idx + 1);
    if (!state.openDocIds.includes(state.selectedDocId || '')) {
      state.selectedDocId = targetDocId;
    }
  };

  const closeAllTabs = () => {
    state.openDocIds = [];
    state.selectedDocId = null;
    state.drafts = {};
  };

  const reorderTabs = (draggedId: string, targetId: string) => {
    const fromIdx = state.openDocIds.indexOf(draggedId);
    const toIdx = state.openDocIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = state.openDocIds.splice(fromIdx, 1);
    state.openDocIds.splice(toIdx, 0, moved);
  };

  return {
    getState: () => ({ ...state }),
    openDoc,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    reorderTabs,
  };
}

describe('Documentation Multi-Document Tab System', () => {
  it('opens a document as a tab and activates it', () => {
    const manager = createTabManager();
    manager.openDoc('doc-1');

    expect(manager.getState().openDocIds).toEqual(['doc-1']);
    expect(manager.getState().selectedDocId).toBe('doc-1');
  });

  it('opens multiple documents as separate tabs seamlessly without duplicates', () => {
    const manager = createTabManager(['doc-1'], 'doc-1');
    manager.openDoc('doc-2');

    expect(manager.getState().openDocIds).toEqual(['doc-1', 'doc-2']);
    expect(manager.getState().selectedDocId).toBe('doc-2');

    manager.openDoc('doc-1');
    expect(manager.getState().openDocIds).toEqual(['doc-1', 'doc-2']);
    expect(manager.getState().selectedDocId).toBe('doc-1');
  });

  it('preserves draft content when switching between tabs', () => {
    const manager = createTabManager(['doc-1'], 'doc-1');
    manager.openDoc('doc-2', 'Draft text in doc 1', 'Doc 1 Title');

    expect(manager.getState().selectedDocId).toBe('doc-2');
    expect(manager.getState().drafts['doc-1']).toEqual({
      content: 'Draft text in doc 1',
      title: 'Doc 1 Title',
    });
  });

  it('closes a tab and switches active tab to an adjacent document', () => {
    const manager = createTabManager(['doc-1', 'doc-2', 'doc-3'], 'doc-2');
    manager.closeTab('doc-2');

    expect(manager.getState().openDocIds).toEqual(['doc-1', 'doc-3']);
    expect(manager.getState().selectedDocId).toBe('doc-1');
  });

  it('closes an inactive tab without affecting current active tab', () => {
    const manager = createTabManager(['doc-1', 'doc-2', 'doc-3'], 'doc-3');
    manager.closeTab('doc-1');

    expect(manager.getState().openDocIds).toEqual(['doc-2', 'doc-3']);
    expect(manager.getState().selectedDocId).toBe('doc-3');
  });

  it('clears active document when the last tab is closed', () => {
    const manager = createTabManager(['doc-1'], 'doc-1');
    manager.closeTab('doc-1');

    expect(manager.getState().openDocIds).toEqual([]);
    expect(manager.getState().selectedDocId).toBeNull();
  });

  it('supports closing other tabs', () => {
    const manager = createTabManager(['doc-1', 'doc-2', 'doc-3'], 'doc-1');
    manager.closeOtherTabs('doc-2');

    expect(manager.getState().openDocIds).toEqual(['doc-2']);
    expect(manager.getState().selectedDocId).toBe('doc-2');
  });

  it('supports closing tabs to the right', () => {
    const manager = createTabManager(['doc-1', 'doc-2', 'doc-3', 'doc-4'], 'doc-4');
    manager.closeTabsToRight('doc-2');

    expect(manager.getState().openDocIds).toEqual(['doc-1', 'doc-2']);
    expect(manager.getState().selectedDocId).toBe('doc-2');
  });

  it('supports close all tabs', () => {
    const manager = createTabManager(['doc-1', 'doc-2'], 'doc-2');
    manager.closeAllTabs();

    expect(manager.getState().openDocIds).toEqual([]);
    expect(manager.getState().selectedDocId).toBeNull();
  });

  it('reorders tabs via drag and drop', () => {
    const manager = createTabManager(['doc-1', 'doc-2', 'doc-3'], 'doc-1');
    manager.reorderTabs('doc-3', 'doc-1');

    expect(manager.getState().openDocIds).toEqual(['doc-3', 'doc-1', 'doc-2']);
  });
});
