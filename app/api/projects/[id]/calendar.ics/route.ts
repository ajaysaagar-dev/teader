import { NextResponse } from 'next/server';
import { getProjectByIdDB, getAllIssuesDB } from '@/lib/db';

/**
 * GET /api/projects/[id]/calendar.ics
 * Standard RFC 5545 iCalendar feed for Google Calendar / Apple Calendar
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const project = await getProjectByIdDB(resolvedParams.id);
    const allIssues = await getAllIssuesDB();
    const projectIssues = allIssues.filter(
      (i: any) =>
        String(i.projectId) === String(resolvedParams.id) ||
        (project && i.project === project.name)
    );

    const formatICSDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const events = projectIssues
      .filter((iss: any) => iss.dueDate)
      .map((iss: any) => {
        const dueDate = iss.dueDate ? formatICSDate(iss.dueDate) : formatICSDate(new Date().toISOString());
        const uid = `${iss.key || iss.id}@teader.pm`;

        return [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
          `DTSTART:${dueDate}`,
          `DTEND:${dueDate}`,
          `SUMMARY:[${iss.key}] ${iss.title.replace(/\n/g, ' ')}`,
          `DESCRIPTION:Priority: ${iss.priority}\\nStatus: ${iss.status}\\nAssignee: ${iss.assigneeName || 'Unassigned'}`,
          `STATUS:${iss.status === 'done' ? 'COMPLETED' : 'CONFIRMED'}`,
          'END:VEVENT',
        ].join('\r\n');
      });

    const icsBody = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Teader PM//Project Calendar 1.0//EN',
      `X-WR-CALNAME:${project?.name || 'Teader'} Project Tasks`,
      'CALSCALE:GREGORIAN',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    return new NextResponse(icsBody, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${(project?.key || 'project')}.ics"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
