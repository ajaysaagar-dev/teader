import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { getProjectChartByIdDB, updateProjectChartDB, deleteProjectChartDB, getProjectByIdDB } from '@/lib/db';
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

/**
 * GET /api/projects/[id]/charts/[chartId]
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; chartId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { id: rawProjectId, chartId } = resolvedParams;

  try {
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : Number(rawProjectId) || 1;

    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    let chart = await getProjectChartByIdDB(chartId);

    // Fallback: check disk
    if (!chart) {
      ensureChartsDir();
      const diskPath = path.join(CHARTS_DIR, `proj_${targetProjId}_${chartId}.json`);
      if (fs.existsSync(diskPath)) {
        try {
          const raw = fs.readFileSync(diskPath, 'utf-8');
          chart = JSON.parse(raw);
        } catch {}
      }
    }

    if (!chart) {
      return NextResponse.json({ error: 'Chart not found' }, { status: 404 });
    }

    return NextResponse.json({ chart });
  } catch (error: any) {
    console.error('[GET /api/projects/[id]/charts/[chartId] error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]/charts/[chartId]
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; chartId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { id: rawProjectId, chartId } = resolvedParams;

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

    const body = await req.json();
    const updates: { title?: string; data?: any; orderIndex?: number } = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.data !== undefined) updates.data = body.data;
    if (body.orderIndex !== undefined) updates.orderIndex = body.orderIndex;

    const updated = await updateProjectChartDB(chartId, updates);

    // Also update on disk
    try {
      const diskPath = path.join(CHARTS_DIR, `proj_${targetProjId}_${chartId}.json`);
      if (updated) {
        fs.writeFileSync(diskPath, JSON.stringify(updated, null, 2), 'utf-8');
      }
    } catch {}

    if (updated) {
      broadcastRealtimeEvent({
        type: 'CHART_UPDATED',
        projectId: String(targetProjId),
        payload: updated,
        senderSessionId: (session as any).id,
      });
    }

    return NextResponse.json({ chart: updated });
  } catch (error: any) {
    console.error('[PUT /api/projects/[id]/charts/[chartId] error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/charts/[chartId]
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; chartId: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const { id: rawProjectId, chartId } = resolvedParams;

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

    await deleteProjectChartDB(chartId);

    // Remove from disk if exists
    try {
      const diskPath = path.join(CHARTS_DIR, `proj_${targetProjId}_${chartId}.json`);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch {}

    try {
      await logHistory({
        projectId: targetProjId,
        userId: session.id,
        userName: session.name || 'User',
        userAvatar: (session as any).avatar,
        action: 'chart_deleted',
        entityType: 'chart',
        entityId: chartId,
        entityTitle: 'Chart',
        senderSessionId: session.id,
      });
    } catch {}

    broadcastRealtimeEvent({
      type: 'CHART_DELETED',
      projectId: String(targetProjId),
      payload: { id: chartId },
      senderSessionId: (session as any).id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/projects/[id]/charts/[chartId] error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
