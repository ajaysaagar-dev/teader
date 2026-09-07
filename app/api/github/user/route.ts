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

    const octokit = new Octokit({ auth: token });
    const { data: userData } = await octokit.rest.users.getAuthenticated();

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
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.message || 'Invalid or expired GitHub access token' },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
