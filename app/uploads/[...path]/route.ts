import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Common MIME types for uploads
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    if (!segments || segments.length === 0) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Prevent directory traversal
    const safeSegments = segments.filter((s) => !s.includes('..') && !s.includes('/') && !s.includes('\\'));
    const relativePath = safeSegments.join(path.sep);

    // Check primary public uploads folder and possible fallback paths
    const candidates = [
      path.join(process.cwd(), 'public', 'uploads', relativePath),
      path.join(process.cwd(), 'teader', 'public', 'uploads', relativePath),
    ];

    let foundPath: string | null = null;
    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        foundPath = cand;
        break;
      }
    }

    if (!foundPath) {
      return new NextResponse('File Not Found', { status: 404 });
    }

    const ext = path.extname(foundPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(foundPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('[Upload Serve Route Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
