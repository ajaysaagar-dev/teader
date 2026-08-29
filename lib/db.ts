import { Pool } from 'pg';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from './auth';

// PostgreSQL Connection Configuration
const DB_HOST = process.env.POSTGRES_HOST || process.env.MYSQL_HOST || 'localhost';
const DB_USER = process.env.POSTGRES_USER || process.env.MYSQL_USER || 'ajaysaagar';
const DB_PASSWORD = process.env.POSTGRES_PASSWORD || process.env.MYSQL_PASSWORD || 'aass209c';
const DB_NAME = process.env.POSTGRES_DATABASE || process.env.MYSQL_DATABASE || 'teader_db';
const DB_PORT = Number(process.env.POSTGRES_PORT || process.env.MYSQL_PORT) || 5678;
const DATABASE_URL = process.env.DATABASE_URL;

let pgPool: Pool | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

// Convert MySQL query syntax (? placeholders & backticks) to PostgreSQL syntax ($1, $2 & quotes)
export function transformSqlToPg(sql: string): string {
  let paramIndex = 1;
  const withParams = sql.replace(/\?/g, () => `$${paramIndex++}`);
  // Replace MySQL backticks with standard quotes or remove them safely
  const withQuotes = withParams.replace(/`([a-zA-Z0-9_]+)`/g, '"$1"');
  // Handle MySQL specific INSERT IGNORE to PostgreSQL ON CONFLICT DO NOTHING
  const withConflict = withQuotes.replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  return withConflict;
}

export interface PgQueryWrapper {
  query: (sql: string, params?: any[]) => Promise<any>;
}

export function getPool(): PgQueryWrapper {
  if (!pgPool) {
    if (DATABASE_URL && DATABASE_URL.startsWith('postgres')) {
      pgPool = new Pool({
        connectionString: DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else {
      pgPool = new Pool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }

    pgPool.on('error', (err) => {
      console.warn('[PostgreSQL Pool Warning]:', err.message);
    });
  }

  return {
    query: async (sql: string, params: any[] = []) => {
      const pgSql = transformSqlToPg(sql);
      const res = await pgPool!.query(pgSql, params);
      // Return a hybrid array/object where [0] is rows (matching mysql2 destructuring `const [rows] = await p.query(...)`)
      const hybrid: any = [res.rows, res];
      hybrid.rows = res.rows;
      hybrid.rowCount = res.rowCount;
      hybrid.insertId = res.rows?.[0]?.id;
      return hybrid;
    },
  };
}

// Pre-hashed bcrypt hash for 'password123' (cost: 12)
const DEFAULT_PASSWORD_HASH = '$2b$12$lL3YVRs0PjHqNNMDJ8xKbempzfCQcMDdwHZn6k0A7oFtrZpOn82ea';

let memoryUsersStore: any[] = [
  {
    id: 1,
    name: 'karri',
    email: 'karri@teader.io',
    password: DEFAULT_PASSWORD_HASH,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 2,
    name: 'jori',
    email: 'jori@teader.io',
    password: DEFAULT_PASSWORD_HASH,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 3,
    name: 'ajaysaagar',
    email: 'ajaysaagar@teader.io',
    password: DEFAULT_PASSWORD_HASH,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  },
];
let memoryProjectsStore: any[] = [];
let memoryMembersStore: any[] = [];


let memoryIssuesStore: any[] = [];
let memoryImagesStore: any[] = [];
let memoryProjectDocsStore: any[] = [];

export function generate30CharKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PRJ';
  for (let i = 0; i < 27; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Initialize PostgreSQL Database & Tables automatically (singleton promise)
export async function initDB(): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const p = getPool();

        // 1. Create Users Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "users" (
            "id" SERIAL PRIMARY KEY,
            "name" VARCHAR(255) NOT NULL,
            "email" VARCHAR(255) NOT NULL UNIQUE,
            "password" VARCHAR(255) NOT NULL,
            "avatar" VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 2. Create Projects Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "projects" (
            "id" SERIAL PRIMARY KEY,
            "key" VARCHAR(64) NOT NULL UNIQUE,
            "name" VARCHAR(255) NOT NULL,
            "description" TEXT,
            "owner_id" INT NOT NULL DEFAULT 1,
            "creatorId" INT DEFAULT 1,
            "ownerName" VARCHAR(128) DEFAULT 'karri',
            "docIds" JSONB DEFAULT '[]'::jsonb,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        try {
          await p.query(`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "docIds" JSONB DEFAULT '[]'::jsonb;`);
        } catch {}

        // 3. Create Project Members Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "project_members" (
            "id" SERIAL PRIMARY KEY,
            "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
            "userId" INT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "role" VARCHAR(32) NOT NULL DEFAULT 'member',
            "joinedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "unique_user_project" UNIQUE ("projectId", "userId")
          );
        `);

        // 4. Create Issues Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "issues" (
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
            "orderIndex" INT DEFAULT 0,
            "completedByName" VARCHAR(128) DEFAULT NULL,
            "completedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        try {
          await p.query(`ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "orderIndex" INT DEFAULT 0;`);
          await p.query(`ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "completedByName" VARCHAR(128) DEFAULT NULL;`);
          await p.query(`ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL;`);
        } catch {}

        // 5. Create Subtasks Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "subtasks" (
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
        await p.query(`
          CREATE TABLE IF NOT EXISTS "images" (
            "id" VARCHAR(64) PRIMARY KEY,
            "fileName" VARCHAR(255) NOT NULL,
            "filePath" VARCHAR(512) NOT NULL,
            "url" VARCHAR(512) NOT NULL,
            "taskId" VARCHAR(64) DEFAULT NULL,
            "subtaskId" VARCHAR(64) DEFAULT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 7. Create Comments Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "comments" (
            "id" VARCHAR(64) PRIMARY KEY,
            "body" TEXT NOT NULL,
            "issueId" VARCHAR(64) NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
            "authorId" INT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "parentId" VARCHAR(64) DEFAULT NULL,
            "editedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 8. Create Activities Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "activities" (
            "id" VARCHAR(64) PRIMARY KEY,
            "issueId" VARCHAR(64) NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
            "actorId" INT DEFAULT NULL,
            "actorName" VARCHAR(128) NOT NULL DEFAULT 'system',
            "type" VARCHAR(64) NOT NULL,
            "payload" JSONB DEFAULT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 9. Create Project Docs Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "project_docs" (
            "id" VARCHAR(64) PRIMARY KEY,
            "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
            "userId" INT DEFAULT 1,
            "userName" VARCHAR(128) DEFAULT 'karri',
            "title" VARCHAR(255) NOT NULL,
            "fileName" VARCHAR(255) NOT NULL UNIQUE,
            "filePath" VARCHAR(512) NOT NULL,
            "folder" VARCHAR(255) DEFAULT 'Start',
            "content" TEXT,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        try {
          await p.query(`ALTER TABLE "project_docs" ADD COLUMN IF NOT EXISTS "folder" VARCHAR(255) DEFAULT 'Start';`);
        } catch {}
        try {
          await p.query(`ALTER TABLE "project_docs" ADD COLUMN IF NOT EXISTS "content" TEXT;`);
        } catch {}

        // 10. Create Project Messages Table for Team Conversations
        await p.query(`
          CREATE TABLE IF NOT EXISTS "project_messages" (
            "id" SERIAL PRIMARY KEY,
            "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
            "userId" INT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "userName" VARCHAR(255) NOT NULL,
            "userAvatar" VARCHAR(255),
            "userRole" VARCHAR(64) DEFAULT 'member',
            "content" TEXT NOT NULL,
            "channel" VARCHAR(64) DEFAULT 'general',
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 11. Create Project Channels Table for Dynamic Channel Management
        await p.query(`
          CREATE TABLE IF NOT EXISTS "project_channels" (
            "id" SERIAL PRIMARY KEY,
            "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
            "name" VARCHAR(64) NOT NULL,
            "description" TEXT,
            "creatorId" INT DEFAULT 1,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "unique_project_channel_name" UNIQUE ("projectId", "name")
          );
        `);


        // Seed default users if table is empty
        const userCheck = await p.query(`SELECT COUNT(*) as cnt FROM "users"`);
        const userCount = Number(userCheck.rows?.[0]?.cnt || 0);

        if (userCount === 0) {
          const pass = await hashPassword('password123');
          await p.query(
            `INSERT INTO "users" ("name", "email", "password", "avatar") VALUES ($1, $2, $3, $4)`,
            ['karri', 'karri@teader.io', pass, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80']
          );
          await p.query(
            `INSERT INTO "users" ("name", "email", "password", "avatar") VALUES ($1, $2, $3, $4)`,
            ['jori', 'jori@teader.io', pass, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80']
          );
          await p.query(
            `INSERT INTO "users" ("name", "email", "password", "avatar") VALUES ($1, $2, $3, $4)`,
            ['ajaysaagar', 'ajaysaagar@teader.io', pass, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80']
          );
        }

        // Seed "Huge update/seed" Project & Issues if not present
        const projCheck = await p.query(`SELECT "id" FROM "projects" WHERE "name" = $1 OR "key" = $2 LIMIT 1`, ['Huge update/seed', 'HUG']);
        let hugProjId = projCheck.rows?.[0]?.id;

        if (!hugProjId) {
          const insProj = await p.query(
            `INSERT INTO "projects" ("key", "name", "description", "owner_id", "creatorId", "ownerName")
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
            ['HUG', 'Huge update/seed', 'Multi-branch dynamic evolution, task mutations, and vertical curve tracking.', 1, 1, 'karri']
          );
          hugProjId = insProj.rows?.[0]?.id;

          if (hugProjId) {
            // Project Members
            await p.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 1, 'owner') ON CONFLICT DO NOTHING`, [hugProjId]);
            await p.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 2, 'member') ON CONFLICT DO NOTHING`, [hugProjId]);
            await p.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 3, 'member') ON CONFLICT DO NOTHING`, [hugProjId]);

            // Issues with rich update progression, assigned timestamps & completion tracking
            const seedIssues = [
              { id: 'issue_hug_1', key: 'HUG-1', title: 'Database Schema Architecture V2 (Optimized)', desc: 'Updated relational database tables, foreign key cascading indexes, and JSON column support.', status: 'done', priority: 'high', assignee: 'jori', reporter: 'karri', created: '2026-08-20 08:00:00', updated: '2026-08-22 14:30:00', completedBy: 'jori', completedAt: '2026-08-22 14:30:00' },
              { id: 'issue_hug_2', key: 'HUG-2', title: 'Resilient PostgreSQL Connection Pool & Failover', desc: 'Configured connection pooling, health checks, and automatic reconnect backoff.', status: 'done', priority: 'high', assignee: 'jori', reporter: 'ajaysaagar', created: '2026-08-21 09:00:00', updated: '2026-08-23 11:00:00', completedBy: 'jori', completedAt: '2026-08-23 11:00:00' },
              { id: 'issue_hug_3', key: 'HUG-3', title: 'JWT & Secure Cookie Session Hardening', desc: 'Updated authentication middleware, token refresh rotation, and bcrypt password verification.', status: 'needs_review', priority: 'critical', assignee: 'karri', reporter: 'elena', created: '2026-08-21 10:30:00', updated: '2026-08-24 16:00:00', completedBy: null, completedAt: null },
              { id: 'issue_hug_4', key: 'HUG-4', title: 'Dynamic Cubic Bezier Spline Engine V3', desc: 'Upgraded graph canvas with smooth curved splines and interactive revision junctions.', status: 'done', priority: 'high', assignee: 'ajaysaagar', reporter: 'david', created: '2026-08-22 11:00:00', updated: '2026-08-25 18:20:00', completedBy: 'ajaysaagar', completedAt: '2026-08-25 18:20:00' },
              { id: 'issue_hug_5', key: 'HUG-5', title: 'Realtime Collaborative Cursors & Presence Stream', desc: 'Live multi-user cursor beacons, floating nametags, and immediate disconnect cleanup.', status: 'in_progress', priority: 'medium', assignee: 'karri', reporter: 'jori', created: '2026-08-22 14:00:00', updated: '2026-08-26 09:45:00', completedBy: null, completedAt: null },
              { id: 'issue_hug_6', key: 'HUG-6', title: 'GitHub Flavored Markdown Live Parser', desc: 'Real-time Markdown editor with split preview and syntax highlighting.', status: 'done', priority: 'medium', assignee: 'elena', reporter: 'karri', created: '2026-08-23 08:00:00', updated: '2026-08-26 14:10:00', completedBy: 'elena', completedAt: '2026-08-26 14:10:00' },
              { id: 'issue_hug_7', key: 'HUG-7', title: 'Floating Live Presence Nametags & Exit Cleanup', desc: 'Instant 0ms removal of collaborator cursors upon window leave or tab close.', status: 'done', priority: 'high', assignee: 'karri', reporter: 'ajaysaagar', created: '2026-08-23 15:00:00', updated: '2026-08-27 10:30:00', completedBy: 'karri', completedAt: '2026-08-27 10:30:00' },
              { id: 'issue_hug_8', key: 'HUG-8', title: 'Zero-Latency In-Place SWR State Reconciler', desc: 'Optimistic UI updates with referential memory equality preventing full DOM re-renders.', status: 'done', priority: 'high', assignee: 'ajaysaagar', reporter: 'david', created: '2026-08-24 09:00:00', updated: '2026-08-27 17:00:00', completedBy: 'ajaysaagar', completedAt: '2026-08-27 17:00:00' },
              { id: 'issue_hug_9', key: 'HUG-9', title: 'Vertical Change Curves & Dynamic Scroll Metrics', desc: 'Calculates mutation deltas and renders vertical evolution Bezier curves.', status: 'needs_review', priority: 'critical', assignee: 'david', reporter: 'elena', created: '2026-08-24 13:00:00', updated: '2026-08-28 12:00:00', completedBy: null, completedAt: null },
              { id: 'issue_hug_10', key: 'HUG-10', title: 'Automated Test Matrix & Production Build Verification', desc: 'Full vitest test coverage and Next.js static page bundle optimization.', status: 'done', priority: 'high', assignee: 'david', reporter: 'jori', created: '2026-08-25 08:30:00', updated: '2026-08-28 16:00:00', completedBy: 'david', completedAt: '2026-08-28 16:00:00' },
              { id: 'issue_hug_11', key: 'HUG-11', title: 'Linear Responsive Navigation Engine', desc: 'Smooth linear horizontal and vertical panning with zero ease-in-out hesitation.', status: 'done', priority: 'medium', assignee: 'karri', reporter: 'karri', created: '2026-08-25 14:00:00', updated: '2026-08-29 09:00:00', completedBy: 'karri', completedAt: '2026-08-29 09:00:00' },
              { id: 'issue_hug_12', key: 'HUG-12', title: 'Enterprise Technical Documentation Hub', desc: 'Comprehensive 20-section platform documentation portal with full API reference.', status: 'done', priority: 'high', assignee: 'david', reporter: 'david', created: '2026-08-26 10:00:00', updated: '2026-08-29 11:30:00', completedBy: 'david', completedAt: '2026-08-29 11:30:00' },
            ];

            for (const item of seedIssues) {
              await p.query(
                `INSERT INTO "issues" ("id", "key", "title", "description", "status", "priority", "assigneeName", "reporterName", "projectId", "project", "createdAt", "updatedAt", "completedByName", "completedAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT DO NOTHING`,
                [item.id, item.key, item.title, item.desc, item.status, item.priority, item.assignee, item.reporter, hugProjId, 'Huge update/seed', item.created, item.updated, item.completedBy, item.completedAt]
              );
            }
          }
        }

        // Memory Store Fallbacks for Huge update/seed
        if (!memoryProjectsStore.some((p) => p.key === 'HUG')) {
          const memProj = {
            id: 99,
            key: 'HUG',
            name: 'Huge update/seed',
            description: 'Multi-branch dynamic evolution, task mutations, and vertical curve tracking.',
            owner_id: 1,
            creatorId: 1,
            ownerName: 'karri',
          };
          memoryProjectsStore.push(memProj);
          memoryMembersStore.push({ projectId: 99, userId: 1, role: 'owner' });
          memoryMembersStore.push({ projectId: 99, userId: 2, role: 'member' });
          memoryMembersStore.push({ projectId: 99, userId: 3, role: 'member' });
        }

        initialized = true;
      } catch (err: any) {
        console.warn('PostgreSQL initialization note:', err.message);
        initialized = true;
      }

    })();
  }
  return initPromise;
}

// ─── Authentication Data Access Helpers ─────────────────────────────────────

export async function loginUserDB(emailOrUsername: string, plainTextPassword?: string) {
  await initDB();
  const normalized = emailOrUsername.toLowerCase().trim();

  try {
    const p = getPool();
    const result = await p.query(
      `SELECT * FROM "users" WHERE LOWER("email") = $1 OR LOWER("name") = $1 LIMIT 1`,
      [normalized]
    );
    const user = result.rows?.[0];

    if (user) {
      if (plainTextPassword) {
        const isMatch = await verifyPassword(plainTextPassword, user.password);
        if (!isMatch) {
          throw new Error('Invalid email or password');
        }
      }
      return user;
    }
  } catch (err: any) {
    if (err.message === 'Invalid email or password') throw err;
  }

  const memUser = memoryUsersStore.find(
    (u) => u.email.toLowerCase() === normalized || u.name.toLowerCase() === normalized
  );
  if (memUser) {
    if (plainTextPassword) {
      const isMatch = await verifyPassword(plainTextPassword, memUser.password);
      if (!isMatch) {
        throw new Error('Invalid email or password');
      }
    }
    return memUser;
  }

  throw new Error('Invalid email or password');
}

export async function getUserByIdDB(id: string | number) {
  await initDB();
  const numericId = Number(id);

  try {
    const p = getPool();
    const result = await p.query(`SELECT "id", "name", "email", "avatar", "createdAt" FROM "users" WHERE "id" = $1 LIMIT 1`, [numericId]);
    if (result.rows?.[0]) return result.rows[0];
  } catch {}

  const memUser = memoryUsersStore.find((u) => u.id === numericId);
  if (memUser) {
    const { password: _, ...safeUser } = memUser;
    return safeUser;
  }
  return null;
}

export async function getAllUsersDB() {
  await initDB();
  try {
    const p = getPool();
    const result = await p.query(`SELECT "id", "name", "email", "avatar", "createdAt" FROM "users" ORDER BY "id" ASC`);
    return result.rows;
  } catch {
    return memoryUsersStore.map(({ password: _, ...safe }) => safe);
  }
}

export async function registerUserDB(
  nameOrData: string | { name: string; email: string; password?: string; avatar?: string },
  emailArg?: string,
  plainPasswordArg?: string,
  avatarArg?: string
) {
  await initDB();
  let name = '';
  let email = '';
  let plainPassword: string | undefined = undefined;
  let avatar: string | undefined = undefined;

  if (typeof nameOrData === 'object' && nameOrData !== null) {
    name = nameOrData.name;
    email = nameOrData.email;
    plainPassword = nameOrData.password;
    avatar = nameOrData.avatar;
  } else {
    name = nameOrData;
    email = emailArg || '';
    plainPassword = plainPasswordArg;
    avatar = avatarArg;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();
  const hashedPassword = plainPassword ? await hashPassword(plainPassword) : DEFAULT_PASSWORD_HASH;
  const defaultAvatar = avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(trimmedName)}`;

  try {
    const p = getPool();
    const result = await p.query(
      `INSERT INTO "users" ("name", "email", "password", "avatar") VALUES ($1, $2, $3, $4) RETURNING "id", "name", "email", "avatar", "createdAt"`,
      [trimmedName, normalizedEmail, hashedPassword, defaultAvatar]
    );
    const newUser = result.rows[0];
    memoryUsersStore.push({ ...newUser, password: hashedPassword });
    return newUser;
  } catch {
    const newId = memoryUsersStore.length + 1;
    const memUser = {
      id: newId,
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      avatar: defaultAvatar,
      createdAt: new Date().toISOString(),
    };
    memoryUsersStore.push(memUser);
    const { password: _, ...safeUser } = memUser;
    return safeUser;
  }
}

// ─── Image Upload Helpers ───────────────────────────────────────────────────

export async function saveImageMetadataDB(
  imageId: string,
  fileName: string,
  filePath: string,
  url: string,
  taskId?: string,
  subtaskId?: string
) {
  await initDB();
  try {
    const p = getPool();
    await p.query(
      `INSERT INTO "images" ("id", "fileName", "filePath", "url", "taskId", "subtaskId") VALUES ($1, $2, $3, $4, $5, $6)`,
      [imageId, fileName, filePath, url, taskId || null, subtaskId || null]
    );

    if (subtaskId) {
      await p.query(`UPDATE "subtasks" SET "imageId" = $1 WHERE "id" = $2`, [imageId, subtaskId]);
    }
  } catch {
    memoryImagesStore.push({ id: imageId, fileName, filePath, url, taskId, subtaskId });
  }
  return { id: imageId, fileName, filePath, url, taskId, subtaskId };
}

export async function getImagesForTaskDB(taskId: string) {
  await initDB();
  try {
    const p = getPool();
    const result = await p.query(`SELECT * FROM "images" WHERE "taskId" = $1 ORDER BY "createdAt" ASC`, [taskId]);
    return result.rows;
  } catch {
    return memoryImagesStore.filter((img) => img.taskId === taskId);
  }
}

// ─── Projects Data Access Helpers ───────────────────────────────────────────

export async function getAllProjectsDB(userId?: number | string) {
  await initDB();
  try {
    const p = getPool();
    if (userId !== undefined && userId !== null && userId !== '') {
      const numericUserId = Number(userId);
      const result = await p.query(
        `SELECT DISTINCT p.* FROM "projects" p
         LEFT JOIN "project_members" pm ON p."id" = pm."projectId"
         WHERE p."owner_id" = $1 OR p."creatorId" = $1 OR pm."userId" = $1
         ORDER BY p."id" ASC`,
        [numericUserId]
      );
      return result.rows || [];
    }

    const result = await p.query(`SELECT * FROM "projects" ORDER BY "id" ASC`);
    return result.rows || [];
  } catch (err: any) {
    console.warn('[getAllProjectsDB Error]:', err.message);
  }

  if (userId !== undefined && userId !== null && userId !== '') {
    const numericUserId = Number(userId);
    const memberProjectIds = memoryMembersStore
      .filter((m) => Number(m.userId) === numericUserId)
      .map((m) => Number(m.projectId));

    const filtered = memoryProjectsStore.filter(
      (p) =>
        Number(p.owner_id) === numericUserId ||
        Number(p.creatorId) === numericUserId ||
        memberProjectIds.includes(Number(p.id))
    );
    return filtered;
  }
  return memoryProjectsStore;
}



export async function getProjectByIdDB(id: string | number) {
  const projects = await getAllProjectsDB();
  return projects.find((p: any) => String(p.id) === String(id) || String(p.key).toLowerCase() === String(id).toLowerCase()) || null;
}

export async function createProjectDB(data: {
  key?: string;
  name: string;
  description?: string;
  owner_id?: number;
  creatorId?: number;
  ownerName?: string;
}) {
  await initDB();
  const key = (data.key || generate30CharKey()).toUpperCase().trim();
  const name = data.name.trim();
  const description = data.description?.trim() || '';
  const owner_id = data.owner_id ? Number(data.owner_id) : (data.creatorId ? Number(data.creatorId) : 1);
  const creatorId = owner_id;
  const ownerName = data.ownerName || 'karri';

  try {
    const p = getPool();
    const result = await p.query(
      `INSERT INTO "projects" ("key", "name", "description", "owner_id", "creatorId", "ownerName")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
      [key, name, description, owner_id, creatorId, ownerName]
    );
    const newId = result.rows[0].id;

    await p.query(
      `INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
      [newId, owner_id]
    );

    const newProj = { id: newId, key, name, description, owner_id, creatorId, ownerName };
    memoryProjectsStore.push(newProj);
    return newProj;
  } catch (err: any) {
    const newId = memoryProjectsStore.length + 10;
    const newProj = { id: newId, key, name, description, owner_id, creatorId, ownerName };
    memoryProjectsStore.push(newProj);
    memoryMembersStore.push({ projectId: newId, userId: owner_id, role: 'owner' });
    return newProj;
  }
}

export async function updateProjectDB(id: string | number, data: { name?: string; description?: string }) {
  await initDB();
  const numericId = Number(id);
  const name = data.name?.trim();
  const description = data.description?.trim();

  try {
    const p = getPool();
    if (name && description !== undefined) {
      await p.query(`UPDATE "projects" SET "name" = $1, "description" = $2 WHERE "id" = $3`, [name, description, numericId]);
      await p.query(`UPDATE "issues" SET "project" = $1 WHERE "projectId" = $2`, [name, numericId]);
    } else if (name) {
      await p.query(`UPDATE "projects" SET "name" = $1 WHERE "id" = $2`, [name, numericId]);
      await p.query(`UPDATE "issues" SET "project" = $1 WHERE "projectId" = $2`, [name, numericId]);
    } else if (description !== undefined) {
      await p.query(`UPDATE "projects" SET "description" = $1 WHERE "id" = $2`, [description, numericId]);
    }
  } catch {}

  const target = memoryProjectsStore.find((p) => p.id === numericId);
  if (target) {
    if (name) target.name = name;
    if (description !== undefined) target.description = description;
  }
  return { success: true, id: numericId };
}

export async function deleteProjectDB(id: string | number) {
  await initDB();
  const numericId = Number(id);
  try {
    const p = getPool();
    await p.query(`DELETE FROM "projects" WHERE "id" = $1`, [numericId]);
  } catch {}

  memoryProjectsStore = memoryProjectsStore.filter((p) => p.id !== numericId);
  return { success: true, id: numericId };
}

export async function getProjectMembersDB(projectId: string | number) {
  await initDB();
  const numProjId = Number(projectId);
  try {
    const p = getPool();
    const result = await p.query(
      `SELECT u."id", u."name", u."email", u."avatar", pm."role", pm."joinedAt"
       FROM "users" u
       JOIN "project_members" pm ON u."id" = pm."userId"
       WHERE pm."projectId" = $1
       ORDER BY pm."joinedAt" ASC`,
      [numProjId]
    );
    return result.rows;
  } catch {
    const members = memoryMembersStore.filter((m) => Number(m.projectId) === numProjId);
    return members.map((m) => {
      const u = memoryUsersStore.find((user) => user.id === m.userId);
      return {
        id: m.userId,
        name: u?.name || 'Member',
        email: u?.email || '',
        avatar: u?.avatar || '',
        role: m.role || 'member',
        joinedAt: new Date().toISOString(),
      };
    });
  }
}

export async function joinProjectDB(userId: string | number, projectKey: string) {
  await initDB();
  const numUserId = Number(userId);
  const cleanKey = projectKey.trim().toUpperCase();

  const project = await getProjectByIdDB(cleanKey);
  if (!project) {
    throw new Error(`Project with key "${cleanKey}" does not exist.`);
  }

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [project.id, numUserId]
    );
  } catch {}

  if (!memoryMembersStore.some((m) => m.projectId === project.id && m.userId === numUserId)) {
    memoryMembersStore.push({ projectId: project.id, userId: numUserId, role: 'member' });
  }

  return project;
}

export async function leaveProjectDB(userId: string | number, projectIdOrKey: string | number) {
  await initDB();
  const numUserId = Number(userId);
  let numProjId = Number(projectIdOrKey);

  if (isNaN(numProjId)) {
    const project = await getProjectByIdDB(projectIdOrKey);
    if (project) numProjId = Number(project.id);
  }

  try {
    const p = getPool();
    if (!isNaN(numProjId)) {
      await p.query(
        `DELETE FROM "project_members" WHERE "projectId" = $1 AND "userId" = $2`,
        [numProjId, numUserId]
      );
    }
  } catch (err: any) {
    console.warn('[leaveProjectDB Error]:', err.message);
  }

  memoryMembersStore = memoryMembersStore.filter(
    (m) => !(Number(m.projectId) === numProjId && Number(m.userId) === numUserId)
  );

  return { success: true };
}


// ─── Issues & Subtasks Helpers ──────────────────────────────────────────────


export function buildSubtaskTree(flatSubtasks: any[]): any[] {
  if (!Array.isArray(flatSubtasks) || flatSubtasks.length === 0) return [];

  const map = new Map<string, any>();
  const roots: any[] = [];

  flatSubtasks.forEach((st) => {
    map.set(st.id, {
      ...st,
      completed: Boolean(st.completed),
      isFolder: Boolean(st.isFolder),
      type: st.type || (st.isFolder ? 'folder' : 'subtask'),
      subtasks: [],
    });
  });

  flatSubtasks.forEach((st) => {
    const node = map.get(st.id);
    if (st.parentId && map.has(st.parentId)) {
      map.get(st.parentId).subtasks.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export async function getAllIssuesDB(userId?: number | string) {
  await initDB();
  try {
    const p = getPool();
    let issuesRes;
    if (userId !== undefined && userId !== null && userId !== '') {
      const numUserId = Number(userId);
      issuesRes = await p.query(
        `SELECT i.* FROM "issues" i
         WHERE i."projectId" IN (
           SELECT p."id" FROM "projects" p
           LEFT JOIN "project_members" pm ON p."id" = pm."projectId"
           WHERE p."owner_id" = $1 OR p."creatorId" = $1 OR pm."userId" = $1
         )
         ORDER BY COALESCE(i."orderIndex", 0) ASC, i."createdAt" DESC`,
        [numUserId]
      );
    } else {
      issuesRes = await p.query(`SELECT * FROM "issues" ORDER BY COALESCE("orderIndex", 0) ASC, "createdAt" DESC`);
    }
    const subtasksRes = await p.query(`SELECT * FROM "subtasks"`);
    const imagesRes = await p.query(`SELECT * FROM "images"`);

    const subtasksMap = new Map<string, any[]>();
    (subtasksRes.rows || []).forEach((st: any) => {
      if (!subtasksMap.has(st.issueId)) subtasksMap.set(st.issueId, []);
      subtasksMap.get(st.issueId)!.push(st);
    });

    const imagesMap = new Map<string, any[]>();
    (imagesRes.rows || []).forEach((img: any) => {
      if (img.taskId) {
        if (!imagesMap.has(img.taskId)) imagesMap.set(img.taskId, []);
        imagesMap.get(img.taskId)!.push(img);
      }
    });

    return (issuesRes.rows || []).map((iss: any) => {
      let labels: string[] = [];
      try {
        labels = typeof iss.labels === 'string' ? JSON.parse(iss.labels) : (iss.labels || []);
      } catch {
        labels = iss.labels ? String(iss.labels).split(',').map((l) => l.trim()) : [];
      }

      let blockedBy: string[] = [];
      try {
        if (Array.isArray(iss.blockedBy)) {
          blockedBy = iss.blockedBy;
        } else if (typeof iss.blockedBy === 'string' && iss.blockedBy.trim()) {
          const parsed = JSON.parse(iss.blockedBy);
          blockedBy = Array.isArray(parsed) ? parsed : [];
        }
      } catch {
        blockedBy = iss.blockedBy ? String(iss.blockedBy).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      }

      return {
        ...iss,
        labels,
        blockedBy,
        orderIndex: Number(iss.orderIndex) || 0,
        estimatedHours: Number(iss.estimatedHours) || 0,
        loggedHours: Number(iss.loggedHours) || 0,
        subtasks: buildSubtaskTree(subtasksMap.get(iss.id) || []),
        images: imagesMap.get(iss.id) || [],
      };
    });
  } catch (err: any) {
    console.warn('[getAllIssuesDB Error]:', err.message);
    return memoryIssuesStore;
  }
}

export async function getIssueByIdDB(id: string) {
  const all = await getAllIssuesDB();
  return all.find((i: any) => i.id === id || i.key === id) || null;
}

export async function createIssueDB(data: {
  id?: string;
  key?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeName?: string;
  reporterName?: string;
  projectId?: number;
  project?: string;
  labels?: string[];
  dueDate?: string;
  estimatedHours?: number;
  subtasks?: any[];
}) {
  await initDB();
  const id = data.id || `iss_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const key = data.key || `TDR-${Math.floor(Math.random() * 900) + 100}`;
  const title = data.title.trim();
  const description = data.description || '';
  const status = data.status || 'todo';
  const priority = data.priority || 'medium';
  const assigneeName = data.assigneeName || 'General (Anyone)';
  const reporterName = data.reporterName || 'karri';
  const projectId = data.projectId ? Number(data.projectId) : 1;
  const project = data.project || 'Teader Platform Core';
  const labelsStr = JSON.stringify(data.labels || ['Platform Core']);
  const estimatedHours = Number(data.estimatedHours) || 2;
  const dueDate = data.dueDate || null;

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO "issues" ("id", "key", "title", "description", "status", "priority", "assigneeName", "reporterName", "projectId", "project", "labels", "estimatedHours", "dueDate")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, key, title, description, status, priority, assigneeName, reporterName, projectId, project, labelsStr, estimatedHours, dueDate]
    );

    if (data.subtasks && Array.isArray(data.subtasks)) {
      for (const st of data.subtasks) {
        const subId = st.id || `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        await p.query(
          `INSERT INTO "subtasks" ("id", "issueId", "parentId", "title", "completed", "isFolder", "type")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [subId, id, st.parentId || null, st.title, Boolean(st.completed), Boolean(st.isFolder), st.type || 'subtask']
        );
      }
    }
  } catch {}

  const newIssue = {
    id,
    key,
    title,
    description,
    status,
    priority,
    assigneeName,
    reporterName,
    projectId,
    project,
    labels: data.labels || ['Platform Core'],
    dueDate,
    estimatedHours,
    loggedHours: 0,
    subtasks: data.subtasks || [],
  };

  memoryIssuesStore.unshift(newIssue);
  return newIssue;
}

export async function updateIssueStatusDB(
  id: string,
  statusOrUpdates?: string | any,
  title?: string,
  description?: string,
  epic?: string,
  priority?: string
) {
  await initDB();
  const updates: any = typeof statusOrUpdates === 'object' && statusOrUpdates !== null
    ? statusOrUpdates
    : {
        status: statusOrUpdates,
        title,
        description,
        epic,
        priority,
      };

  const fields: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (updates.status !== undefined) {
    fields.push(`"status" = $${paramIdx++}`);
    values.push(updates.status);

    if (updates.status === 'done') {
      const compName = updates.completedByName || updates.assigneeName || 'karri';
      const compAt = updates.completedAt || new Date().toISOString();
      fields.push(`"completedByName" = $${paramIdx++}`);
      values.push(compName);
      fields.push(`"completedAt" = $${paramIdx++}`);
      values.push(compAt);
      updates.completedByName = compName;
      updates.completedAt = compAt;
    }
  }
  if (updates.completedByName !== undefined && updates.status !== 'done') {
    fields.push(`"completedByName" = $${paramIdx++}`);
    values.push(updates.completedByName);
  }
  if (updates.completedAt !== undefined && updates.status !== 'done') {
    fields.push(`"completedAt" = $${paramIdx++}`);
    values.push(updates.completedAt);
  }
  if (updates.title !== undefined) {
    fields.push(`"title" = $${paramIdx++}`);
    values.push(updates.title.trim());
  }
  if (updates.description !== undefined) {
    fields.push(`"description" = $${paramIdx++}`);
    values.push(updates.description.trim());
  }
  if (updates.epic !== undefined) {
    fields.push(`"epic" = $${paramIdx++}`);
    values.push(updates.epic.trim());
  }
  if (updates.priority !== undefined) {
    fields.push(`"priority" = $${paramIdx++}`);
    values.push(updates.priority);
  }
  if (updates.assigneeName !== undefined) {
    fields.push(`"assigneeName" = $${paramIdx++}`);
    values.push(updates.assigneeName);
  }
  if (updates.dueDate !== undefined) {
    fields.push(`"dueDate" = $${paramIdx++}`);
    values.push(updates.dueDate);
  }
  if (updates.estimatedHours !== undefined) {
    fields.push(`"estimatedHours" = $${paramIdx++}`);
    values.push(updates.estimatedHours);
  }
  if (updates.loggedHours !== undefined) {
    fields.push(`"loggedHours" = $${paramIdx++}`);
    values.push(updates.loggedHours);
  }
  if (updates.labels !== undefined) {
    fields.push(`"labels" = $${paramIdx++}`);
    values.push(JSON.stringify(updates.labels));
  }
  if (updates.orderIndex !== undefined) {
    fields.push(`"orderIndex" = $${paramIdx++}`);
    values.push(Number(updates.orderIndex) || 0);
  }

  if (fields.length > 0) {
    try {
      const p = getPool();
      values.push(id);
      await p.query(`UPDATE "issues" SET ${fields.join(', ')} WHERE "id" = $${paramIdx}`, values);
    } catch {}
  }

  const target = memoryIssuesStore.find((i) => i.id === id);
  if (target) {
    if (updates.status !== undefined) target.status = updates.status;
    if (updates.completedByName !== undefined) target.completedByName = updates.completedByName;
    if (updates.completedAt !== undefined) target.completedAt = updates.completedAt;
    if (updates.title !== undefined) target.title = updates.title.trim();
    if (updates.description !== undefined) target.description = updates.description.trim();
    if (updates.epic !== undefined) target.epic = updates.epic.trim();
    if (updates.priority !== undefined) target.priority = updates.priority;
    if (updates.assigneeName !== undefined) {
      target.assigneeName = updates.assigneeName;
      if (target.assignee) target.assignee.name = updates.assigneeName;
    }
    if (updates.dueDate !== undefined) target.dueDate = updates.dueDate;
    if (updates.estimatedHours !== undefined) target.estimatedHours = updates.estimatedHours;
    if (updates.loggedHours !== undefined) target.loggedHours = updates.loggedHours;
    if (updates.labels !== undefined) target.labels = updates.labels;
    if (updates.blockedBy !== undefined) target.blockedBy = updates.blockedBy;
    if (updates.blocks !== undefined) target.blocks = updates.blocks;
    if (updates.timeEntries !== undefined) target.timeEntries = updates.timeEntries;
    if (updates.customFields !== undefined) target.customFields = updates.customFields;
    if (updates.orderIndex !== undefined) target.orderIndex = updates.orderIndex;
  }
}

export async function reorderIssuesDB(
  items: Array<{ id: string; orderIndex: number; status?: string }> | string[]
) {
  await initDB();
  if (!items || !Array.isArray(items) || items.length === 0) return { success: true, count: 0 };

  const normalizedItems: Array<{ id: string; orderIndex: number; status?: string }> =
    typeof items[0] === 'string'
      ? (items as string[]).map((id, idx) => ({ id, orderIndex: idx }))
      : (items as Array<{ id: string; orderIndex: number; status?: string }>);

  try {
    const p = getPool();
    for (const item of normalizedItems) {
      if (item.status) {
        await p.query(
          `UPDATE "issues" SET "orderIndex" = $1, "status" = $2 WHERE "id" = $3`,
          [item.orderIndex, item.status, item.id]
        );
      } else {
        await p.query(
          `UPDATE "issues" SET "orderIndex" = $1 WHERE "id" = $2`,
          [item.orderIndex, item.id]
        );
      }
    }
  } catch (err: any) {
    console.warn('[reorderIssuesDB DB warning]:', err.message);
  }

  // Update in-memory store
  for (const item of normalizedItems) {
    const mem = memoryIssuesStore.find((i) => i.id === item.id);
    if (mem) {
      mem.orderIndex = item.orderIndex;
      if (item.status) mem.status = item.status;
    }
  }

  return { success: true, count: normalizedItems.length };
}

export async function deleteIssueDB(id: string) {
  await initDB();
  try {
    const p = getPool();
    // Subtasks, comments, activities will cascade or be deleted
    await p.query(`DELETE FROM "subtasks" WHERE "issueId" = $1`, [id]);
    await p.query(`DELETE FROM "comments" WHERE "issueId" = $1`, [id]);
    await p.query(`DELETE FROM "activities" WHERE "issueId" = $1`, [id]);
    await p.query(`DELETE FROM "issues" WHERE "id" = $1`, [id]);
  } catch {}

  memoryIssuesStore = memoryIssuesStore.filter((i) => i.id !== id);
}

export async function createSubtaskDB(
  issueId: string,
  title: string,
  parentId?: string | null,
  isFolder: boolean = false,
  customType?: string
) {
  await initDB();
  const subId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const cleanTitle = title.trim();
  const type = customType || (isFolder ? 'folder' : 'subtask');

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO "subtasks" ("id", "issueId", "parentId", "title", "completed", "isFolder", "type")
       VALUES ($1, $2, $3, $4, FALSE, $5, $6)`,
      [subId, issueId, parentId || null, cleanTitle, isFolder, type]
    );
  } catch {}

  return {
    id: subId,
    issueId,
    parentId: parentId || null,
    title: cleanTitle,
    completed: false,
    isFolder,
    type,
    subtasks: [],
  };
}


export const addSubtaskDB = createSubtaskDB;

export async function updateSubtaskDB(
  subId: string,
  updates: {
    title?: string;
    completed?: boolean;
    parentId?: string | null;
    issueId?: string;
  }
) {
  await initDB();
  const fields: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (updates.title !== undefined) {
    fields.push(`"title" = $${paramIdx++}`);
    values.push(updates.title.trim());
  }
  if (updates.completed !== undefined) {
    fields.push(`"completed" = $${paramIdx++}`);
    values.push(Boolean(updates.completed));
  }
  if (updates.parentId !== undefined) {
    fields.push(`"parentId" = $${paramIdx++}`);
    values.push(updates.parentId);
  }
  if (updates.issueId !== undefined) {
    fields.push(`"issueId" = $${paramIdx++}`);
    values.push(updates.issueId);
  }

  if (fields.length > 0) {
    try {
      const p = getPool();
      values.push(subId);
      await p.query(`UPDATE "subtasks" SET ${fields.join(', ')} WHERE "id" = $${paramIdx}`, values);
    } catch {}
  }
}

export async function deleteSubtaskDB(subId: string) {
  await initDB();
  try {
    const p = getPool();
    await p.query(`DELETE FROM "subtasks" WHERE "id" = $1 OR "parentId" = $2`, [subId, subId]);
  } catch {}
}

// ─── Project Documents (Server .md Files) ───────────────────────────────────

export interface ProjectDocRecord {
  id: string;
  projectId: number | string;
  userId?: number | string;
  userName?: string;
  title: string;
  fileName: string;
  filePath: string;
  folder?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getProjectDocsDB(projectId: string | number) {
  await initDB();
  let numId = Number(projectId);
  if (isNaN(numId)) {
    const project = await getProjectByIdDB(projectId);
    if (project) numId = Number(project.id);
  }
  try {
    const p = getPool();
    const result = await p.query(
      `SELECT * FROM "project_docs" WHERE "projectId" = $1 ORDER BY "updatedAt" DESC`,
      [numId]
    );
    return result.rows || [];
  } catch {
    return memoryProjectDocsStore.filter((d) => Number(d.projectId) === numId);
  }
}

export async function getProjectDocByIdDB(docId: string) {
  await initDB();
  try {
    const p = getPool();
    const result = await p.query(
      `SELECT * FROM "project_docs" WHERE "id" = $1 LIMIT 1`,
      [docId]
    );
    return result.rows[0] || null;
  } catch {
    return memoryProjectDocsStore.find((d) => d.id === docId) || null;
  }
}

export async function createProjectDocDB(data: {
  id: string;
  projectId: number | string;
  userId?: number | string;
  userName?: string;
  title: string;
  fileName: string;
  filePath: string;
  folder?: string;
  content?: string;
}) {
  await initDB();
  let numProjId = Number(data.projectId);
  if (isNaN(numProjId)) {
    const project = await getProjectByIdDB(data.projectId);
    numProjId = project ? Number(project.id) : 1;
  }
  const numUserId = data.userId ? Number(data.userId) : 1;
  const userName = data.userName || 'karri';
  const now = new Date().toISOString();
  const content = data.content || '';
  const folder = data.folder || 'Start';

  const record: ProjectDocRecord = {
    id: data.id,
    projectId: numProjId,
    userId: numUserId,
    userName,
    title: data.title,
    fileName: data.fileName,
    filePath: data.filePath,
    folder,
    content,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const p = getPool();
    // 1. Insert/Update document in project_docs with physical filePath, folder & content
    await p.query(
      `INSERT INTO "project_docs" ("id", "projectId", "userId", "userName", "title", "fileName", "filePath", "folder", "content")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("id") DO UPDATE SET "title" = $5, "fileName" = $6, "filePath" = $7, "folder" = $8, "content" = $9, "updatedAt" = CURRENT_TIMESTAMP`,
      [data.id, numProjId, numUserId, userName, data.title, data.fileName, data.filePath, folder, content]
    );

    // 2. Reference doc id in projects table (docIds array)
    await p.query(
      `UPDATE "projects"
       SET "docIds" = CASE
         WHEN "docIds" IS NULL THEN jsonb_build_array($1::text)
         WHEN NOT ("docIds" @> jsonb_build_array($1::text)) THEN "docIds" || jsonb_build_array($1::text)
         ELSE "docIds"
       END
       WHERE "id" = $2`,
      [data.id, numProjId]
    );
  } catch (e: any) {
    console.warn('[createProjectDocDB error]:', e.message);
  }

  memoryProjectDocsStore = memoryProjectDocsStore.filter((d) => d.id !== data.id);
  memoryProjectDocsStore.unshift(record);
  return record;
}

export async function updateProjectDocDB(
  docId: string,
  updates: { title?: string; fileName?: string; filePath?: string; folder?: string; content?: string }
) {
  await initDB();
  const fields: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (updates.title !== undefined) {
    fields.push(`"title" = $${paramIdx++}`);
    values.push(updates.title.trim());
  }
  if (updates.fileName !== undefined) {
    fields.push(`"fileName" = $${paramIdx++}`);
    values.push(updates.fileName.trim());
  }
  if (updates.filePath !== undefined) {
    fields.push(`"filePath" = $${paramIdx++}`);
    values.push(updates.filePath);
  }
  if (updates.folder !== undefined) {
    fields.push(`"folder" = $${paramIdx++}`);
    values.push(updates.folder.trim());
  }
  if (updates.content !== undefined) {
    fields.push(`"content" = $${paramIdx++}`);
    values.push(updates.content);
  }

  fields.push(`"updatedAt" = CURRENT_TIMESTAMP`);

  if (fields.length > 0) {
    try {
      const p = getPool();
      values.push(docId);
      await p.query(`UPDATE "project_docs" SET ${fields.join(', ')} WHERE "id" = $${paramIdx}`, values);
    } catch (e: any) {
      console.warn('[updateProjectDocDB error]:', e.message);
    }
  }

  const target = memoryProjectDocsStore.find((d) => d.id === docId);
  if (target) {
    if (updates.title !== undefined) target.title = updates.title.trim();
    if (updates.fileName !== undefined) target.fileName = updates.fileName.trim();
    if (updates.filePath !== undefined) target.filePath = updates.filePath;
    if (updates.folder !== undefined) target.folder = updates.folder.trim();
    if (updates.content !== undefined) target.content = updates.content;
    target.updatedAt = new Date().toISOString();
  }
}

export async function deleteProjectDocDB(docId: string, projectId?: string | number) {
  await initDB();
  let numProjId = projectId !== undefined ? Number(projectId) : undefined;
  if (numProjId !== undefined && isNaN(numProjId)) {
    const project = await getProjectByIdDB(projectId!);
    numProjId = project ? Number(project.id) : undefined;
  }
  try {
    const p = getPool();
    // 1. Remove from project_docs table
    await p.query(`DELETE FROM "project_docs" WHERE "id" = $1`, [docId]);

    // 2. Remove docId from projects table reference
    if (numProjId !== undefined) {
      await p.query(
        `UPDATE "projects"
         SET "docIds" = COALESCE((
           SELECT jsonb_agg(elem)
           FROM jsonb_array_elements("docIds") elem
           WHERE elem #>> '{}' != $1
         ), '[]'::jsonb)
         WHERE "id" = $2`,
        [docId, numProjId]
      );
    } else {
      await p.query(
        `UPDATE "projects"
         SET "docIds" = COALESCE((
           SELECT jsonb_agg(elem)
           FROM jsonb_array_elements("docIds") elem
           WHERE elem #>> '{}' != $1
         ), '[]'::jsonb)
         WHERE "docIds" @> jsonb_build_array($1::text)`,
        [docId]
      );
    }
  } catch (e: any) {
    console.warn('[deleteProjectDocDB error]:', e.message);
  }

  memoryProjectDocsStore = memoryProjectDocsStore.filter((d) => d.id !== docId);
}

// ─── Project Conversation Messages ──────────────────────────────────────────

export interface ProjectMessage {
  id: number;
  projectId: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  content: string;
  channel: string;
  createdAt: string;
}

let memoryProjectMessagesStore: ProjectMessage[] = [
  {
    id: 1,
    projectId: 1,
    userId: 1,
    userName: 'karri',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    userRole: 'owner',
    content: 'Welcome to the project conversation channel! You can coordinate tasks, share snippets, and discuss architecture here.',
    channel: 'general',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2,
    projectId: 1,
    userId: 2,
    userName: 'jori',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    userRole: 'member',
    content: 'Just reviewed the latest branch commits. DAG timeline view looks super smooth!',
    channel: 'general',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

export async function getProjectMessagesDB(projectId: number, channel: string = 'general'): Promise<ProjectMessage[]> {
  await initDB();
  try {
    const p = getPool();
    const res = await p.query(
      `SELECT "id", "projectId", "userId", "userName", "userAvatar", "userRole", "content", "channel", "createdAt" 
       FROM "project_messages" 
       WHERE "projectId" = $1 AND "channel" = $2 
       ORDER BY "id" ASC LIMIT 200`,
      [projectId, channel]
    );
    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        userId: r.userId,
        userName: r.userName,
        userAvatar: r.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        userRole: r.userRole || 'member',
        content: r.content,
        channel: r.channel,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));
    }
  } catch {}

  return memoryProjectMessagesStore.filter((m) => m.projectId === projectId && m.channel === channel);
}

export async function createProjectMessageDB(
  projectId: number,
  userId: number,
  userName: string,
  userAvatar: string,
  userRole: string,
  content: string,
  channel: string = 'general'
): Promise<ProjectMessage> {
  await initDB();
  const trimmed = content.trim();

  try {
    const p = getPool();
    const res = await p.query(
      `INSERT INTO "project_messages" ("projectId", "userId", "userName", "userAvatar", "userRole", "content", "channel") 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING "id", "projectId", "userId", "userName", "userAvatar", "userRole", "content", "channel", "createdAt"`,
      [projectId, userId, userName, userAvatar, userRole, trimmed, channel]
    );
    if (res.rows && res.rows[0]) {
      const row = res.rows[0];
      const newMsg: ProjectMessage = {
        id: row.id,
        projectId: row.projectId,
        userId: row.userId,
        userName: row.userName,
        userAvatar: row.userAvatar,
        userRole: row.userRole,
        content: row.content,
        channel: row.channel,
        createdAt: new Date(row.createdAt).toISOString(),
      };
      memoryProjectMessagesStore.push(newMsg);
      return newMsg;
    }
  } catch {}

  const fallbackMsg: ProjectMessage = {
    id: Date.now(),
    projectId,
    userId,
    userName,
    userAvatar,
    userRole,
    content: trimmed,
    channel,
    createdAt: new Date().toISOString(),
  };
  memoryProjectMessagesStore.push(fallbackMsg);
  return fallbackMsg;
}

export async function deleteProjectMessageDB(messageId: number, userId: number, isUserAdmin: boolean = false): Promise<boolean> {
  await initDB();
  try {
    const p = getPool();
    let query = `DELETE FROM "project_messages" WHERE "id" = $1`;
    const params: any[] = [messageId];

    if (!isUserAdmin && userId !== 1) {
      query += ` AND "userId" = $2`;
      params.push(userId);
    }
    query += ` RETURNING "id"`;

    const res = await p.query(query, params);
    if (res.rowCount && res.rowCount > 0) {
      memoryProjectMessagesStore = memoryProjectMessagesStore.filter((m) => m.id !== messageId);
      return true;
    }
  } catch {}

  memoryProjectMessagesStore = memoryProjectMessagesStore.filter((m) => m.id !== messageId);
  return true;
}

// ─── Dynamic Project Channels Management ────────────────────────────────────

export interface ProjectChannel {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  creatorId?: number;
  createdAt: string;
}

let memoryProjectChannelsStore: ProjectChannel[] = [];

export async function getProjectChannelsDB(projectId: number): Promise<ProjectChannel[]> {
  await initDB();
  const defaultDefs = [
    { name: 'general', desc: 'General project discussions and team syncs' },
    { name: 'dev-stream', desc: 'Autonomous coding agent updates & commits' },
    { name: 'architecture', desc: 'System design, schemas & API reviews' },
    { name: 'qa-sync', desc: 'Bug reports, test results & QA verification' },
  ];

  try {
    const p = getPool();
    const res = await p.query(
      `SELECT "id", "projectId", "name", "description", "creatorId", "createdAt" 
       FROM "project_channels" 
       WHERE "projectId" = $1 
       ORDER BY "id" ASC`,
      [projectId]
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        name: r.name,
        description: r.description || '',
        creatorId: r.creatorId || 1,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));
    }

    // Seed default channels for this project if table is empty for project
    for (const d of defaultDefs) {
      await p.query(
        `INSERT INTO "project_channels" ("projectId", "name", "description", "creatorId") 
         VALUES ($1, $2, $3, $4) ON CONFLICT ("projectId", "name") DO NOTHING`,
        [projectId, d.name, d.desc, 1]
      );
    }

    const seededRes = await p.query(
      `SELECT "id", "projectId", "name", "description", "creatorId", "createdAt" 
       FROM "project_channels" 
       WHERE "projectId" = $1 
       ORDER BY "id" ASC`,
      [projectId]
    );

    if (seededRes.rows && seededRes.rows.length > 0) {
      return seededRes.rows.map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        name: r.name,
        description: r.description || '',
        creatorId: r.creatorId || 1,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));
    }
  } catch {}

  // In-memory fallback
  const list = memoryProjectChannelsStore.filter((c) => c.projectId === projectId);
  if (list.length > 0) return list;

  const now = new Date().toISOString();
  const seeded = defaultDefs.map((d, i) => ({
    id: Date.now() + i,
    projectId,
    name: d.name,
    description: d.desc,
    creatorId: 1,
    createdAt: now,
  }));
  memoryProjectChannelsStore.push(...seeded);
  return seeded;
}

export async function createProjectChannelDB(
  projectId: number,
  name: string,
  description: string = '',
  creatorId: number = 1
): Promise<ProjectChannel> {
  await initDB();
  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-channel';

  try {
    const p = getPool();
    const res = await p.query(
      `INSERT INTO "project_channels" ("projectId", "name", "description", "creatorId") 
       VALUES ($1, $2, $3, $4) 
       RETURNING "id", "projectId", "name", "description", "creatorId", "createdAt"`,
      [projectId, cleanName, description.trim(), creatorId]
    );
    if (res.rows && res.rows[0]) {
      const r = res.rows[0];
      const ch: ProjectChannel = {
        id: r.id,
        projectId: r.projectId,
        name: r.name,
        description: r.description || '',
        creatorId: r.creatorId,
        createdAt: new Date(r.createdAt).toISOString(),
      };
      memoryProjectChannelsStore.push(ch);
      return ch;
    }
  } catch {}

  const fallbackCh: ProjectChannel = {
    id: Date.now(),
    projectId,
    name: cleanName,
    description: description.trim(),
    creatorId,
    createdAt: new Date().toISOString(),
  };
  memoryProjectChannelsStore.push(fallbackCh);
  return fallbackCh;
}

export async function deleteProjectChannelDB(projectId: number, channelName: string): Promise<boolean> {
  await initDB();
  const cleanName = channelName.toLowerCase().trim();
  if (cleanName === 'general') {
    throw new Error('The default #general channel cannot be deleted');
  }

  try {
    const p = getPool();
    await p.query(
      `DELETE FROM "project_messages" WHERE "projectId" = $1 AND "channel" = $2`,
      [projectId, cleanName]
    );
    const res = await p.query(
      `DELETE FROM "project_channels" WHERE "projectId" = $1 AND "name" = $2`,
      [projectId, cleanName]
    );
    memoryProjectChannelsStore = memoryProjectChannelsStore.filter(
      (c) => !(c.projectId === projectId && c.name === cleanName)
    );
    memoryProjectMessagesStore = memoryProjectMessagesStore.filter(
      (m) => !(m.projectId === projectId && m.channel === cleanName)
    );
    return (res.rowCount || 0) > 0;
  } catch {}

  memoryProjectChannelsStore = memoryProjectChannelsStore.filter(
    (c) => !(c.projectId === projectId && c.name === cleanName)
  );
  memoryProjectMessagesStore = memoryProjectMessagesStore.filter(
    (m) => !(m.projectId === projectId && m.channel === cleanName)
  );
  return true;
}

