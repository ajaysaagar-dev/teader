require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://ajaysaagar:aass209c@178.238.226.206:5432/ajaysaagar';

const pool = new Pool({
  connectionString,
  ssl: false,
});

async function main() {
  console.log('Connecting to PostgreSQL database...');

  // 1. Find all users matching ajaysaagar or dev
  const userRes = await pool.query(
    `SELECT id, name, email FROM "users" 
     WHERE name ILIKE '%ajaysaagar%' OR email ILIKE '%ajaysaagar%' 
        OR name ILIKE '%dev%' OR email ILIKE '%dev%'`
  );
  console.log('Found matching users:', userRes.rows);

  const userIds = userRes.rows.map((u) => u.id);

  if (userIds.length > 0) {
    // 2. Remove from project_members table
    const delMembers = await pool.query(
      `DELETE FROM "project_members" WHERE "userId" = ANY($1::int[]) RETURNING *`,
      [userIds]
    );
    console.log(`✓ Removed ${delMembers.rowCount} membership records from project_members`);

    // 3. Remove projects owned or created by these users (and CASCADE will delete their tasks/subtasks/docs)
    const delProjects = await pool.query(
      `DELETE FROM "projects" WHERE "owner_id" = ANY($1::int[]) OR "creatorId" = ANY($2::int[]) RETURNING id, key, name`,
      [userIds, userIds]
    );
    console.log(`✓ Removed ${delProjects.rowCount} owned/created projects:`, delProjects.rows);
  } else {
    console.log('No specific user rows found, checking all projects & memberships...');
    // In case projects have ownerName containing ajaysaagar or dev
    const delByName = await pool.query(
      `DELETE FROM "projects" WHERE "ownerName" ILIKE '%ajaysaagar%' OR "ownerName" ILIKE '%dev%' RETURNING id, key, name`
    );
    console.log(`✓ Removed ${delByName.rowCount} projects by ownerName:`, delByName.rows);
  }

  // 4. Report remaining projects and members in DB
  const remainingProj = await pool.query(`SELECT id, key, name, owner_id, "creatorId", "ownerName" FROM "projects"`);
  console.log('\n--- Remaining Projects in Database ---');
  console.table(remainingProj.rows);

  const remainingMem = await pool.query(`SELECT * FROM "project_members"`);
  console.log('Remaining Project Members count:', remainingMem.rowCount);

  await pool.end();
  console.log('\n🎉 Finished removing all owner and member projects for ajaysaagar / dev.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
