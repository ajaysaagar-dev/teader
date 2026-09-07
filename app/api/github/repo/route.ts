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
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const action = searchParams.get('action') || 'overview';
    const path = searchParams.get('path') || '';
    const ref = searchParams.get('ref') || undefined;
    const sha = searchParams.get('sha') || undefined;
    const state = (searchParams.get('state') as 'open' | 'closed' | 'all') || 'all';
    const page = Number(searchParams.get('page')) || 1;
    const perPage = Number(searchParams.get('per_page')) || 30;

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Owner and repo query parameters are required' }, { status: 400 });
    }

    const octokit = new Octokit({ auth: token });

    switch (action) {
      case 'overview': {
        const [{ data: repoData }, branchesRes, readmeRes] = await Promise.all([
          octokit.rest.repos.get({ owner, repo }),
          octokit.rest.repos.listBranches({ owner, repo, per_page: 50 }).catch(() => ({ data: [] })),
          octokit.rest.repos.getReadme({ owner, repo, ref }).catch(() => null),
        ]);

        let readmeContent: string | null = null;
        if (readmeRes && readmeRes.data && 'content' in readmeRes.data) {
          readmeContent = Buffer.from(readmeRes.data.content, 'base64').toString('utf-8');
        }

        const branches = (branchesRes.data || []).map((b: any) => ({
          name: b.name,
          protected: b.protected,
          sha: b.commit?.sha,
        }));

        return NextResponse.json({
          repository: {
            id: repoData.id,
            name: repoData.name,
            fullName: repoData.full_name,
            description: repoData.description,
            isPrivate: repoData.private,
            htmlUrl: repoData.html_url,
            cloneUrl: repoData.clone_url,
            sshUrl: repoData.ssh_url,
            defaultBranch: repoData.default_branch || 'main',
            language: repoData.language,
            starsCount: repoData.stargazers_count,
            forksCount: repoData.forks_count,
            openIssuesCount: repoData.open_issues_count,
            watchersCount: repoData.watchers_count,
            license: repoData.license?.name,
            updatedAt: repoData.updated_at,
            createdAt: repoData.created_at,
            pushedAt: repoData.pushed_at,
            owner: {
              login: repoData.owner.login,
              avatarUrl: repoData.owner.avatar_url,
              htmlUrl: repoData.owner.html_url,
            },
          },
          readme: readmeContent,
          branches,
        });
      }

      case 'contents': {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref,
        });

        if (Array.isArray(data)) {
          const items = (data as any[]).map((item: any) => ({
            name: item.name,
            path: item.path,
            type: item.type, // 'file' | 'dir' | 'submodule' | 'symlink'
            size: item.size,
            htmlUrl: item.html_url,
            sha: item.sha,
          })).sort((a: any, b: any) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
          });

          return NextResponse.json({ type: 'dir', items, currentPath: path });
        } else if (data && 'content' in data && data.type === 'file') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return NextResponse.json({
            type: 'file',
            name: data.name,
            path: data.path,
            size: data.size,
            sha: data.sha,
            htmlUrl: data.html_url,
            content,
          });
        }

        return NextResponse.json({ data });
      }

      case 'commits': {
        const { data } = await octokit.rest.repos.listCommits({
          owner,
          repo,
          sha: sha || ref,
          page,
          per_page: perPage,
        });

        const commits = data.map((c: any) => ({
          sha: c.sha,
          shortSha: c.sha.substring(0, 7),
          message: c.commit.message,
          author: {
            name: c.commit.author?.name || c.author?.login || 'Unknown',
            email: c.commit.author?.email,
            date: c.commit.author?.date,
            avatarUrl: c.author?.avatar_url || '',
            login: c.author?.login,
          },
          htmlUrl: c.html_url,
          commentCount: c.commit.comment_count,
        }));

        return NextResponse.json({ commits });
      }

      case 'commit': {
        const commitRef = searchParams.get('ref') || searchParams.get('sha');
        if (!commitRef) {
          return NextResponse.json({ error: 'Commit ref or sha is required' }, { status: 400 });
        }

        const { data } = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commitRef,
        });

        return NextResponse.json({
          commit: {
            sha: data.sha,
            shortSha: data.sha.substring(0, 7),
            message: data.commit.message,
            author: {
              name: data.commit.author?.name || data.author?.login || 'Unknown',
              date: data.commit.author?.date,
              avatarUrl: data.author?.avatar_url || '',
              login: data.author?.login,
            },
            stats: data.stats,
            files: (data.files || []).map((f: any) => ({
              filename: f.filename,
              status: f.status, // 'added' | 'removed' | 'modified' | 'renamed'
              additions: f.additions,
              deletions: f.deletions,
              changes: f.changes,
              patch: f.patch,
              rawUrl: f.raw_url,
            })),
            htmlUrl: data.html_url,
          },
        });
      }

      case 'branches': {
        const { data } = await octokit.rest.repos.listBranches({
          owner,
          repo,
          per_page: 100,
        });

        const branches = (data as any[]).map((b: any) => ({
          name: b.name,
          protected: b.protected,
          sha: b.commit.sha,
        }));

        return NextResponse.json({ branches });
      }

      case 'pulls': {
        const { data } = await octokit.rest.pulls.list({
          owner,
          repo,
          state,
          per_page: perPage,
          page,
        });

        const pullRequests = (data as any[]).map((p: any) => ({
          id: p.id,
          number: p.number,
          title: p.title,
          state: p.state,
          merged: Boolean((p as any).merged_at),
          user: {
            login: p.user?.login,
            avatarUrl: p.user?.avatar_url,
          },
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          htmlUrl: p.html_url,
          labels: p.labels.map((l: any) => ({ name: l.name, color: l.color })),
        }));

        return NextResponse.json({ pullRequests });
      }

      case 'issues': {
        const { data } = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state,
          per_page: perPage,
          page,
        });

        // Filter out pull requests since GitHub API returns PRs in issues endpoint
        const issues = (data as any[])
          .filter((i: any) => !i.pull_request)
          .map((i: any) => ({
            id: i.id,
            number: i.number,
            title: i.title,
            state: i.state,
            user: {
              login: i.user?.login,
              avatarUrl: i.user?.avatar_url,
            },
            commentsCount: i.comments,
            createdAt: i.created_at,
            updatedAt: i.updated_at,
            htmlUrl: i.html_url,
            labels: (i.labels || []).map((l: any) => ({
              name: typeof l === 'string' ? l : l.name,
              color: typeof l === 'object' ? l.color : '',
            })),
          }));

        return NextResponse.json({ issues });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('GET /api/github/repo error:', err);
    const status = err.status || 500;
    return NextResponse.json(
      { error: err.message || 'Failed to fetch repository details from GitHub' },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
