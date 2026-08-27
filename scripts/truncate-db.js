require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://ajaysaagar:aass209c@178.238.226.206:5432/ajaysaagar';

const pool = new Pool({
  connectionString,
  ssl: false,
});

async function truncateAll() {
  console.log('Connecting to PostgreSQL database:', connectionString.replace(/:[^:@]+@/, ':****@'));
  const tables = [
    'project_messages',
    'project_docs',
    'automations',
    'images',
    'subtasks',
    'issues',
    'project_members',
    'projects',
    'users',
  ];

  for (const table of tables) {
    try {
      await pool.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
      console.log(`✓ Truncated table "${table}" (identity restarted)`);
    } catch (err) {
      console.warn(`! Note on "${table}":`, err.message);
    }
  }

  // Double check remaining rows across all tables
  console.log('\n--- Row Counts After Truncate ---');
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) as count FROM "${table}";`);
      console.log(`Table "${table}": ${res.rows[0].count} rows`);
    } catch (err) {
      console.warn(`Could not count table "${table}":`, err.message);
    }
  }

  await pool.end();
  console.log('\n🎉 Successfully removed all rows from all database tables.');
}

truncateAll().catch((err) => {
  console.error('Fatal error during truncate:', err);
  process.exit(1);
});
