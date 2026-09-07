import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from 'octokit';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const customHeader = request.headers.get('x-github-token') || '';
    let token = customHeader;

    if (!token && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (!token && authHeader.startsWith('token ')) {
      token = authHeader.substring(6).trim();
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub access token is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const page = searchParams.get('page') || '1';
    const perPage = searchParams.get('per_page') || '100';

    const octokit = new Octokit({ auth: token });
    let rawRepos: any[] = [];
    let totalCount = 0;

    if (query.trim()) {
      const { data } = await octokit.rest.search.repos({
        q: `${query.trim()} user:@me`,
        sort: 'updated',
        per_page: Number(perPage) || 100,
        page: Number(page) || 1,
      });
      rawRepos = data.items || [];
      totalCount = data.total_count || rawRepos.length;
    } else {
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: Number(perPage) || 100,
        page: Number(page) || 1,
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member',
      });
      rawRepos = data || [];
      totalCount = data.length;
    }

    const repos = rawRepos.map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      htmlUrl: r.html_url,
      description: r.description,
      defaultBranch: r.default_branch || 'main',
      isPrivate: Boolean(r.private),
      language: r.language,
      starsCount: r.stargazers_count || 0,
      forksCount: r.forks_count || 0,
      openIssuesCount: r.open_issues_count || 0,
      updatedAt: r.updated_at,
      pushedAt: r.pushed_at,
      owner: {
        login: r.owner?.login,
        avatarUrl: r.owner?.avatar_url,
        htmlUrl: r.owner?.html_url,
      },
    }));

    return NextResponse.json({ repos, totalCount });
  } catch (err: any) {
    console.error('GET /api/github/repos error:', err);
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.message || 'Failed to list GitHub repositories' },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
