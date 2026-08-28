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

(async () => {
  try {
    await pool.query('ALTER TABLE "project_docs" ADD COLUMN IF NOT EXISTS "content" TEXT;');
    console.log('Ensured content column in project_docs');

    const res = await pool.query('SELECT "id", "projectId", "title", "fileName", "filePath", "content" FROM "project_docs";');
    console.log('Total docs in DB:', res.rows.length);
    for (const r of res.rows) {
      const localPath = path.join(docsDir, r.fileName);
      let localContent = null;
      if (fs.existsSync(localPath)) {
        localContent = fs.readFileSync(localPath, 'utf8');
      } else if (r.filePath && fs.existsSync(r.filePath)) {
        localContent = fs.readFileSync(r.filePath, 'utf8');
      }

      if (localContent) {
        await pool.query('UPDATE "project_docs" SET "content" = $1 WHERE "id" = $2', [localContent, r.id]);
        console.log('Synced content from disk for doc ' + r.id);
      }
      console.log('- Doc ' + r.id + ' (' + r.title + ') file=' + r.fileName + ' content_len=' + (r.content ? r.content.length : (localContent ? localContent.length : 0)));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
