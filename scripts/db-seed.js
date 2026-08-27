const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DB_HOST = process.env.POSTGRES_HOST || process.env.MYSQL_HOST || '178.238.226.206';
const DB_USER = process.env.POSTGRES_USER || process.env.MYSQL_USER || 'ajaysaagar';
const DB_PASSWORD = process.env.POSTGRES_PASSWORD || process.env.MYSQL_PASSWORD || 'aass209c';
const DB_NAME = process.env.POSTGRES_DATABASE || process.env.MYSQL_DATABASE || 'ajaysaagar';
const DB_PORT = Number(process.env.POSTGRES_PORT || process.env.MYSQL_PORT) || 5432;
const DATABASE_URL = process.env.DATABASE_URL;

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

async function seed() {
  console.log('--- Teader PostgreSQL Database Schema & Seed Migration ---');

  const pool = new Pool(
    DATABASE_URL && DATABASE_URL.startsWith('postgres')
      ? { connectionString: DATABASE_URL }
      : {
          host: DB_HOST,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
          port: DB_PORT,
          connectionTimeoutMillis: 10000,
        }
  );

  try {
    console.log(`Connecting to PostgreSQL at ${DB_HOST}:${DB_PORT}/${DB_NAME}...`);

    // Clean drop old tables in correct dependency order
    console.log('Dropping existing tables for clean schema migration...');
    await pool.query(`DROP TABLE IF EXISTS "images" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "subtasks" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "issue_labels" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "labels" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "comments" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "activities" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "project_docs" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "issues" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "project_members" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "sprints" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "projects" CASCADE;`);
    await pool.query(`DROP TABLE IF EXISTS "users" CASCADE;`);

    // 1. Create Users Table
    console.log('Creating "users" table...');
    await pool.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password" VARCHAR(255) NOT NULL,
        "avatar" VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create Projects Table
    console.log('Creating "projects" table...');
    await pool.query(`
      CREATE TABLE "projects" (
        "id" SERIAL PRIMARY KEY,
        "key" VARCHAR(64) NOT NULL UNIQUE,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "owner_id" INT NOT NULL DEFAULT 1,
        "creatorId" INT DEFAULT 1,
        "ownerName" VARCHAR(128) DEFAULT 'karri',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create Project Members Table
    console.log('Creating "project_members" table...');
    await pool.query(`
      CREATE TABLE "project_members" (
        "id" SERIAL PRIMARY KEY,
        "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "userId" INT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role" VARCHAR(32) NOT NULL DEFAULT 'member',
        "joinedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "unique_user_project" UNIQUE ("projectId", "userId")
      );
    `);

    // 4. Create Issues Table
    console.log('Creating "issues" table...');
    await pool.query(`
      CREATE TABLE "issues" (
        "id" VARCHAR(64) PRIMARY KEY,
        "key" VARCHAR(64) NOT NULL UNIQUE,
        "title" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "status" VARCHAR(32) NOT NULL DEFAULT 'todo',
        "priority" VARCHAR(32) NOT NULL DEFAULT 'medium',
        "assigneeName" VARCHAR(128) DEFAULT 'General (Anyone)',
        "assigneeAvatar" VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        "reporterName" VARCHAR(128) DEFAULT 'karri',
        "reporterAvatar" VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        "labels" TEXT,
        "sprint" VARCHAR(64) DEFAULT 'Sprint 24.3',
        "epic" VARCHAR(128) DEFAULT 'Platform Core',
        "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "project" VARCHAR(128) DEFAULT 'Teader Platform Core',
        "dueDate" VARCHAR(64),
        "estimatedHours" NUMERIC(6, 2) DEFAULT 0,
        "loggedHours" NUMERIC(6, 2) DEFAULT 0,
        "isFavorite" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Create Subtasks Table
    console.log('Creating "subtasks" table...');
    await pool.query(`
      CREATE TABLE "subtasks" (
        "id" VARCHAR(64) PRIMARY KEY,
        "issueId" VARCHAR(64) NOT NULL,
        "parentId" VARCHAR(64) DEFAULT NULL,
        "title" VARCHAR(255) NOT NULL,
        "completed" BOOLEAN DEFAULT FALSE,
        "isFolder" BOOLEAN DEFAULT FALSE,
        "type" VARCHAR(32) DEFAULT 'subtask',
        "imageId" VARCHAR(64) DEFAULT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Create Images Table
    console.log('Creating "images" table...');
    await pool.query(`
      CREATE TABLE "images" (
        "id" VARCHAR(64) PRIMARY KEY,
        "fileName" VARCHAR(255) NOT NULL,
        "filePath" VARCHAR(512) NOT NULL,
        "url" VARCHAR(512) NOT NULL,
        "taskId" VARCHAR(64) DEFAULT NULL,
        "subtaskId" VARCHAR(64) DEFAULT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Create Project Docs Table
    console.log('Creating "project_docs" table...');
    await pool.query(`
      CREATE TABLE "project_docs" (
        "id" VARCHAR(64) PRIMARY KEY,
        "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "userId" INT DEFAULT 1,
        "userName" VARCHAR(128) DEFAULT 'karri',
        "title" VARCHAR(255) NOT NULL,
        "fileName" VARCHAR(255) NOT NULL UNIQUE,
        "filePath" VARCHAR(512) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert Users
    console.log('Seeding initial users...');
    const defaultPasswordHash = hashPassword('password123');
    await pool.query(
      `INSERT INTO "users" ("name", "email", "password", "avatar") VALUES ($1, $2, $3, $4)`,
      ['karri', 'karri@teader.io', defaultPasswordHash, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80']
    );
    await pool.query(
      `INSERT INTO "users" ("name", "email", "password", "avatar") VALUES ($1, $2, $3, $4)`,
      ['jori', 'jori@teader.io', defaultPasswordHash, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80']
    );
    await pool.query(
      `INSERT INTO "users" ("name", "email", "password", "avatar") VALUES ($1, $2, $3, $4)`,
      ['ajaysaagar', 'ajaysaagar@teader.io', defaultPasswordHash, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80']
    );

    // Insert Projects
    console.log('Seeding projects & members...');
    const projRes = await pool.query(
      `INSERT INTO "projects" ("key", "name", "description", "owner_id", "creatorId", "ownerName")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
      ['TDR', 'Teader Platform Core', 'Core project management platform workspace with PostgreSQL database integration.', 1, 1, 'karri']
    );
    const p1Id = projRes.rows[0].id;

    await pool.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 1, 'owner')`, [p1Id]);
    await pool.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 2, 'member')`, [p1Id]);
    await pool.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 3, 'admin')`, [p1Id]);

    // Insert Issues
    console.log('Seeding issues & nested folders...');
    const issues = [
      {
        id: 'iss_1',
        key: 'TDR-101',
        title: 'PostgreSQL Connection Pooling & High-Availability Integration',
        description: 'Provision and configure PostgreSQL connection pooling with prepared statements and SSL.',
        status: 'done',
        priority: 'critical',
        assigneeName: 'karri',
        reporterName: 'karri',
        labels: '["Database", "PostgreSQL", "Backend"]',
        estimatedHours: 6,
        loggedHours: 6,
      },
      {
        id: 'iss_2',
        key: 'TDR-102',
        title: 'Interactive DAG Dependency Graph Visualization Tab',
        description: 'Render DAG graph with SVG bezier curves showing task blockers and downstream dependencies.',
        status: 'in_progress',
        priority: 'high',
        assigneeName: 'ajaysaagar',
        reporterName: 'karri',
        labels: '["Graph", "Frontend", "UI"]',
        estimatedHours: 5,
        loggedHours: 3.5,
      },
      {
        id: 'iss_3',
        key: 'TDR-103',
        title: 'Multi-Document Server Markdown Hub & Specs Editor',
        description: 'Save and switch between physical .md files stored directly on the server filesystem.',
        status: 'in_progress',
        priority: 'medium',
        assigneeName: 'jori',
        reporterName: 'karri',
        labels: '["Docs", "Markdown", "Wiki"]',
        estimatedHours: 4,
        loggedHours: 2,
      },
      {
        id: 'iss_4',
        key: 'TDR-104',
        title: 'Automated Workflow Engine with Trigger-Action Rules',
        description: 'Configurable project automations: auto-complete subtasks, auto-assign, and escalate priorities.',
        status: 'todo',
        priority: 'medium',
        assigneeName: 'General (Anyone)',
        reporterName: 'karri',
        labels: '["Automations", "Rules"]',
        estimatedHours: 3,
        loggedHours: 0,
      },
    ];

    for (const iss of issues) {
      await pool.query(
        `INSERT INTO "issues" ("id", "key", "title", "description", "status", "priority", "assigneeName", "reporterName", "projectId", "project", "labels", "estimatedHours", "loggedHours")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [iss.id, iss.key, iss.title, iss.description, iss.status, iss.priority, iss.assigneeName, iss.reporterName, p1Id, 'Teader Platform Core', iss.labels, iss.estimatedHours, iss.loggedHours]
      );
    }

    // Insert Nested Subtasks and Folders
    console.log('Seeding nested tree subtasks...');
    await pool.query(
      `INSERT INTO "subtasks" ("id", "issueId", "parentId", "title", "completed", "isFolder", "type")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['sub_f1', 'iss_1', null, '📁 Database Infrastructure', true, true, 'folder']
    );
    await pool.query(
      `INSERT INTO "subtasks" ("id", "issueId", "parentId", "title", "completed", "isFolder", "type")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['sub_c1', 'iss_1', 'sub_f1', 'Configure pg.Pool connection settings', true, false, 'subtask']
    );
    await pool.query(
      `INSERT INTO "subtasks" ("id", "issueId", "parentId", "title", "completed", "isFolder", "type")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['sub_c2', 'iss_1', 'sub_f1', 'Verify primary keys & foreign key constraints', true, false, 'subtask']
    );

    console.log('✓ PostgreSQL Database Schema & Seed Migration Completed Successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
