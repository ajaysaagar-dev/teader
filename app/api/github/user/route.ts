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

    const res = await fetch('https://api.github.com/user', {
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
        { error: errorData.message || 'Invalid or expired GitHub access token' },
        { status: res.status }
      );
    }

    const userData = await res.json();
    return NextResponse.json({
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
        html_url: userData.html_url,
        bio: userData.bio,
        public_repos: userData.public_repos,
        total_private_repos: userData.total_private_repos,
      },
    });
  } catch (err: any) {
    console.error('GET /api/github/user error:', err);
    return NextResponse.json({ error: err.message || 'Failed to verify GitHub token' }, { status: 500 });
  }
}
