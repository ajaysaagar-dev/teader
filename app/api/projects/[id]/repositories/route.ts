import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectRepositoriesDB,
  addProjectRepositoryDB,
  deleteProjectRepositoryDB,
  logProjectHistoryDB,
} from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const repositories = await getProjectRepositoriesDB(projectId);
    return NextResponse.json({ repositories });
  } catch (err: any) {
    console.error('GET /api/projects/[id]/repositories error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const currentUser = await getSessionFromCookie();
    const body = await request.json();

    // Handle either an array of repos or a single repo
    const reposToAdd = Array.isArray(body.repos) ? body.repos : body.repo ? [body.repo] : [body];

    if (!reposToAdd || reposToAdd.length === 0 || !reposToAdd[0].name) {
      return NextResponse.json({ error: 'Repository data with name is required' }, { status: 400 });
    }

    const savedRepos = [];
    for (const r of reposToAdd) {
      const saved = await addProjectRepositoryDB(
        projectId,
        {
          repoId: r.repoId || r.id,
          name: r.name,
          fullName: r.fullName || r.full_name || r.name,
          htmlUrl: r.htmlUrl || r.html_url,
          description: r.description || null,
          defaultBranch: r.defaultBranch || r.default_branch || 'main',
          isPrivate: Boolean(r.isPrivate !== undefined ? r.isPrivate : r.private),
          language: r.language || null,
          starsCount: r.starsCount !== undefined ? r.starsCount : r.stargazers_count || 0,
          forksCount: r.forksCount !== undefined ? r.forksCount : r.forks_count || 0,
          openIssuesCount: r.openIssuesCount !== undefined ? r.openIssuesCount : r.open_issues_count || 0,
        },
        currentUser?.id
      );
      savedRepos.push(saved);

      // Log in project history
      try {
        await logProjectHistoryDB({
          projectId,
          projectKey: `PRJ-${projectId}`,
          userId: currentUser?.id,
          userName: currentUser?.name || 'User',
          userAvatar: currentUser?.avatar || undefined,
          action: 'connected_repository',
          entityType: 'repository',
          entityId: String(saved.id),
          entityTitle: saved.fullName,
          details: {
            repoName: saved.fullName,
            htmlUrl: saved.htmlUrl,
            stars: saved.starsCount,
          },
        });
      } catch {}
    }

    const allRepos = await getProjectRepositoriesDB(projectId);
    return NextResponse.json({ success: true, added: savedRepos, repositories: allRepos });
  } catch (err: any) {
    console.error('POST /api/projects/[id]/repositories error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const currentUser = await getSessionFromCookie();
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('repoId');
    const fullName = searchParams.get('fullName');

    let bodyTarget: any = null;
    try {
      bodyTarget = await request.json();
    } catch {}

    const target = repoId ? (isNaN(parseInt(repoId, 10)) ? repoId : parseInt(repoId, 10)) : fullName || bodyTarget?.fullName || bodyTarget?.id;

    if (!target) {
      return NextResponse.json({ error: 'repoId or fullName is required' }, { status: 400 });
    }

    await deleteProjectRepositoryDB(projectId, target);

    try {
      await logProjectHistoryDB({
        projectId,
        projectKey: `PRJ-${projectId}`,
        userId: currentUser?.id,
        userName: currentUser?.name || 'User',
        userAvatar: currentUser?.avatar || undefined,
        action: 'removed_repository',
        entityType: 'repository',
        entityId: String(target),
        entityTitle: String(fullName || target),
      });
    } catch {}

    const allRepos = await getProjectRepositoriesDB(projectId);
    return NextResponse.json({ success: true, repositories: allRepos });
  } catch (err: any) {
    console.error('DELETE /api/projects/[id]/repositories error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
