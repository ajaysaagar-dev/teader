import { NextRequest, NextResponse } from 'next/server';

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

    // If a search query is provided, use GitHub search API, else list user repos
    let githubUrl = `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`;

    if (query.trim()) {
      githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+user:@me&sort=updated&per_page=${perPage}&page=${page}`;
    }

    const res = await fetch(githubUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Teader-Workspace',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch repositories from GitHub' },
        { status: res.status }
      );
    }

    const data = await res.json();
    const rawRepos = Array.isArray(data) ? data : data.items || [];

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

    return NextResponse.json({ repos, totalCount: data.total_count || repos.length });
  } catch (err: any) {
    console.error('GET /api/github/repos error:', err);
    return NextResponse.json({ error: err.message || 'Failed to list GitHub repositories' }, { status: 500 });
  }
}
