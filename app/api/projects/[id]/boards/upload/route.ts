import { NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/authz';
import { getProjectByIdDB } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'boards');
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB max for audio/video/images

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolvedParams = await params;
  const rawProjectId = resolvedParams.id;

  try {
    const project = await getProjectByIdDB(rawProjectId);
    const targetProjId = project ? project.id : Number(rawProjectId) || 1;

    try {
      await assertProjectAccess(session.id, targetProjId);
    } catch (err: any) {
      const status = err.status || 403;
      return NextResponse.json({ error: err.message }, { status });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No media file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File size exceeds 100 MB limit' }, { status: 413 });
    }

    ensureUploadsDir();

    // Sanitize filename
    const origName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(origName) || '.bin';
    const base = path.basename(origName, ext).slice(0, 32);
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}${ext}`;
    const destinationPath = path.join(UPLOADS_DIR, uniqueFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destinationPath, buffer);

    const publicUrl = `/uploads/boards/${uniqueFileName}`;

    return NextResponse.json({
      url: publicUrl,
      filename: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    });
  } catch (error: any) {
    console.error('[POST /api/projects/[id]/boards/upload error]:', error);
    return NextResponse.json({ error: error.message || 'File upload failed' }, { status: 500 });
  }
}
