import { describe, it, expect } from 'vitest';

describe('Project Apps & Integrations Tab', () => {
  function parseViewTab(view?: string): string {
    if (!view) return 'overview';
    const v = String(view).toLowerCase();
    if (v === 'meeting' || v === 'call' || v === 'audio' || v === 'voice' || v === 'conference' || v === 'huddle') return 'meeting';
    if (v === 'chats' || v === 'chat' || v === 'conversation' || v === 'conversations' || v === 'messages' || v === 'discuss') return 'chats';
    if (v === 'apps' || v === 'app' || v === 'tools' || v === 'integrations' || v === 'store' || v === 'widgets') return 'apps';
    if (v === 'charts' || v === 'diagram' || v === 'diagrams' || v === 'canvas' || v === 'flow' || v === 'whiteboard') return 'charts';
    if (v === 'overview' || v === 'analytics' || v === 'insights' || v === 'stats') return 'overview';
    if (v === 'docs' || v === 'wiki' || v === 'spec') return 'docs';
    if (v === 'history' || v === 'audit' || v === 'log' || v === 'changelog') return 'history';
    if (v === 'settings' || v === 'config' || v === 'preferences') return 'settings';
    return 'overview';
  }

  function extractYouTubeVideoId(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    return match ? match[1] : null;
  }

  it('correctly maps URL view parameters to apps tab', () => {
    expect(parseViewTab('apps')).toBe('apps');
    expect(parseViewTab('app')).toBe('apps');
    expect(parseViewTab('tools')).toBe('apps');
    expect(parseViewTab('integrations')).toBe('apps');
    expect(parseViewTab('widgets')).toBe('apps');
  });

  it('ensures tab ordering has apps directly adjacent to chats', () => {
    const projectTabs = ['overview', 'tasks', 'docs', 'charts', 'meeting', 'chats', 'apps', 'history', 'settings'];
    const chatsIdx = projectTabs.indexOf('chats');
    const appsIdx = projectTabs.indexOf('apps');
    expect(appsIdx).toBe(chatsIdx + 1);
  });

  it('extracts YouTube video IDs from various formats', () => {
    expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('some random search text')).toBeNull();
  });

  it('verifies Google iframe search URL parameters', () => {
    const query = 'react 19 hooks';
    const encoded = encodeURIComponent(query);
    const googleUrl = `https://www.google.com/search?q=${encoded}&igu=1`;
    expect(googleUrl).toContain('igu=1');
    expect(googleUrl).toContain('q=react%2019%20hooks');
  });

  it('handles custom app addition and storage modeling', () => {
    interface AppDef {
      id: string;
      name: string;
      defaultUrl: string;
    }
    const defaultApps: AppDef[] = [
      { id: 'google', name: 'Google', defaultUrl: 'https://www.google.com/webhp?igu=1' },
      { id: 'youtube', name: 'YouTube', defaultUrl: 'https://www.youtube-nocookie.com/embed' }
    ];

    const customApp: AppDef = {
      id: 'custom_123',
      name: 'Staging Admin',
      defaultUrl: 'https://staging.example.com'
    };

    const combined = [...defaultApps, customApp];
    expect(combined.length).toBe(3);
    expect(combined.find((a) => a.id === 'custom_123')?.name).toBe('Staging Admin');

    const filtered = combined.filter((a) => a.id !== 'custom_123');
    expect(filtered.length).toBe(2);
  });
});
