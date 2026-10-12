export type PrimaryTab = 'overview' | 'tasks' | 'docs' | 'settings';

export type OverviewSubView = 'summary' | 'activity';
export type TasksSubView = 'board' | 'list' | 'tree' | 'timeline' | 'calendar' | 'graph' | 'hierarchy';
export type DocsSubView = 'docs' | 'charts';
export type SettingsSubView = 'general' | 'apps' | 'plugins';

export type ProjectSubView = OverviewSubView | TasksSubView | DocsSubView | SettingsSubView;

export interface ResolvedProjectNav {
  tab: PrimaryTab;
  subview: ProjectSubView;
}

export const PRIMARY_TABS: { id: PrimaryTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'docs', label: 'Docs' },
  { id: 'settings', label: 'Settings' },
];

export const TASK_VIEW_MODES: { id: TasksSubView; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
  { id: 'tree', label: 'Tree' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'graph', label: 'Dependency Graph' },
  { id: 'hierarchy', label: 'Hierarchy' },
];

export const DOCS_SUB_VIEWS: { id: DocsSubView; label: string }[] = [
  { id: 'docs', label: 'Docs' },
  { id: 'charts', label: 'Charts' },
];

export const SETTINGS_SUB_VIEWS: { id: SettingsSubView; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'apps', label: 'Apps & Integrations' },
  { id: 'plugins', label: 'Plugins' },
];

export const OVERVIEW_SUB_VIEWS: { id: OverviewSubView; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'activity', label: 'Activity' },
];

/**
 * Normalizes any legacy route param or query tab into canonical { tab, subview }.
 * Ensures backward compatibility with all historical bookmarks and API links.
 */
export function resolveProjectNav(
  rawViewOrTab?: string | null,
  rawSubView?: string | null
): ResolvedProjectNav {
  const primary = (rawViewOrTab || '').toLowerCase().trim();
  const secondary = (rawSubView || '').toLowerCase().trim();

  // If primary matches one of the 4 canonical primary tabs:
  if (primary === 'tasks') {
    const validViews: TasksSubView[] = ['board', 'list', 'tree', 'timeline', 'calendar', 'graph', 'hierarchy'];
    const aliasMap: Record<string, TasksSubView> = {
      kanban: 'board',
      compact: 'list',
      hierarchical: 'hierarchy',
      dependency: 'graph',
    };
    const sub = aliasMap[secondary] || (validViews.includes(secondary as TasksSubView) ? (secondary as TasksSubView) : 'board');
    return { tab: 'tasks', subview: sub };
  }

  if (primary === 'overview') {
    const validViews: OverviewSubView[] = ['summary', 'activity'];
    const aliasMap: Record<string, OverviewSubView> = {
      history: 'activity',
    };
    const sub = aliasMap[secondary] || (validViews.includes(secondary as OverviewSubView) ? (secondary as OverviewSubView) : 'summary');
    return { tab: 'overview', subview: sub };
  }

  if (primary === 'docs') {
    const validViews: DocsSubView[] = ['docs', 'charts'];
    const sub = validViews.includes(secondary as DocsSubView) ? (secondary as DocsSubView) : 'docs';
    return { tab: 'docs', subview: sub };
  }

  if (primary === 'settings') {
    const validViews: SettingsSubView[] = ['general', 'apps', 'plugins'];
    const aliasMap: Record<string, SettingsSubView> = {
      repositories: 'apps',
      github: 'apps',
    };
    const sub = aliasMap[secondary] || (validViews.includes(secondary as SettingsSubView) ? (secondary as SettingsSubView) : 'general');
    return { tab: 'settings', subview: sub };
  }

  // Legacy route mappings when rawViewOrTab contains the legacy sub-view name directly:
  switch (primary) {
    case 'kanban':
    case 'board':
      return { tab: 'tasks', subview: 'board' };
    case 'list':
    case 'compact':
      return { tab: 'tasks', subview: 'list' };
    case 'tree':
      return { tab: 'tasks', subview: 'tree' };
    case 'timeline':
      return { tab: 'tasks', subview: 'timeline' };
    case 'calendar':
      return { tab: 'tasks', subview: 'calendar' };
    case 'graph':
    case 'dependency':
      return { tab: 'tasks', subview: 'graph' };
    case 'hierarchy':
    case 'hierarchical':
      return { tab: 'tasks', subview: 'hierarchy' };

    case 'summary':
      return { tab: 'overview', subview: 'summary' };
    case 'activity':
    case 'history':
      return { tab: 'overview', subview: 'activity' };
    case 'meeting':
      return { tab: 'overview', subview: 'summary' };

    case 'charts':
      return { tab: 'docs', subview: 'charts' };

    case 'apps':
    case 'repositories':
    case 'github':
      return { tab: 'settings', subview: 'apps' };
    case 'plugins':
      return { tab: 'settings', subview: 'plugins' };

    default:
      // Default canonical landing view: Tasks Board
      return { tab: 'tasks', subview: 'board' };
  }
}

export function getProjectNavUrl(
  projectId: string | number,
  tab: PrimaryTab,
  subview?: ProjectSubView
): string {
  if (!subview) {
    return `/projects/${projectId}?tab=${tab}`;
  }
  return `/projects/${projectId}?tab=${tab}&view=${subview}`;
}
