import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { getProjectChartsDB, createProjectChartDB, getProjectByIdDB } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { logHistory } from '@/lib/history';
import fs from 'fs';
import path from 'path';

const CHARTS_DIR = path.join(process.cwd(), 'data', 'charts');

function ensureChartsDir() {
  if (!fs.existsSync(CHARTS_DIR)) {
    fs.mkdirSync(CHARTS_DIR, { recursive: true });
  }
}

function getInitialDemoChart(targetProjId: number | string, chartId: string) {
  return {
    id: chartId,
    projectId: targetProjId,
    title: 'Architecture Overview',
    data: {
      elements: [
        {
          id: 'elem-1',
          type: 'rectangle',
          x: 120,
          y: 180,
          width: 170,
          height: 80,
          text: 'Client App\n(Web & Mobile)',
          fontSize: 14,
          textAlign: 'center',
          borderColor: '#ffffff',
          borderWidth: 2,
          borderStyle: 'solid',
          backgroundColor: '#1e1e1e',
          textColor: '#ffffff',
        },
        {
          id: 'elem-2',
          type: 'rounded-rectangle',
          x: 400,
          y: 180,
          width: 170,
          height: 80,
          text: 'API Server\nREST & WebSockets',
          fontSize: 14,
          textAlign: 'center',
          borderColor: '#ffffff',
          borderWidth: 2,
          borderStyle: 'solid',
          backgroundColor: '#1e1e1e',
          textColor: '#ffffff',
        },
        {
          id: 'elem-3',
          type: 'cylinder',
          x: 680,
          y: 170,
          width: 160,
          height: 100,
          text: 'PostgreSQL DB\n& Client Cache',
          fontSize: 14,
          textAlign: 'center',
          borderColor: '#ffffff',
          borderWidth: 2,
          borderStyle: 'solid',
          backgroundColor: '#1e1e1e',
          textColor: '#ffffff',
        },
      ],
      connections: [
        {
          id: 'conn-1',
          fromId: 'elem-1',
          toId: 'elem-2',
          fromAnchor: 'right',
          toAnchor: 'left',
          label: 'HTTPS / WSS',
          style: 'curved',
          color: '#ffffff',
          width: 2,
          dashed: false,
          arrowEnd: true,
        },
        {
          id: 'conn-2',
          fromId: 'elem-2',
          toId: 'elem-3',
          fromAnchor: 'right',
          toAnchor: 'left',
          label: 'SQL Queries',
          style: 'curved',
          color: '#ffffff',
          width: 2,
          dashed: false,
          arrowEnd: true,
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

/**
 * GET /api/projects/[id]/charts
 * Return list of charts for this project
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;

  try {
    ensureChartsDir();
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : Number(rawProjectId) || 1;

    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    let charts = await getProjectChartsDB(targetProjId);

    // If no charts exist, create an initial starter chart
    if (!charts || charts.length === 0) {
      const defaultChartId = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const seedData = getInitialDemoChart(targetProjId, defaultChartId);
      
      const created = await createProjectChartDB({
        id: defaultChartId,
        projectId: targetProjId,
        userId: session.id,
        userName: session.name || 'karri',
        title: seedData.title,
        data: seedData.data,
      });

      // Save backup on disk
      try {
        const diskFile = path.join(CHARTS_DIR, `proj_${targetProjId}_${defaultChartId}.json`);
        fs.writeFileSync(diskFile, JSON.stringify(created, null, 2), 'utf-8');
      } catch {}

      charts = [created];
    }

    return NextResponse.json({ charts });
  } catch (error: any) {
    console.error('[GET /api/projects/[id]/charts error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/charts
 * Create a new chart file for this project
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;

  try {
    ensureChartsDir();
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : Number(rawProjectId) || 1;

    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    const body = await req.json().catch(() => ({}));
    const title = (body.title || '').trim() || 'New Diagram';
    const chartId = body.id || `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const data = body.data || {
      elements: [],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const newChart = await createProjectChartDB({
      id: chartId,
      projectId: targetProjId,
      userId: session.id,
      userName: session.name || 'karri',
      title,
      data,
      orderIndex: body.orderIndex || 0,
    });

    // Write file to disk
    try {
      const diskPath = path.join(CHARTS_DIR, `proj_${targetProjId}_${chartId}.json`);
      fs.writeFileSync(diskPath, JSON.stringify(newChart, null, 2), 'utf-8');
    } catch {}

    try {
      await logHistory({
        projectId: targetProjId,
        userId: session.id,
        userName: session.name || 'User',
        userAvatar: (session as any).avatar,
        action: 'chart_created',
        entityType: 'chart',
        entityId: chartId,
        entityTitle: title,
        senderSessionId: session.id,
      });
    } catch {}

    broadcastRealtimeEvent({
      type: 'CHART_CREATED',
      projectId: String(targetProjId),
      payload: newChart,
      senderSessionId: (session as any).id,
    });

    return NextResponse.json({ chart: newChart }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/projects/[id]/charts error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
