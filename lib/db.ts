import { Pool } from 'pg';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from './auth';
import { MemberPermissions, MemberPermissionsWithUser, HistoryEntry } from './types';

// PostgreSQL Connection Configuration
// Require explicit configuration — no hardcoded fallbacks for security.
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL && !process.env.POSTGRES_HOST) {
  throw new Error(
    'Database not configured. Set DATABASE_URL (e.g. "postgresql://user:pass@localhost:5678/teader_db") ' +
    'or individual POSTGRES_HOST / POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DATABASE env vars in .env'
  );
}

const DB_HOST = process.env.POSTGRES_HOST || 'localhost';
const DB_USER = process.env.POSTGRES_USER || 'postgres';
const DB_PASSWORD = process.env.POSTGRES_PASSWORD || '';
const DB_NAME = process.env.POSTGRES_DATABASE || 'teader_db';
const DB_PORT = Number(process.env.POSTGRES_PORT) || 5678;

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
let memoryJoinRequestsStore: any[] = [];
let memoryPermissionsStore: any[] = [];
let memoryProjectHistoryStore: any[] = [];
let memoryDocFoldersStore: any[] = [];

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

        // 3b. Create Project Join Requests Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "project_join_requests" (
            "id" SERIAL PRIMARY KEY,
            "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
            "userId" INT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "userName" VARCHAR(128) NOT NULL,
            "userEmail" VARCHAR(255) NOT NULL,
            "userAvatar" VARCHAR(255),
            "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "unique_user_project_request" UNIQUE ("projectId", "userId")
          );
        `);

        // 3c. Create Project Member Permissions Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "project_member_permissions" (
            "id" SERIAL PRIMARY KEY,
            "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
            "userId" INT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "can_create_tasks" BOOLEAN NOT NULL DEFAULT TRUE,
            "can_delete_tasks" BOOLEAN NOT NULL DEFAULT FALSE,
            "can_create_docs" BOOLEAN NOT NULL DEFAULT TRUE,
            "can_edit_docs" BOOLEAN NOT NULL DEFAULT TRUE,
            "can_delete_docs" BOOLEAN NOT NULL DEFAULT FALSE,
            "can_edit_history" BOOLEAN NOT NULL DEFAULT FALSE,
            "can_delete_history" BOOLEAN NOT NULL DEFAULT FALSE,
            "can_edit_dates" BOOLEAN NOT NULL DEFAULT FALSE,
            "can_manage_members" BOOLEAN NOT NULL DEFAULT FALSE,
            "can_complete_tasks" BOOLEAN NOT NULL DEFAULT FALSE,
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "unique_member_permissions" UNIQUE ("projectId", "userId")
          );
        `);
        try {
          await p.query(`ALTER TABLE "project_member_permissions" ADD COLUMN IF NOT EXISTS "can_complete_tasks" BOOLEAN NOT NULL DEFAULT FALSE;`);
        } catch {}

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
            "tags" TEXT DEFAULT '[]',
            "sprint" VARCHAR(64) DEFAULT 'Sprint 24.3',
            "epic" VARCHAR(128) DEFAULT 'General',
            "folderId" VARCHAR(64) DEFAULT NULL,
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
          await p.query(`ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '[]';`);
          await p.query(`ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "folderId" VARCHAR(64) DEFAULT NULL;`);
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
        try {
          await p.query(`ALTER TABLE "project_docs" ADD COLUMN IF NOT EXISTS "orderIndex" INT DEFAULT 0;`);
        } catch {}

        // 9b. Create Project Doc Folders Table
        await p.query(`
          CREATE TABLE IF NOT EXISTS "project_doc_folders" (
            "id" SERIAL PRIMARY KEY,
            "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
            "name" VARCHAR(255) NOT NULL,
            "orderIndex" INT DEFAULT 0,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uq_project_doc_folder" UNIQUE ("projectId", "name")
          );
        `);

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

        // 12. Create Project History Table for Workspace Audit Trail
        await p.query(`
          CREATE TABLE IF NOT EXISTS "project_history" (
            "id" SERIAL PRIMARY KEY,
            "projectId" INT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
            "projectKey" VARCHAR(64) NOT NULL,
            "userId" INT DEFAULT NULL,
            "userName" VARCHAR(128) NOT NULL DEFAULT 'system',
            "userAvatar" VARCHAR(255),
            "action" VARCHAR(64) NOT NULL,
            "entityType" VARCHAR(32) NOT NULL,
            "entityId" VARCHAR(64),
            "entityTitle" VARCHAR(512),
            "details" JSONB DEFAULT NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        try {
          await p.query(`CREATE INDEX IF NOT EXISTS "idx_project_history_project" ON "project_history" ("projectId");`);
          await p.query(`CREATE INDEX IF NOT EXISTS "idx_project_history_created" ON "project_history" ("createdAt" DESC);`);
        } catch {}


        // Seed all core team users if not present
        const defaultUsers = [
          { id: 1, name: 'karri', email: 'karri@teader.io', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
          { id: 2, name: 'jori', email: 'jori@teader.io', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
          { id: 3, name: 'ajaysaagar', email: 'ajaysaagar@teader.io', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80' },
          { id: 4, name: 'sarah', email: 'sarah@teader.io', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
          { id: 5, name: 'alex', email: 'alex@teader.io', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
          { id: 13, name: 'ajaysaagar', email: 'ajaysaagar.dev@gmail.com', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80' },
          { id: 14, name: 'Elena Rostova', email: 'elena@teader.io', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
          { id: 15, name: 'Marcus Vance', email: 'marcus@teader.io', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
        ];

        for (const u of defaultUsers) {
          const pass = await hashPassword('password123');
          await p.query(
            `INSERT INTO "users" ("id", "name", "email", "password", "avatar")
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT ("id") DO UPDATE SET "name" = $2, "avatar" = $5`,
            [u.id, u.name, u.email, pass, u.avatar]
          );
        }

        // Seed or Ensure "Huge" and "Huge update/seed" Projects
        const projHugeCheck = await p.query(`SELECT "id", "key", "name" FROM "projects" WHERE "name" ILIKE '%huge%' OR "key" IN ('HUGE', 'HUG')`);
        let hugProjId = projHugeCheck.rows?.[0]?.id;

        if (!hugProjId) {
          const insProj = await p.query(
            `INSERT INTO "projects" ("key", "name", "description", "owner_id", "creatorId", "ownerName")
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
            ['HUGE', 'Huge', 'Enterprise Scale Cloud Initiative: High-throughput distributed microservices, multi-region database sharding, real-time sync engine, AI indexing, and unified design system.', 13, 13, 'ajaysaagar']
          );
          hugProjId = insProj.rows?.[0]?.id;
        }

        if (hugProjId) {
          // Project Members - Owner and diverse members
          const memberIds = [13, 1, 2, 3, 4, 5, 14, 15];
          for (const mId of memberIds) {
            const role = mId === 13 ? 'owner' : (mId === 1 ? 'admin' : 'member');
            await p.query(
              `INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, $3)
               ON CONFLICT ("projectId", "userId") DO UPDATE SET "role" = $3`,
              [hugProjId, mId, role]
            );
          }
        }

        // Memory Store Fallbacks for Huge
        if (!memoryProjectsStore.some((p) => p.key === 'HUGE' || p.key === 'HUG')) {
          const memProj = {
            id: 12,
            key: 'HUGE',
            name: 'Huge',
            description: 'Enterprise Scale Cloud Initiative: High-throughput distributed microservices, multi-region database sharding, real-time sync engine, AI indexing, and unified design system.',
            owner_id: 13,
            creatorId: 13,
            ownerName: 'ajaysaagar',
          };
          memoryProjectsStore.push(memProj);
          memoryMembersStore.push({ projectId: 12, userId: 13, role: 'owner' });
          memoryMembersStore.push({ projectId: 12, userId: 1, role: 'admin' });
          memoryMembersStore.push({ projectId: 12, userId: 2, role: 'member' });
          memoryMembersStore.push({ projectId: 12, userId: 14, role: 'member' });
          memoryMembersStore.push({ projectId: 12, userId: 15, role: 'member' });
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
        `SELECT DISTINCT p.*, 
          CASE 
            WHEN p."owner_id" = $1 OR p."creatorId" = $1 OR pm."userId" = $1 THEN 'active'
            WHEN pjr."status" = 'pending' THEN 'pending'
            ELSE 'none'
          END as "joinStatus"
         FROM "projects" p
         LEFT JOIN "project_members" pm ON p."id" = pm."projectId" AND pm."userId" = $1
         LEFT JOIN "project_join_requests" pjr ON p."id" = pjr."projectId" AND pjr."userId" = $1 AND pjr."status" = 'pending'
         WHERE p."owner_id" = $1 OR p."creatorId" = $1 OR pm."userId" = $1 OR pjr."status" = 'pending'
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

    const pendingProjectIds = memoryJoinRequestsStore
      .filter((r) => Number(r.userId) === numericUserId && r.status === 'pending')
      .map((r) => Number(r.projectId));

    const filtered = memoryProjectsStore
      .filter(
        (p) =>
          Number(p.owner_id) === numericUserId ||
          Number(p.creatorId) === numericUserId ||
          memberProjectIds.includes(Number(p.id)) ||
          pendingProjectIds.includes(Number(p.id))
      )
      .map((p) => {
        const isMember =
          Number(p.owner_id) === numericUserId ||
          Number(p.creatorId) === numericUserId ||
          memberProjectIds.includes(Number(p.id));
        return {
          ...p,
          joinStatus: isMember ? 'active' : 'pending',
        };
      });
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

export async function createJoinRequestDB(
  userId: string | number,
  projectKey: string,
  userName?: string,
  userEmail?: string,
  userAvatar?: string
) {
  await initDB();
  const numUserId = Number(userId);
  const cleanKey = projectKey.trim().toUpperCase();

  const project = await getProjectByIdDB(cleanKey);
  if (!project) {
    throw new Error(`Project with key "${cleanKey}" does not exist.`);
  }

  if (Number(project.owner_id) === numUserId || Number(project.creatorId) === numUserId) {
    throw new Error('You are the creator of this project.');
  }

  // Check if already an active member
  try {
    const p = getPool();
    const memCheck = await p.query(
      `SELECT 1 FROM "project_members" WHERE "projectId" = $1 AND "userId" = $2`,
      [project.id, numUserId]
    );
    if (memCheck.rows.length > 0) {
      throw new Error('You are already an active member of this project.');
    }
  } catch (err: any) {
    if (err.message.includes('already an active member')) throw err;
  }

  if (memoryMembersStore.some((m) => Number(m.projectId) === Number(project.id) && Number(m.userId) === numUserId)) {
    throw new Error('You are already an active member of this project.');
  }

  const name = userName || 'Team Member';
  const email = userEmail || '';
  const avatar = userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO "project_join_requests" ("projectId", "userId", "userName", "userEmail", "userAvatar", "status", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP)
       ON CONFLICT ("projectId", "userId") 
       DO UPDATE SET "status" = 'pending', "userName" = $3, "userEmail" = $4, "userAvatar" = $5, "updatedAt" = CURRENT_TIMESTAMP`,
      [project.id, numUserId, name, email, avatar]
    );
  } catch {}

  const memReq = memoryJoinRequestsStore.find(
    (r) => Number(r.projectId) === Number(project.id) && Number(r.userId) === numUserId
  );
  if (memReq) {
    memReq.status = 'pending';
    memReq.userName = name;
    memReq.userEmail = email;
    memReq.userAvatar = avatar;
    memReq.updatedAt = new Date().toISOString();
  } else {
    memoryJoinRequestsStore.push({
      id: memoryJoinRequestsStore.length + 1,
      projectId: Number(project.id),
      userId: numUserId,
      userName: name,
      userEmail: email,
      userAvatar: avatar,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return { project, status: 'pending' };
}

// Backward-compatibility alias
export async function joinProjectDB(userId: string | number, projectKey: string) {
  return createJoinRequestDB(userId, projectKey);
}

export async function getProjectJoinRequestsDB(projectId: string | number) {
  await initDB();
  const numProjId = Number(projectId);
  try {
    const p = getPool();
    const result = await p.query(
      `SELECT "id", "projectId", "userId", "userName", "userEmail", "userAvatar", "status", "createdAt"
       FROM "project_join_requests"
       WHERE "projectId" = $1 AND "status" = 'pending'
       ORDER BY "createdAt" DESC`,
      [numProjId]
    );
    return result.rows || [];
  } catch {
    return memoryJoinRequestsStore.filter(
      (r) => Number(r.projectId) === numProjId && r.status === 'pending'
    );
  }
}

export async function handleJoinRequestActionDB(
  projectId: string | number,
  targetUserId: string | number,
  action: 'accept' | 'reject'
) {
  await initDB();
  const numProjId = Number(projectId);
  const numUserId = Number(targetUserId);

  try {
    const p = getPool();
    if (action === 'accept') {
      await p.query(
        `INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
        [numProjId, numUserId]
      );
      await p.query(
        `UPDATE "project_join_requests" SET "status" = 'accepted', "updatedAt" = CURRENT_TIMESTAMP WHERE "projectId" = $1 AND "userId" = $2`,
        [numProjId, numUserId]
      );
    } else {
      await p.query(
        `UPDATE "project_join_requests" SET "status" = 'rejected', "updatedAt" = CURRENT_TIMESTAMP WHERE "projectId" = $1 AND "userId" = $2`,
        [numProjId, numUserId]
      );
    }
  } catch {}

  const req = memoryJoinRequestsStore.find(
    (r) => Number(r.projectId) === numProjId && Number(r.userId) === numUserId
  );
  if (req) {
    req.status = action === 'accept' ? 'accepted' : 'rejected';
  }

  if (action === 'accept') {
    if (!memoryMembersStore.some((m) => Number(m.projectId) === numProjId && Number(m.userId) === numUserId)) {
      memoryMembersStore.push({ projectId: numProjId, userId: numUserId, role: 'member' });
    }
  }

  return { success: true, action };
}

export async function kickProjectMemberDB(
  projectId: string | number,
  targetUserId: string | number
) {
  await initDB();
  const numProjId = Number(projectId);
  const numTargetId = Number(targetUserId);

  try {
    const p = getPool();
    await p.query(
      `DELETE FROM "project_members" WHERE "projectId" = $1 AND "userId" = $2`,
      [numProjId, numTargetId]
    );
    await p.query(
      `DELETE FROM "project_join_requests" WHERE "projectId" = $1 AND "userId" = $2`,
      [numProjId, numTargetId]
    );
  } catch {}

  memoryMembersStore = memoryMembersStore.filter(
    (m) => !(Number(m.projectId) === numProjId && Number(m.userId) === numTargetId)
  );
  memoryJoinRequestsStore = memoryJoinRequestsStore.filter(
    (r) => !(Number(r.projectId) === numProjId && Number(r.userId) === numTargetId)
  );

  return { success: true };
}

export async function cancelJoinRequestDB(
  projectId: string | number,
  userId: string | number
) {
  await initDB();
  const numProjId = Number(projectId);
  const numUserId = Number(userId);

  try {
    const p = getPool();
    await p.query(
      `DELETE FROM "project_join_requests" WHERE "projectId" = $1 AND "userId" = $2`,
      [numProjId, numUserId]
    );
  } catch {}

  memoryJoinRequestsStore = memoryJoinRequestsStore.filter(
    (r) => !(Number(r.projectId) === numProjId && Number(r.userId) === numUserId)
  );

  return { success: true };
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
      await p.query(
        `DELETE FROM "project_join_requests" WHERE "projectId" = $1 AND "userId" = $2`,
        [numProjId, numUserId]
      );
    }
  } catch (err: any) {
    console.warn('[leaveProjectDB Error]:', err.message);
  }

  memoryMembersStore = memoryMembersStore.filter(
    (m) => !(Number(m.projectId) === numProjId && Number(m.userId) === numUserId)
  );
  memoryJoinRequestsStore = memoryJoinRequestsStore.filter(
    (r) => !(Number(r.projectId) === numProjId && Number(r.userId) === numUserId)
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

      let tags: string[] = [];
      try {
        tags = typeof iss.tags === 'string' ? JSON.parse(iss.tags) : (iss.tags || []);
      } catch {
        tags = iss.tags ? String(iss.tags).split(',').map((t) => t.trim()) : [];
      }

      return {
        ...iss,
        labels,
        tags,
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

export async function getIssueByIdDB(id: string, userId?: number | string) {
  const all = await getAllIssuesDB(userId);
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
  tags?: string[];
  epic?: string;
  folderId?: string;
  sprint?: string;
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
  const reporterName = data.reporterName || 'Current User';
  const projectId = data.projectId ? Number(data.projectId) : 1;
  const project = data.project || 'Teader Platform Core';
  const epic = data.epic ? data.epic.trim() : 'General';
  const folderId = data.folderId ? data.folderId.trim() : (data.epic === 'General' ? 'folder_general' : null);
  const sprint = data.sprint || 'Sprint 24.3';
  const labelsStr = JSON.stringify(data.labels || ['General']);
  const tagsStr = JSON.stringify(data.tags || []);
  const estimatedHours = Number(data.estimatedHours) || 2;
  const dueDate = data.dueDate || null;

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO "issues" ("id", "key", "title", "description", "status", "priority", "assigneeName", "reporterName", "projectId", "project", "labels", "tags", "estimatedHours", "dueDate", "epic", "folderId", "sprint")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [id, key, title, description, status, priority, assigneeName, reporterName, projectId, project, labelsStr, tagsStr, estimatedHours, dueDate, epic, folderId, sprint]
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

  const nowIso = new Date().toISOString();
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
    epic,
    folderId,
    sprint,
    labels: data.labels || ['General'],
    tags: data.tags || [],
    dueDate,
    estimatedHours,
    loggedHours: 0,
    subtasks: data.subtasks || [],
    createdAt: nowIso,
    updatedAt: nowIso,
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
      const compName = updates.completedByName || updates.assigneeName || 'Current User';
      const compAt = updates.completedAt || new Date().toISOString();
      fields.push(`"completedByName" = $${paramIdx++}`);
      values.push(compName);
      fields.push(`"completedAt" = $${paramIdx++}`);
      values.push(compAt);
      updates.completedByName = compName;
      updates.completedAt = compAt;
    } else {
      fields.push(`"completedByName" = NULL`);
      fields.push(`"completedAt" = NULL`);
      updates.completedByName = null;
      updates.completedAt = null;
    }
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
  if (updates.folderId !== undefined) {
    fields.push(`"folderId" = $${paramIdx++}`);
    values.push(updates.folderId ? updates.folderId.trim() : null);
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
  if (updates.tags !== undefined) {
    fields.push(`"tags" = $${paramIdx++}`);
    values.push(JSON.stringify(updates.tags));
  }
  if (updates.orderIndex !== undefined) {
    fields.push(`"orderIndex" = $${paramIdx++}`);
    values.push(Number(updates.orderIndex) || 0);
  }
  if (updates.createdAt !== undefined) {
    fields.push(`"createdAt" = $${paramIdx++}`);
    values.push(new Date(updates.createdAt).toISOString());
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
    if (updates.folderId !== undefined) target.folderId = updates.folderId;
    if (updates.priority !== undefined) target.priority = updates.priority;
    if (updates.assigneeName !== undefined) {
      target.assigneeName = updates.assigneeName;
      if (target.assignee) target.assignee.name = updates.assigneeName;
    }
    if (updates.dueDate !== undefined) target.dueDate = updates.dueDate;
    if (updates.estimatedHours !== undefined) target.estimatedHours = updates.estimatedHours;
    if (updates.loggedHours !== undefined) target.loggedHours = updates.loggedHours;
    if (updates.labels !== undefined) target.labels = updates.labels;
    if (updates.tags !== undefined) target.tags = updates.tags;
    if (updates.blockedBy !== undefined) target.blockedBy = updates.blockedBy;
    if (updates.blocks !== undefined) target.blocks = updates.blocks;
    if (updates.timeEntries !== undefined) target.timeEntries = updates.timeEntries;
    if (updates.customFields !== undefined) target.customFields = updates.customFields;
    if (updates.orderIndex !== undefined) target.orderIndex = updates.orderIndex;
    if (updates.createdAt !== undefined) target.createdAt = new Date(updates.createdAt).toISOString();
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
  orderIndex?: number;
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
      `SELECT * FROM "project_docs" WHERE "projectId" = $1 ORDER BY "orderIndex" ASC, "updatedAt" DESC`,
      [numId]
    );
    return result.rows || [];
  } catch {
    return memoryProjectDocsStore
      .filter((d) => Number(d.projectId) === numId)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
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
  orderIndex?: number;
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
  const orderIndex = data.orderIndex !== undefined ? Number(data.orderIndex) : 0;

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
    orderIndex,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const p = getPool();
    // 1. Insert/Update document in project_docs with physical filePath, folder & content
    await p.query(
      `INSERT INTO "project_docs" ("id", "projectId", "userId", "userName", "title", "fileName", "filePath", "folder", "content", "orderIndex")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT ("id") DO UPDATE SET "title" = $5, "fileName" = $6, "filePath" = $7, "folder" = $8, "content" = $9, "orderIndex" = $10, "updatedAt" = CURRENT_TIMESTAMP`,
      [data.id, numProjId, numUserId, userName, data.title, data.fileName, data.filePath, folder, content, orderIndex]
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
  updates: { title?: string; fileName?: string; filePath?: string; folder?: string; content?: string; orderIndex?: number }
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
  if (updates.orderIndex !== undefined) {
    fields.push(`"orderIndex" = $${paramIdx++}`);
    values.push(Number(updates.orderIndex));
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
    if (updates.orderIndex !== undefined) target.orderIndex = Number(updates.orderIndex);
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

export async function reorderProjectDocsDB(
  projectId: string | number,
  items: { id: string; orderIndex: number; folder?: string }[]
): Promise<boolean> {
  await initDB();
  const numProjId = Number(projectId);

  try {
    const p = getPool();
    for (const item of items) {
      if (item.folder !== undefined) {
        await p.query(
          `UPDATE "project_docs" SET "orderIndex" = $1, "folder" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $3`,
          [item.orderIndex, item.folder.trim(), item.id]
        );
      } else {
        await p.query(
          `UPDATE "project_docs" SET "orderIndex" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`,
          [item.orderIndex, item.id]
        );
      }
    }
  } catch (e: any) {
    console.warn('[reorderProjectDocsDB error]:', e.message);
  }

  items.forEach((item) => {
    const doc = memoryProjectDocsStore.find((d) => d.id === item.id);
    if (doc) {
      doc.orderIndex = item.orderIndex;
      if (item.folder !== undefined) doc.folder = item.folder.trim();
    }
  });

  return true;
}

export async function getProjectDocFoldersDB(
  projectId: string | number
): Promise<{ id: number; projectId: number; name: string; orderIndex: number; createdAt?: string }[]> {
  await initDB();
  const numProjId = Number(projectId);

  try {
    const p = getPool();
    const res = await p.query(
      `SELECT "id", "projectId", "name", "orderIndex", "createdAt" FROM "project_doc_folders" WHERE "projectId" = $1 ORDER BY "orderIndex" ASC, "id" ASC`,
      [numProjId]
    );
    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: Number(r.id),
        projectId: Number(r.projectId),
        name: r.name,
        orderIndex: Number(r.orderIndex) || 0,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
      }));
    }
  } catch {}

  return memoryDocFoldersStore
    .filter((f) => Number(f.projectId) === numProjId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((f) => ({
      id: f.id,
      projectId: numProjId,
      name: f.name,
      orderIndex: f.orderIndex,
      createdAt: f.createdAt,
    }));
}

export async function createProjectDocFolderDB(
  projectId: string | number,
  name: string,
  orderIndex?: number
): Promise<{ id: number; projectId: number; name: string; orderIndex: number; createdAt?: string }> {
  await initDB();
  const numProjId = Number(projectId);
  const cleanName = name.trim();
  const nextOrder = orderIndex !== undefined ? Number(orderIndex) : 0;

  try {
    const p = getPool();
    const res = await p.query(
      `INSERT INTO "project_doc_folders" ("projectId", "name", "orderIndex")
       VALUES ($1, $2, $3)
       ON CONFLICT ("projectId", "name") DO UPDATE SET "orderIndex" = EXCLUDED."orderIndex"
       RETURNING "id", "projectId", "name", "orderIndex", "createdAt"`,
      [numProjId, cleanName, nextOrder]
    );
    if (res.rows && res.rows[0]) {
      const r = res.rows[0];
      return {
        id: Number(r.id),
        projectId: Number(r.projectId),
        name: r.name,
        orderIndex: Number(r.orderIndex) || 0,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
      };
    }
  } catch {}

  const existingIdx = memoryDocFoldersStore.findIndex(
    (f) => Number(f.projectId) === numProjId && f.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existingIdx >= 0) {
    memoryDocFoldersStore[existingIdx].orderIndex = nextOrder;
    return {
      id: memoryDocFoldersStore[existingIdx].id,
      projectId: numProjId,
      name: cleanName,
      orderIndex: nextOrder,
      createdAt: memoryDocFoldersStore[existingIdx].createdAt,
    };
  }

  const newFolder = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    projectId: numProjId,
    name: cleanName,
    orderIndex: nextOrder,
    createdAt: new Date().toISOString(),
  };
  memoryDocFoldersStore.push(newFolder);
  return {
    id: newFolder.id,
    projectId: numProjId,
    name: newFolder.name,
    orderIndex: newFolder.orderIndex,
    createdAt: newFolder.createdAt,
  };
}

export async function deleteProjectDocFolderDB(
  projectId: string | number,
  folderName: string,
  moveToFolder: string = 'Start'
): Promise<{ success: boolean; deleted: boolean; movedDocsCount: number }> {
  await initDB();
  const numProjId = Number(projectId);
  const cleanName = folderName.trim();
  const targetFolder = moveToFolder.trim() || 'Start';
  let movedCount = 0;

  try {
    const p = getPool();
    // 1. Delete folder record
    await p.query(`DELETE FROM "project_doc_folders" WHERE "projectId" = $1 AND "name" = $2`, [numProjId, cleanName]);
    // 2. Move contained docs to target folder
    const updateRes = await p.query(
      `UPDATE "project_docs" SET "folder" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "projectId" = $2 AND "folder" = $3`,
      [targetFolder, numProjId, cleanName]
    );
    movedCount = updateRes.rowCount || 0;
  } catch (e: any) {
    console.warn('[deleteProjectDocFolderDB error]:', e.message);
  }

  memoryDocFoldersStore = memoryDocFoldersStore.filter(
    (f) => !(Number(f.projectId) === numProjId && f.name === cleanName)
  );
  memoryProjectDocsStore.forEach((d) => {
    if (Number(d.projectId) === numProjId && d.folder === cleanName) {
      d.folder = targetFolder;
      movedCount++;
    }
  });

  return { success: true, deleted: true, movedDocsCount: movedCount };
}

export async function reorderProjectDocFoldersDB(
  projectId: string | number,
  folders: { name: string; orderIndex: number }[]
): Promise<boolean> {
  await initDB();
  const numProjId = Number(projectId);

  try {
    const p = getPool();
    for (const f of folders) {
      await p.query(
        `INSERT INTO "project_doc_folders" ("projectId", "name", "orderIndex")
         VALUES ($1, $2, $3)
         ON CONFLICT ("projectId", "name") DO UPDATE SET "orderIndex" = $3`,
        [numProjId, f.name.trim(), f.orderIndex]
      );
    }
  } catch (e: any) {
    console.warn('[reorderProjectDocFoldersDB error]:', e.message);
  }

  folders.forEach((f) => {
    const found = memoryDocFoldersStore.find(
      (mf) => Number(mf.projectId) === numProjId && mf.name === f.name.trim()
    );
    if (found) {
      found.orderIndex = f.orderIndex;
    } else {
      memoryDocFoldersStore.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        projectId: numProjId,
        name: f.name.trim(),
        orderIndex: f.orderIndex,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return true;
}

// ─── Project Conversation Messages ──────────────────────────────────────────

export interface ProjectMessage {
  id: number | string;
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

// ─── Project Member Permissions Helpers ──────────────────────────────────────

const DEFAULT_MEMBER_PERMISSIONS: MemberPermissions = {
  can_create_tasks: true,
  can_delete_tasks: false,
  can_create_docs: true,
  can_edit_docs: true,
  can_delete_docs: false,
  can_edit_history: false,
  can_delete_history: false,
  can_edit_dates: false,
  can_manage_members: false,
  can_complete_tasks: false,
};

const OWNER_ADMIN_PERMISSIONS: MemberPermissions = {
  can_create_tasks: true,
  can_delete_tasks: true,
  can_create_docs: true,
  can_edit_docs: true,
  can_delete_docs: true,
  can_edit_history: true,
  can_delete_history: true,
  can_edit_dates: true,
  can_manage_members: true,
  can_complete_tasks: true,
};

export async function getMemberPermissionsDB(
  projectId: number | string,
  userId: number | string
): Promise<MemberPermissions> {
  await initDB();
  const numProjId = Number(projectId);
  const numUserId = Number(userId);

  try {
    const p = getPool();
    // Check if user is owner of project
    const projRes = await p.query(
      `SELECT "id" FROM "projects" WHERE "id" = $1 AND ("owner_id" = $2 OR "creatorId" = $2) LIMIT 1`,
      [numProjId, numUserId]
    );
    if (projRes.rows?.length > 0) {
      return { ...OWNER_ADMIN_PERMISSIONS };
    }

    // Check project member role
    const memberRes = await p.query(
      `SELECT "role" FROM "project_members" WHERE "projectId" = $1 AND "userId" = $2 LIMIT 1`,
      [numProjId, numUserId]
    );
    const role = memberRes.rows?.[0]?.role || 'member';
    if (role === 'owner' || role === 'admin') {
      return { ...OWNER_ADMIN_PERMISSIONS };
    }

    // Check custom permissions table
    const permRes = await p.query(
      `SELECT "can_create_tasks", "can_delete_tasks", "can_create_docs", "can_edit_docs",
              "can_delete_docs", "can_edit_history", "can_delete_history", "can_edit_dates",
              "can_manage_members", "can_complete_tasks"
       FROM "project_member_permissions"
       WHERE "projectId" = $1 AND "userId" = $2 LIMIT 1`,
      [numProjId, numUserId]
    );

    if (permRes.rows?.length > 0) {
      const row = permRes.rows[0];
      return {
        can_create_tasks: Boolean(row.can_create_tasks),
        can_delete_tasks: Boolean(row.can_delete_tasks),
        can_create_docs: Boolean(row.can_create_docs),
        can_edit_docs: Boolean(row.can_edit_docs),
        can_delete_docs: Boolean(row.can_delete_docs),
        can_edit_history: Boolean(row.can_edit_history),
        can_delete_history: Boolean(row.can_delete_history),
        can_edit_dates: Boolean(row.can_edit_dates),
        can_manage_members: Boolean(row.can_manage_members),
        can_complete_tasks: Boolean(row.can_complete_tasks),
      };
    }
  } catch {}

  const mem = memoryPermissionsStore.find(
    (p) => Number(p.projectId) === numProjId && Number(p.userId) === numUserId
  );
  if (mem) {
    return { ...DEFAULT_MEMBER_PERMISSIONS, ...mem };
  }

  return { ...DEFAULT_MEMBER_PERMISSIONS };
}

export async function upsertMemberPermissionsDB(
  projectId: number | string,
  userId: number | string,
  permissions: Partial<MemberPermissions>
): Promise<MemberPermissions> {
  await initDB();
  const numProjId = Number(projectId);
  const numUserId = Number(userId);

  const existing = await getMemberPermissionsDB(numProjId, numUserId);
  const merged: MemberPermissions = {
    ...existing,
    ...permissions,
  };

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO "project_member_permissions" (
        "projectId", "userId", "can_create_tasks", "can_delete_tasks",
        "can_create_docs", "can_edit_docs", "can_delete_docs",
        "can_edit_history", "can_delete_history", "can_edit_dates",
        "can_manage_members", "can_complete_tasks", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
      ON CONFLICT ("projectId", "userId") DO UPDATE SET
        "can_create_tasks" = EXCLUDED."can_create_tasks",
        "can_delete_tasks" = EXCLUDED."can_delete_tasks",
        "can_create_docs" = EXCLUDED."can_create_docs",
        "can_edit_docs" = EXCLUDED."can_edit_docs",
        "can_delete_docs" = EXCLUDED."can_delete_docs",
        "can_edit_history" = EXCLUDED."can_edit_history",
        "can_delete_history" = EXCLUDED."can_delete_history",
        "can_edit_dates" = EXCLUDED."can_edit_dates",
        "can_manage_members" = EXCLUDED."can_manage_members",
        "can_complete_tasks" = EXCLUDED."can_complete_tasks",
        "updatedAt" = CURRENT_TIMESTAMP`,
      [
        numProjId,
        numUserId,
        merged.can_create_tasks,
        merged.can_delete_tasks,
        merged.can_create_docs,
        merged.can_edit_docs,
        merged.can_delete_docs,
        merged.can_edit_history,
        merged.can_delete_history,
        merged.can_edit_dates,
        merged.can_manage_members,
        merged.can_complete_tasks,
      ]
    );
  } catch {}

  const idx = memoryPermissionsStore.findIndex(
    (p) => Number(p.projectId) === numProjId && Number(p.userId) === numUserId
  );
  if (idx >= 0) {
    memoryPermissionsStore[idx] = { projectId: numProjId, userId: numUserId, ...merged };
  } else {
    memoryPermissionsStore.push({ projectId: numProjId, userId: numUserId, ...merged });
  }

  return merged;
}

export async function getAllMemberPermissionsDB(
  projectId: number | string
): Promise<MemberPermissionsWithUser[]> {
  await initDB();
  const numProjId = Number(projectId);

  try {
    const p = getPool();
    const result = await p.query(
      `SELECT u."id" as "userId", u."name" as "userName", u."email" as "userEmail", u."avatar" as "userAvatar",
              pm."role",
              COALESCE(pmp."can_create_tasks", true) as "can_create_tasks",
              COALESCE(pmp."can_delete_tasks", false) as "can_delete_tasks",
              COALESCE(pmp."can_create_docs", true) as "can_create_docs",
              COALESCE(pmp."can_edit_docs", true) as "can_edit_docs",
              COALESCE(pmp."can_delete_docs", false) as "can_delete_docs",
              COALESCE(pmp."can_edit_history", false) as "can_edit_history",
              COALESCE(pmp."can_delete_history", false) as "can_delete_history",
              COALESCE(pmp."can_edit_dates", false) as "can_edit_dates",
              COALESCE(pmp."can_manage_members", false) as "can_manage_members",
              COALESCE(pmp."can_complete_tasks", false) as "can_complete_tasks"
       FROM "users" u
       JOIN "project_members" pm ON u."id" = pm."userId"
       LEFT JOIN "project_member_permissions" pmp ON pmp."projectId" = pm."projectId" AND pmp."userId" = u."id"
       WHERE pm."projectId" = $1
       ORDER BY pm."joinedAt" ASC`,
      [numProjId]
    );

    if (result.rows?.length > 0) {
      return result.rows.map((r: any) => {
        const isOwnerOrAdmin = r.role === 'owner' || r.role === 'admin';
        return {
          userId: Number(r.userId),
          userName: r.userName,
          userEmail: r.userEmail,
          userAvatar: r.userAvatar,
          role: r.role || 'member',
          can_create_tasks: isOwnerOrAdmin ? true : Boolean(r.can_create_tasks),
          can_delete_tasks: isOwnerOrAdmin ? true : Boolean(r.can_delete_tasks),
          can_create_docs: isOwnerOrAdmin ? true : Boolean(r.can_create_docs),
          can_edit_docs: isOwnerOrAdmin ? true : Boolean(r.can_edit_docs),
          can_delete_docs: isOwnerOrAdmin ? true : Boolean(r.can_delete_docs),
          can_edit_history: isOwnerOrAdmin ? true : Boolean(r.can_edit_history),
          can_delete_history: isOwnerOrAdmin ? true : Boolean(r.can_delete_history),
          can_edit_dates: isOwnerOrAdmin ? true : Boolean(r.can_edit_dates),
          can_manage_members: isOwnerOrAdmin ? true : Boolean(r.can_manage_members),
          can_complete_tasks: isOwnerOrAdmin ? true : Boolean(r.can_complete_tasks),
        };
      });
    }
  } catch {}

  const members = await getProjectMembersDB(numProjId);
  return members.map((m: any) => {
    const isOwnerOrAdmin = m.role === 'owner' || m.role === 'admin';
    const custom = memoryPermissionsStore.find(
      (p) => Number(p.projectId) === numProjId && Number(p.userId) === Number(m.id)
    );
    return {
      userId: Number(m.id),
      userName: m.name,
      userEmail: m.email,
      userAvatar: m.avatar,
      role: m.role || 'member',
      can_create_tasks: isOwnerOrAdmin ? true : (custom?.can_create_tasks ?? DEFAULT_MEMBER_PERMISSIONS.can_create_tasks),
      can_delete_tasks: isOwnerOrAdmin ? true : (custom?.can_delete_tasks ?? DEFAULT_MEMBER_PERMISSIONS.can_delete_tasks),
      can_create_docs: isOwnerOrAdmin ? true : (custom?.can_create_docs ?? DEFAULT_MEMBER_PERMISSIONS.can_create_docs),
      can_edit_docs: isOwnerOrAdmin ? true : (custom?.can_edit_docs ?? DEFAULT_MEMBER_PERMISSIONS.can_edit_docs),
      can_delete_docs: isOwnerOrAdmin ? true : (custom?.can_delete_docs ?? DEFAULT_MEMBER_PERMISSIONS.can_delete_docs),
      can_edit_history: isOwnerOrAdmin ? true : (custom?.can_edit_history ?? DEFAULT_MEMBER_PERMISSIONS.can_edit_history),
      can_delete_history: isOwnerOrAdmin ? true : (custom?.can_delete_history ?? DEFAULT_MEMBER_PERMISSIONS.can_delete_history),
      can_edit_dates: isOwnerOrAdmin ? true : (custom?.can_edit_dates ?? DEFAULT_MEMBER_PERMISSIONS.can_edit_dates),
      can_manage_members: isOwnerOrAdmin ? true : (custom?.can_manage_members ?? DEFAULT_MEMBER_PERMISSIONS.can_manage_members),
      can_complete_tasks: isOwnerOrAdmin ? true : (custom?.can_complete_tasks ?? DEFAULT_MEMBER_PERMISSIONS.can_complete_tasks),
    };
  });
}

// ─── Project History / Audit Trail Helpers ────────────────────────────────────

export async function logProjectHistoryDB(entry: {
  projectId: number | string;
  projectKey: string;
  userId?: number | string;
  userName?: string;
  userAvatar?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  details?: Record<string, any>;
}): Promise<HistoryEntry> {
  await initDB();
  const numProjId = Number(entry.projectId);
  const numUserId = entry.userId ? Number(entry.userId) : null;
  const userName = entry.userName || 'system';
  const action = entry.action;
  const entityType = entry.entityType;
  const entityId = entry.entityId || null;
  const entityTitle = entry.entityTitle || null;
  const details = entry.details ? JSON.stringify(entry.details) : null;

  try {
    const p = getPool();
    const res = await p.query(
      `INSERT INTO "project_history" (
        "projectId", "projectKey", "userId", "userName", "userAvatar",
        "action", "entityType", "entityId", "entityTitle", "details"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING "id", "projectId", "projectKey", "userId", "userName", "userAvatar",
                "action", "entityType", "entityId", "entityTitle", "details", "createdAt"`,
      [
        numProjId,
        entry.projectKey,
        numUserId,
        userName,
        entry.userAvatar || null,
        action,
        entityType,
        entityId,
        entityTitle,
        details,
      ]
    );

    if (res.rows && res.rows[0]) {
      const r = res.rows[0];
      const newEntry: HistoryEntry = {
        id: r.id,
        projectId: r.projectId,
        projectKey: r.projectKey,
        userId: r.userId ? Number(r.userId) : undefined,
        userName: r.userName,
        userAvatar: r.userAvatar,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        entityTitle: r.entityTitle,
        details: r.details,
        createdAt: new Date(r.createdAt).toISOString(),
      };
      memoryProjectHistoryStore.unshift(newEntry);
      return newEntry;
    }
  } catch {}

  const fallbackEntry: HistoryEntry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    projectId: numProjId,
    projectKey: entry.projectKey,
    userId: numUserId ? Number(numUserId) : undefined,
    userName,
    userAvatar: entry.userAvatar,
    action,
    entityType,
    entityId: entityId || undefined,
    entityTitle: entityTitle || undefined,
    details: entry.details,
    createdAt: new Date().toISOString(),
  };
  memoryProjectHistoryStore.unshift(fallbackEntry);
  return fallbackEntry;
}

export async function getProjectHistoryDB(
  projectId: number | string,
  opts?: { limit?: number; offset?: number; entityType?: string; action?: string }
): Promise<HistoryEntry[]> {
  await initDB();
  const numProjId = Number(projectId);
  const limit = Math.min(Number(opts?.limit) || 50, 200);
  const offset = Number(opts?.offset) || 0;

  try {
    const p = getPool();
    const conditions: string[] = [`"projectId" = $1`];
    const params: any[] = [numProjId];
    let paramIdx = 2;

    if (opts?.entityType && opts.entityType !== 'all') {
      conditions.push(`"entityType" = $${paramIdx++}`);
      params.push(opts.entityType);
    }
    if (opts?.action && opts.action !== 'all') {
      conditions.push(`"action" = $${paramIdx++}`);
      params.push(opts.action);
    }

    params.push(limit);
    params.push(offset);

    const query = `
      SELECT "id", "projectId", "projectKey", "userId", "userName", "userAvatar",
             "action", "entityType", "entityId", "entityTitle", "details", "createdAt"
      FROM "project_history"
      WHERE ${conditions.join(' AND ')}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `;

    const result = await p.query(query, params);
    if (result.rows) {
      return result.rows.map((r: any) => ({
        id: r.id,
        projectId: r.projectId,
        projectKey: r.projectKey,
        userId: r.userId ? Number(r.userId) : undefined,
        userName: r.userName,
        userAvatar: r.userAvatar,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        entityTitle: r.entityTitle,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
        createdAt: new Date(r.createdAt).toISOString(),
      }));
    }
  } catch {}

  let list = memoryProjectHistoryStore.filter((h) => Number(h.projectId) === numProjId);
  if (opts?.entityType && opts.entityType !== 'all') {
    list = list.filter((h) => h.entityType === opts.entityType);
  }
  if (opts?.action && opts.action !== 'all') {
    list = list.filter((h) => h.action === opts.action);
  }
  return list.slice(offset, offset + limit);
}

export async function deleteProjectHistoryEntryDB(historyId: number | string): Promise<boolean> {
  await initDB();
  const numId = Number(historyId);

  try {
    const p = getPool();
    const res = await p.query(`DELETE FROM "project_history" WHERE "id" = $1`, [numId]);
    memoryProjectHistoryStore = memoryProjectHistoryStore.filter((h) => Number(h.id) !== numId);
    return (res.rowCount || 0) > 0;
  } catch {}

  memoryProjectHistoryStore = memoryProjectHistoryStore.filter((h) => Number(h.id) !== numId);
  return true;
}

export async function updateProjectHistoryEntryDB(
  historyId: number | string,
  updates: { details?: any; createdAt?: string; action?: string; entityTitle?: string }
): Promise<boolean> {
  await initDB();
  const numId = Number(historyId);
  const fields: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (updates.details !== undefined) {
    fields.push(`"details" = $${paramIdx++}`);
    values.push(JSON.stringify(updates.details));
  }
  if (updates.createdAt !== undefined) {
    fields.push(`"createdAt" = $${paramIdx++}`);
    values.push(new Date(updates.createdAt).toISOString());
  }
  if (updates.action !== undefined) {
    fields.push(`"action" = $${paramIdx++}`);
    values.push(updates.action);
  }
  if (updates.entityTitle !== undefined) {
    fields.push(`"entityTitle" = $${paramIdx++}`);
    values.push(updates.entityTitle);
  }

  if (fields.length > 0) {
    try {
      const p = getPool();
      values.push(numId);
      await p.query(`UPDATE "project_history" SET ${fields.join(', ')} WHERE "id" = $${paramIdx}`, values);
    } catch {}
  }

  const target = memoryProjectHistoryStore.find((h) => Number(h.id) === numId);
  if (target) {
    if (updates.details !== undefined) target.details = updates.details;
    if (updates.createdAt !== undefined) target.createdAt = new Date(updates.createdAt).toISOString();
    if (updates.action !== undefined) target.action = updates.action;
    if (updates.entityTitle !== undefined) target.entityTitle = updates.entityTitle;
  }
  return true;
}

export async function updateIssueCreatedAtDB(issueId: string, newCreatedAt: string): Promise<boolean> {
  await initDB();
  const isoDate = new Date(newCreatedAt).toISOString();

  try {
    const p = getPool();
    await p.query(`UPDATE "issues" SET "createdAt" = $1 WHERE "id" = $2`, [isoDate, issueId]);
  } catch {}

  const target = memoryIssuesStore.find((i) => i.id === issueId);
  if (target) {
    target.createdAt = isoDate;
  }
  return true;
}

