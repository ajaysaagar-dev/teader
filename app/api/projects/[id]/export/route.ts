import { NextResponse } from 'next/server';
import { getProjectByIdDB, getAllIssuesDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';

/**
 * GET /api/projects/[id]/export?format=json|csv
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';

  try {
    const project = await getProjectByIdDB(resolvedParams.id);
    const allIssues = await getAllIssuesDB();
    const projectIssues = allIssues.filter(
      (i: any) =>
        String(i.projectId) === String(resolvedParams.id) ||
        (project && i.project === project.name)
    );

    if (format === 'csv') {
      const headers = ['Key', 'Title', 'Status', 'Priority', 'Assignee', 'Epic', 'Due Date', 'Estimated Hours', 'Logged Hours', 'Subtasks Count'];
      const rows = projectIssues.map((i: any) => [
        `"${i.key}"`,
        `"${(i.title || '').replace(/"/g, '""')}"`,
        `"${i.status}"`,
        `"${i.priority}"`,
        `"${(i.assigneeName || '').replace(/"/g, '""')}"`,
        `"${(i.epic || '').replace(/"/g, '""')}"`,
        `"${i.dueDate || ''}"`,
        `"${i.estimatedHours || 0}"`,
        `"${i.loggedHours || 0}"`,
        `"${(i.subtasks || []).length}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');


      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${(project?.key || 'project')}-export.csv"`,
        },
      });
    }

    // Default JSON export
    const exportData = {
      exportedAt: new Date().toISOString(),
      platform: 'Teader PM',
      project,
      tasksCount: projectIssues.length,
      tasks: projectIssues,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${(project?.key || 'project')}-export.json"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
