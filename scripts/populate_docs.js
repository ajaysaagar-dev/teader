const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '178.238.226.206',
  user: process.env.POSTGRES_USER || 'ajaysaagar',
  password: process.env.POSTGRES_PASSWORD || 'aass209c',
  database: process.env.POSTGRES_DATABASE || 'ajaysaagar',
  port: 5432,
  connectionTimeoutMillis: 5000,
});

const docsDir = path.join(process.cwd(), 'data', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// 1. Read UVC content
let uvcContent = '';
const uvcPath1 = path.join(process.cwd(), 'UVC.md');
const uvcPath2 = path.join(process.cwd(), '..', 'UVC.md');
const devPath = path.join(process.cwd(), '..', 'dev.md');

if (fs.existsSync(uvcPath1)) uvcContent = fs.readFileSync(uvcPath1, 'utf8');
else if (fs.existsSync(uvcPath2)) uvcContent = fs.readFileSync(uvcPath2, 'utf8');
else if (fs.existsSync(devPath)) uvcContent = fs.readFileSync(devPath, 'utf8');

// 2. Read Out / Architecture content
let archContent = '';
const outPath = path.join(process.cwd(), '..', 'out.md');
const formatPath = path.join(process.cwd(), '..', 'format.md');

if (fs.existsSync(outPath)) archContent = fs.readFileSync(outPath, 'utf8');
else if (fs.existsSync(formatPath)) archContent = fs.readFileSync(formatPath, 'utf8');

console.log('uvcContent len:', uvcContent.length);
console.log('archContent len:', archContent.length);

(async () => {
  try {
    await pool.query('ALTER TABLE "project_docs" ADD COLUMN IF NOT EXISTS "content" TEXT;');

    // Update doc_1787845578398_6288 (UVC - 01)
    const file1 = 'proj_11_usr_13_doc_1787845578398_6288_uvc_01.md';
    const path1 = path.join(docsDir, file1);
    fs.writeFileSync(path1, uvcContent, 'utf8');
    await pool.query('UPDATE "project_docs" SET "content" = $1, "filePath" = $2 WHERE "id" = $3', [uvcContent, path1, 'doc_1787845578398_6288']);
    console.log('Updated UVC - 01 doc with actual content on disk and DB!');

    // Update doc_1787843809703_init (Luzzy Basic Structure)
    const file2 = 'proj_11_usr_13_doc_1787843809703_init_architecture_specs.md';
    const path2 = path.join(docsDir, file2);
    fs.writeFileSync(path2, archContent, 'utf8');
    await pool.query('UPDATE "project_docs" SET "content" = $1, "filePath" = $2 WHERE "id" = $3', [archContent, path2, 'doc_1787843809703_init']);
    console.log('Updated Luzzy Basic Structure doc with actual content on disk and DB!');

    // Also write any other existing docs to disk
    const all = await pool.query('SELECT * FROM "project_docs";');
    for (const r of all.rows) {
      if (r.content && r.fileName) {
        const dest = path.join(docsDir, r.fileName);
        fs.writeFileSync(dest, r.content, 'utf8');
      }
    }

    console.log('All docs synced successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
