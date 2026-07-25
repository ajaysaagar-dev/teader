import { NextResponse } from 'next/server';
import { saveImageMetadataDB } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const taskId = (formData.get('taskId') as string) || '';
    const subtaskId = (formData.get('subtaskId') as string) || '';
    const rawTaskName = (formData.get('taskName') as string) || 'task';

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize Task Name for file naming
    const cleanTaskName = rawTaskName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);

    const ext = path.extname(file.name) || '.png';
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
