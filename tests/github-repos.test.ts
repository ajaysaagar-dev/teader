import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getProjectRepositoriesDB,
  addProjectRepositoryDB,
  deleteProjectRepositoryDB,
} from '@/lib/db';
import { GET as getUserRoute } from '@/app/api/github/user/route';
import { GET as getReposRoute } from '@/app/api/github/repos/route';

describe('Project GitHub Repositories Database & Workflow', () => {
  const testProjectId = 999;

  beforeEach(async () => {
    // Clean up test repositories for the project
    await deleteProjectRepositoryDB(testProjectId, 'testowner/repo-1');
    await deleteProjectRepositoryDB(testProjectId, 'testowner/repo-2');
  });

  it('adds a repository to a project and retrieves it', async () => {
    const repoData = {
      repoId: 101,
      name: 'repo-1',
      fullName: 'testowner/repo-1',
      htmlUrl: 'https://github.com/testowner/repo-1',
      description: 'A test repository for unit testing',
      defaultBranch: 'main',
      isPrivate: false,
      language: 'TypeScript',
      starsCount: 42,
      forksCount: 5,
      openIssuesCount: 2,
    };

    const saved = await addProjectRepositoryDB(testProjectId, repoData, 1);
    expect(saved).toBeDefined();
    expect(saved.projectId).toBe(testProjectId);
    expect(saved.fullName).toBe('testowner/repo-1');
    expect(saved.starsCount).toBe(42);

    const projectRepos = await getProjectRepositoriesDB(testProjectId);
    const found = projectRepos.find((r) => r.fullName === 'testowner/repo-1');
    expect(found).toBeDefined();
    expect(found?.name).toBe('repo-1');
    expect(found?.language).toBe('TypeScript');
  });

  it('updates repository details on conflict rather than duplicating', async () => {
    await addProjectRepositoryDB(
      testProjectId,
      {
        name: 'repo-1',
        fullName: 'testowner/repo-1',
        htmlUrl: 'https://github.com/testowner/repo-1',
        description: 'Original description',
        starsCount: 10,
      },
      1
    );

    const updated = await addProjectRepositoryDB(
      testProjectId,
      {
        name: 'repo-1',
        fullName: 'testowner/repo-1',
        htmlUrl: 'https://github.com/testowner/repo-1',
        description: 'Updated description',
        starsCount: 50,
      },
      1
    );

    expect(updated.description).toBe('Updated description');
    expect(updated.starsCount).toBe(50);

    const projectRepos = await getProjectRepositoriesDB(testProjectId);
    const matches = projectRepos.filter((r) => r.fullName === 'testowner/repo-1');
    expect(matches.length).toBe(1);
  });

  it('removes a repository from a project by full name or ID', async () => {
    await addProjectRepositoryDB(
      testProjectId,
      {
        name: 'repo-2',
        fullName: 'testowner/repo-2',
        htmlUrl: 'https://github.com/testowner/repo-2',
      },
      1
    );

    let repos = await getProjectRepositoriesDB(testProjectId);
    expect(repos.some((r) => r.fullName === 'testowner/repo-2')).toBe(true);

    await deleteProjectRepositoryDB(testProjectId, 'testowner/repo-2');

    repos = await getProjectRepositoriesDB(testProjectId);
    expect(repos.some((r) => r.fullName === 'testowner/repo-2')).toBe(false);
  });

  it('handles multi-repository batch addition', async () => {
    const batch = [
      {
        name: 'repo-1',
        fullName: 'testowner/repo-1',
        htmlUrl: 'https://github.com/testowner/repo-1',
      },
      {
        name: 'repo-2',
        fullName: 'testowner/repo-2',
        htmlUrl: 'https://github.com/testowner/repo-2',
      },
    ];

    for (const r of batch) {
      await addProjectRepositoryDB(testProjectId, r, 1);
    }

    const repos = await getProjectRepositoriesDB(testProjectId);
    expect(repos.some((r) => r.fullName === 'testowner/repo-1')).toBe(true);
    expect(repos.some((r) => r.fullName === 'testowner/repo-2')).toBe(true);
  });

  it('returns 401 from /api/github/user when no token is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/github/user');
    const res = await getUserRoute(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('token is required');
  });

  it('returns 401 from /api/github/repos when no token is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/github/repos');
    const res = await getReposRoute(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('token is required');
  });
});
