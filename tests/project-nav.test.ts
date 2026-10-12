import { describe, it, expect } from 'vitest';
import { resolveProjectNav, getProjectNavUrl } from '@/lib/project-nav';

describe('Project Navigation Resolver', () => {
  it('maps legacy view aliases to canonical tabs and subviews', () => {
    expect(resolveProjectNav('kanban')).toEqual({ tab: 'tasks', subview: 'board' });
    expect(resolveProjectNav('board')).toEqual({ tab: 'tasks', subview: 'board' });
    expect(resolveProjectNav('list')).toEqual({ tab: 'tasks', subview: 'list' });
    expect(resolveProjectNav('compact')).toEqual({ tab: 'tasks', subview: 'list' });
    expect(resolveProjectNav('tree')).toEqual({ tab: 'tasks', subview: 'tree' });
    expect(resolveProjectNav('timeline')).toEqual({ tab: 'tasks', subview: 'timeline' });
    expect(resolveProjectNav('calendar')).toEqual({ tab: 'tasks', subview: 'calendar' });
    expect(resolveProjectNav('graph')).toEqual({ tab: 'tasks', subview: 'graph' });
    expect(resolveProjectNav('dependency')).toEqual({ tab: 'tasks', subview: 'graph' });
    expect(resolveProjectNav('hierarchy')).toEqual({ tab: 'tasks', subview: 'hierarchy' });
    expect(resolveProjectNav('hierarchical')).toEqual({ tab: 'tasks', subview: 'hierarchy' });
  });

  it('maps docs and charts correctly', () => {
    expect(resolveProjectNav('docs')).toEqual({ tab: 'docs', subview: 'docs' });
    expect(resolveProjectNav('charts')).toEqual({ tab: 'docs', subview: 'charts' });
    expect(resolveProjectNav('docs', 'charts')).toEqual({ tab: 'docs', subview: 'charts' });
  });

  it('maps overview and activity correctly', () => {
    expect(resolveProjectNav('overview')).toEqual({ tab: 'overview', subview: 'summary' });
    expect(resolveProjectNav('activity')).toEqual({ tab: 'overview', subview: 'activity' });
    expect(resolveProjectNav('history')).toEqual({ tab: 'overview', subview: 'activity' });
    expect(resolveProjectNav('overview', 'activity')).toEqual({ tab: 'overview', subview: 'activity' });
  });

  it('maps settings, apps, repositories, and plugins correctly', () => {
    expect(resolveProjectNav('settings')).toEqual({ tab: 'settings', subview: 'general' });
    expect(resolveProjectNav('apps')).toEqual({ tab: 'settings', subview: 'apps' });
    expect(resolveProjectNav('repositories')).toEqual({ tab: 'settings', subview: 'apps' });
    expect(resolveProjectNav('github')).toEqual({ tab: 'settings', subview: 'apps' });
    expect(resolveProjectNav('plugins')).toEqual({ tab: 'settings', subview: 'plugins' });
    expect(resolveProjectNav('settings', 'apps')).toEqual({ tab: 'settings', subview: 'apps' });
  });

  it('defaults gracefully on empty or unknown parameters', () => {
    expect(resolveProjectNav(null)).toEqual({ tab: 'tasks', subview: 'board' });
    expect(resolveProjectNav(undefined)).toEqual({ tab: 'tasks', subview: 'board' });
    expect(resolveProjectNav('non_existent')).toEqual({ tab: 'tasks', subview: 'board' });
  });

  it('generates consistent project nav URLs', () => {
    expect(getProjectNavUrl('1', 'tasks', 'board')).toBe('/projects/1?tab=tasks&view=board');
    expect(getProjectNavUrl('proj_1', 'overview')).toBe('/projects/proj_1?tab=overview');
  });
});
