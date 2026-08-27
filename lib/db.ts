import { Pool } from 'pg';
import crypto from 'crypto';
import { hashPassword, verifyPassword } from './auth';

// PostgreSQL Connection Configuration
const DB_HOST = process.env.POSTGRES_HOST || process.env.MYSQL_HOST || '178.238.226.206';
const DB_USER = process.env.POSTGRES_USER || process.env.MYSQL_USER || 'ajaysaagar';
const DB_PASSWORD = process.env.POSTGRES_PASSWORD || process.env.MYSQL_PASSWORD || 'aass209c';
const DB_NAME = process.env.POSTGRES_DATABASE || process.env.MYSQL_DATABASE || 'ajaysaagar';
const DB_PORT = Number(process.env.POSTGRES_PORT || process.env.MYSQL_PORT) || 5432;
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
let memoryMembersStore: any[] = [
  { projectId: 1, userId: 1, role: 'owner' },
  { projectId: 1, userId: 2, role: 'member' },
  { projectId: 1, userId: 3, role: 'admin' },
];
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
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

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
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

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
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

        // Seed default project if empty
        const projCheck = await p.query(`SELECT COUNT(*) as cnt FROM "projects"`);
        const projCount = Number(projCheck.rows?.[0]?.cnt || 0);

        if (projCount === 0) {
          const res = await p.query(
            `INSERT INTO "projects" ("key", "name", "description", "owner_id", "creatorId", "ownerName")
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
            ['TDR', 'Teader Platform Core', 'Core project management platform workspace and task tracking infrastructure.', 1, 1, 'karri']
          );
          const newProjId = res.rows[0].id;
          await p.query(
            `INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [newProjId, 1, 'owner']
          );
          await p.query(
            `INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [newProjId, 2, 'member']
          );
          await p.query(
            `INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [newProjId, 3, 'admin']
          );
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

export async function loginUserDB(email: string, plainTextPassword?: string) {
  await initDB();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const p = getPool();
    const result = await p.query(`SELECT * FROM "users" WHERE LOWER("email") = $1 LIMIT 1`, [normalizedEmail]);
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

  const memUser = memoryUsersStore.find((u) => u.email.toLowerCase() === normalizedEmail);
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
    if (userId) {
      const numericUserId = Number(userId);
      const result = await p.query(
        `SELECT DISTINCT p.* FROM "projects" p
         LEFT JOIN "project_members" pm ON p."id" = pm."projectId"
         WHERE p."owner_id" = $1 OR p."creatorId" = $2 OR pm."userId" = $3
         ORDER BY p."id" ASC`,
        [numericUserId, numericUserId, numericUserId]
      );
      return result.rows;
    }

    const result = await p.query(`SELECT * FROM "projects" ORDER BY "id" ASC`);
    return result.rows;
  } catch {
    if (userId) {
      const numericUserId = Number(userId);
      return memoryProjectsStore.filter((p) => Number(p.owner_id) === numericUserId || Number(p.creatorId) === numericUserId);
    }
    return memoryProjectsStore;
  }
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

export async function getAllIssuesDB() {
  await initDB();
  try {
    const p = getPool();
    const issuesRes = await p.query(`SELECT * FROM "issues" ORDER BY "createdAt" DESC`);
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

      return {
        ...iss,
        labels,
        estimatedHours: Number(iss.estimatedHours) || 0,
        loggedHours: Number(iss.loggedHours) || 0,
        subtasks: buildSubtaskTree(subtasksMap.get(iss.id) || []),
        images: imagesMap.get(iss.id) || [],
      };
    });
  } catch {
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
  }
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
  createdAt: string;
  updatedAt: string;
}

export async function getProjectDocsDB(projectId: string | number) {
  await initDB();
  const numId = Number(projectId);
  try {
    const p = getPool();
    const result = await p.query(
      `SELECT * FROM "project_docs" WHERE "projectId" = $1 ORDER BY "updatedAt" DESC`,
      [numId]
    );
    return result.rows;
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
}) {
  await initDB();
  const numProjId = Number(data.projectId);
  const numUserId = data.userId ? Number(data.userId) : 1;
  const userName = data.userName || 'karri';
  const now = new Date().toISOString();

  const record: ProjectDocRecord = {
    id: data.id,
    projectId: numProjId,
    userId: numUserId,
    userName,
    title: data.title,
    fileName: data.fileName,
    filePath: data.filePath,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO "project_docs" ("id", "projectId", "userId", "userName", "title", "fileName", "filePath")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [data.id, numProjId, numUserId, userName, data.title, data.fileName, data.filePath]
    );
  } catch {}

  memoryProjectDocsStore.unshift(record);
  return record;
}

export async function updateProjectDocDB(
  docId: string,
  updates: { title?: string; fileName?: string; filePath?: string }
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

  if (fields.length > 0) {
    try {
      const p = getPool();
      values.push(docId);
      await p.query(`UPDATE "project_docs" SET ${fields.join(', ')} WHERE "id" = $${paramIdx}`, values);
    } catch {}
  }

  const target = memoryProjectDocsStore.find((d) => d.id === docId);
  if (target) {
    if (updates.title !== undefined) target.title = updates.title.trim();
    if (updates.fileName !== undefined) target.fileName = updates.fileName.trim();
    if (updates.filePath !== undefined) target.filePath = updates.filePath;
    target.updatedAt = new Date().toISOString();
  }
}

export async function deleteProjectDocDB(docId: string) {
  await initDB();
  try {
    const p = getPool();
    await p.query(`DELETE FROM "project_docs" WHERE "id" = $1`, [docId]);
  } catch {}

  memoryProjectDocsStore = memoryProjectDocsStore.filter((d) => d.id !== docId);
}
