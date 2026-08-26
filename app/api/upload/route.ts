import { NextResponse } from 'next/server';
import { saveImageMetadataDB } from '@/lib/db';
import { getSessionFromCookie } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Magic bytes for allowed image types
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (webp)
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
};

function detectMimeFromBuffer(buf: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => buf[i] === byte)) {
        // Extra WEBP check: bytes 8-11 should be "WEBP"
        if (mime === 'image/webp') {
          const marker = buf.slice(8, 12).toString('ascii');
          if (marker !== 'WEBP') continue;
        }
        return mime;
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  // Require auth
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const taskId = (formData.get('taskId') as string) || '';
    const subtaskId = (formData.get('subtaskId') as string) || '';
    const rawTaskName = (formData.get('taskName') as string) || 'task';

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Size cap
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 413 });
    }

    // MIME allowlist check (client-provided)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed. Only PNG, JPEG, WebP, and GIF images are accepted.' }, { status: 415 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic bytes verification (actual content, not just extension)
    const detectedMime = detectMimeFromBuffer(buffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return NextResponse.json({ error: 'File content does not match an allowed image type.' }, { status: 415 });
    }

    // Sanitize task name for file naming
    const cleanTaskName = rawTaskName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);

    // Use detected MIME to determine extension (not client-supplied)
    const extMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    const ext = extMap[detectedMime] || '.png';

    const imageId = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const fileName = `image_${imageId}_${cleanTaskName}${ext}`;

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${fileName}`;

    const savedRecord = await saveImageMetadataDB(
      imageId,
      fileName,
      filePath,
      publicUrl,
      taskId,
      subtaskId
    );

    return NextResponse.json(savedRecord);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
