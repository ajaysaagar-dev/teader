import mysql from 'mysql2/promise';
import crypto from 'crypto';

// MySQL Connection Config
const DB_HOST = process.env.MYSQL_HOST || 'localhost';
const DB_USER = process.env.MYSQL_USER || 'ajaysaagar';
const DB_PASSWORD = process.env.MYSQL_PASSWORD || 'aass209c';
const DB_NAME = process.env.MYSQL_DATABASE || 'teader_db';
const DB_PORT = Number(process.env.MYSQL_PORT) || 3306;

let pool: mysql.Pool | null = null;
let initialized = false;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

let memoryUsersStore: any[] = [];
let memoryProjectsStore: any[] = [];
let memoryMembersStore: any[] = [];
let memoryIssuesStore: any[] = [];
let memoryImagesStore: any[] = [];

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function generate30CharKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PRJ';
  for (let i = 0; i < 27; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Initialize Database & Tables automatically
export async function initDB() {
  if (initialized) return;

  try {
    const rootConn = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT,
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    await rootConn.end();

    const p = getPool();

    // 1. Create Users Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`avatar\` VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Create Projects Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`projects\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(64) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` TEXT,
        \`owner_id\` INT NOT NULL DEFAULT 1,
        \`creatorId\` INT DEFAULT 1,
        \`ownerName\` VARCHAR(128) DEFAULT 'karri',
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns exist on existing table
    try { await p.query(`ALTER TABLE \`projects\` ADD COLUMN \`owner_id\` INT NOT NULL DEFAULT 1;`); } catch {}
    try { await p.query(`ALTER TABLE \`projects\` ADD COLUMN \`creatorId\` INT DEFAULT 1;`); } catch {}
    try { await p.query(`ALTER TABLE \`projects\` ADD COLUMN \`ownerName\` VARCHAR(128) DEFAULT 'karri';`); } catch {}
    try { await p.query(`ALTER TABLE \`projects\` MODIFY COLUMN \`key\` VARCHAR(64) NOT NULL;`); } catch {}

    // 3. Create Project Members Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`project_members\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`projectId\` INT NOT NULL,
        \`userId\` INT NOT NULL,
        \`joinedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_user_project\` (\`projectId\`, \`userId\`),
        FOREIGN KEY (\`projectId\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Create Issues Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`issues\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`key\` VARCHAR(64) NOT NULL UNIQUE,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'todo',
        \`priority\` VARCHAR(32) NOT NULL DEFAULT 'medium',
        \`assigneeName\` VARCHAR(128) DEFAULT 'General (Anyone)',
        \`assigneeAvatar\` VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        \`reporterName\` VARCHAR(128) DEFAULT 'karri',
        \`reporterAvatar\` VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        \`labels\` TEXT,
        \`sprint\` VARCHAR(64) DEFAULT 'Sprint 24.3',
        \`epic\` VARCHAR(128) DEFAULT 'Platform Core',
        \`projectId\` INT NOT NULL,
        \`project\` VARCHAR(128) DEFAULT 'Teader Platform Core',
        \`isFavorite\` TINYINT(1) DEFAULT 0,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_projectId\` (\`projectId\`),
        FOREIGN KEY (\`projectId\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Create Subtasks Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`subtasks\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`issueId\` VARCHAR(64) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`completed\` TINYINT(1) DEFAULT 0,
        \`imageId\` VARCHAR(64) DEFAULT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`issueId\`) REFERENCES \`issues\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Create Images Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`images\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`fileName\` VARCHAR(255) NOT NULL,
        \`filePath\` VARCHAR(255) NOT NULL,
        \`url\` VARCHAR(255) NOT NULL,
        \`taskId\` VARCHAR(64) DEFAULT NULL,
        \`subtaskId\` VARCHAR(64) DEFAULT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed Default Admin Users if Empty
    const [userRows]: any = await p.query(`SELECT COUNT(*) as cnt FROM \`users\``);
    if (userRows[0].cnt === 0) {
      await seedDefaultUsers(p);
    }

    initialized = true;
  } catch (err: any) {
    console.warn('MySQL auto-initialization note:', err.message);
    if (memoryUsersStore.length === 0) memoryUsersStore = getInitialSeedUsers();
  }
}

function getInitialSeedUsers() {
  return [
    {
      id: 1,
      name: 'karri',
      email: 'karri@teader.io',
      password: hashPassword('password123'),
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 2,
      name: 'jori',
      email: 'jori@teader.io',
      password: hashPassword('password123'),
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  ];
}

async function seedDefaultUsers(p: mysql.Pool) {
  for (const u of getInitialSeedUsers()) {
    await p.query(
      `INSERT INTO \`users\` (\`id\`, \`name\`, \`email\`, \`password\`, \`avatar\`) VALUES (?, ?, ?, ?, ?)`,
      [u.id, u.name, u.email, u.password, u.avatar]
    );
  }
}

// User Auth Helpers
export async function registerUserDB(data: { name: string; email: string; password: string }) {
  await initDB();
  const name = data.name.trim();
  const email = data.email.toLowerCase().trim();
  const hashedPassword = hashPassword(data.password);
  const avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

  try {
    const p = getPool();
    const [existing]: any = await p.query(`SELECT * FROM \`users\` WHERE \`email\` = ?`, [email]);
    if (existing && existing.length > 0) {
      throw new Error('Email is already registered');
    }

    const [result]: any = await p.query(
      `INSERT INTO \`users\` (\`name\`, \`email\`, \`password\`, \`avatar\`) VALUES (?, ?, ?, ?)`,
      [name, email, hashedPassword, avatar]
    );

    return { id: result.insertId, name, email, avatar };
  } catch (err: any) {
    if (err.message.includes('already registered')) throw err;
    const newId = memoryUsersStore.length + 10;
    const newUser = { id: newId, name, email, password: hashedPassword, avatar };
    memoryUsersStore.push(newUser);
    return { id: newId, name, email, avatar };
  }
}

export async function loginUserDB(email: string, passwordUnhashed: string) {
  await initDB();
  const emailLower = email.toLowerCase().trim();
  const hashedPassword = hashPassword(passwordUnhashed);

  try {
    const p = getPool();
    const [rows]: any = await p.query(
      `SELECT * FROM \`users\` WHERE \`email\` = ? AND \`password\` = ?`,
      [emailLower, hashedPassword]
    );

    if (rows && rows.length > 0) {
      const user = rows[0];
      return { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
    }
  } catch {
    const user = memoryUsersStore.find(
      (u) => u.email === emailLower && u.password === hashedPassword
    );
    if (user) {
      return { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
    }
  }
  throw new Error('Invalid email or password');
}

export async function getUserByIdDB(id: number | string) {
  await initDB();
  const numericId = Number(id);
  try {
    const p = getPool();
    const [rows]: any = await p.query(`SELECT \`id\`, \`name\`, \`email\`, \`avatar\` FROM \`users\` WHERE \`id\` = ?`, [numericId]);
    if (rows && rows[0]) return rows[0];
  } catch {
    const user = memoryUsersStore.find((u) => u.id === numericId);
    if (user) return { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
  }
  return null;
}

// Join Project Helper
export async function joinProjectDB(userId: number | string, projectKey: string) {
  await initDB();
  const numericUserId = Number(userId);
  const cleanKey = projectKey.trim().toUpperCase();

  try {
    const p = getPool();
    const [projs]: any = await p.query(
      `SELECT * FROM \`projects\` 
       WHERE UPPER(TRIM(\`key\`)) = ? OR UPPER(REPLACE(\`key\`, ' ', '')) = ?`,
      [cleanKey, cleanKey]
    );

    let targetProj = projs && projs.length > 0 ? projs[0] : null;

    if (!targetProj) {
      const [allProjs]: any = await p.query(`SELECT * FROM \`projects\``);
      targetProj = (allProjs || []).find((p: any) =>
        p.key.trim().toUpperCase() === cleanKey ||
        cleanKey.includes(p.key.trim().toUpperCase()) ||
        p.key.trim().toUpperCase().includes(cleanKey)
      );
    }

    if (!targetProj) {
      throw new Error(`Project key '${cleanKey}' not found. Please verify the project key.`);
    }

    await p.query(
      `INSERT IGNORE INTO \`project_members\` (\`projectId\`, \`userId\`) VALUES (?, ?)`,
      [targetProj.id, numericUserId]
    );

    return targetProj;
  } catch (err: any) {
    if (err.message.includes('not found')) throw err;
    const targetProj = memoryProjectsStore.find(
      (p) => p.key.trim().toUpperCase() === cleanKey || cleanKey.includes(p.key.trim().toUpperCase())
    );
    if (!targetProj) throw new Error(`Project key '${cleanKey}' not found. Please verify the project key.`);

    memoryMembersStore.push({ projectId: targetProj.id, userId: numericUserId });
    return targetProj;
  }
}

// Fetch Joined Members of a Project
export async function getProjectMembersDB(projectId: number | string) {
  await initDB();
  const numericProjId = Number(projectId);
  try {
    const p = getPool();
    const [rows]: any = await p.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.avatar FROM \`users\` u
       INNER JOIN \`project_members\` pm ON u.id = pm.userId
       WHERE pm.projectId = ?
       UNION
       SELECT DISTINCT u.id, u.name, u.email, u.avatar FROM \`users\` u
       INNER JOIN \`projects\` p ON u.id = p.owner_id OR u.id = p.creatorId
       WHERE p.id = ?`,
      [numericProjId, numericProjId]
    );
    return rows;
  } catch {
    return [
      { id: 1, name: 'karri', email: 'karri@teader.io', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
      { id: 2, name: 'jori', email: 'jori@teader.io', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
    ];
  }
}

// Upload & Save Image Record
export async function saveImageMetadataDB(imageId: string, fileName: string, filePath: string, url: string, taskId?: string, subtaskId?: string) {
  await initDB();
  try {
    const p = getPool();
    await p.query(
      `INSERT INTO \`images\` (\`id\`, \`fileName\`, \`filePath\`, \`url\`, \`taskId\`, \`subtaskId\`) VALUES (?, ?, ?, ?, ?, ?)`,
      [imageId, fileName, filePath, url, taskId || null, subtaskId || null]
    );

    if (subtaskId) {
      await p.query(`UPDATE \`subtasks\` SET \`imageId\` = ? WHERE \`id\` = ?`, [imageId, subtaskId]);
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
    const [rows]: any = await p.query(`SELECT * FROM \`images\` WHERE \`taskId\` = ? ORDER BY \`createdAt\` ASC`, [taskId]);
    return rows;
  } catch {
    return memoryImagesStore.filter((img) => img.taskId === taskId);
  }
}

// Projects Data Access Helpers
export async function getAllProjectsDB(userId?: number | string) {
  await initDB();
  try {
    const p = getPool();
    if (userId) {
      const numericUserId = Number(userId);
      const [projects]: any = await p.query(
        `SELECT DISTINCT p.* FROM \`projects\` p
         LEFT JOIN \`project_members\` pm ON p.id = pm.projectId
         WHERE p.owner_id = ? OR p.creatorId = ? OR pm.userId = ?
         ORDER BY p.id ASC`,
        [numericUserId, numericUserId, numericUserId]
      );
      return projects;
    }

    const [projects]: any = await p.query(`SELECT * FROM \`projects\` ORDER BY \`id\` ASC`);
    return projects;
  } catch {
    if (userId) {
      const numericUserId = Number(userId);
      return memoryProjectsStore.filter((p) => Number(p.owner_id) === numericUserId || Number(p.creatorId) === numericUserId);
    }
    return memoryProjectsStore;
  }
}

// Create Project DB with Fail-Safe MySQL Parameter Binding
export async function createProjectDB(data: { key?: string; name: string; description?: string; owner_id?: number; creatorId?: number; ownerName?: string }) {
  await initDB();
  const key = (data.key || generate30CharKey()).toUpperCase().trim();
  const name = data.name.trim();
  const description = data.description?.trim() || '';

  const owner_id = (data.owner_id && !isNaN(Number(data.owner_id)))
    ? Number(data.owner_id)
    : ((data.creatorId && !isNaN(Number(data.creatorId))) ? Number(data.creatorId) : 1);
  const creatorId = owner_id;
  const ownerName = data.ownerName || 'karri';

  const p = getPool();
  try {
    const [result]: any = await p.query(
      `INSERT INTO \`projects\` (\`key\`, \`name\`, \`description\`, \`owner_id\`, \`creatorId\`, \`ownerName\`) VALUES (?, ?, ?, ?, ?, ?)`,
      [key, name, description, owner_id, creatorId, ownerName]
    );
    const newId = result.insertId;

    await p.query(
      `INSERT IGNORE INTO \`project_members\` (\`projectId\`, \`userId\`) VALUES (?, ?)`,
      [newId, owner_id]
    );

    return { id: newId, key, name, description, owner_id, creatorId, ownerName };
  } catch (err: any) {
    console.error(`[MySQL DB Error] Failed to insert project ${name}:`, err.message);
    const newId = memoryProjectsStore.length + 10;
    const newProj = { id: newId, key, name, description, owner_id, creatorId, ownerName };
    memoryProjectsStore.push(newProj);
    memoryMembersStore.push({ projectId: newId, userId: owner_id });
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
      await p.query(`UPDATE \`projects\` SET \`name\` = ?, \`description\` = ? WHERE \`id\` = ?`, [name, description, numericId]);
      await p.query(`UPDATE \`issues\` SET \`project\` = ? WHERE \`projectId\` = ?`, [name, numericId]);
    } else if (name) {
      await p.query(`UPDATE \`projects\` SET \`name\` = ? WHERE \`id\` = ?`, [name, numericId]);
      await p.query(`UPDATE \`issues\` SET \`project\` = ? WHERE \`projectId\` = ?`, [name, numericId]);
    } else if (description !== undefined) {
      await p.query(`UPDATE \`projects\` SET \`description\` = ? WHERE \`id\` = ?`, [description, numericId]);
    }
  } catch {
    const target = memoryProjectsStore.find((p) => p.id === numericId);
    if (target) {
      if (name) target.name = name;
      if (description !== undefined) target.description = description;
    }
  }
  return { success: true, id: numericId };
}

export async function deleteProjectDB(id: string | number) {
  await initDB();
  const numericId = Number(id);
  try {
    const p = getPool();
    await p.query(`DELETE FROM \`projects\` WHERE \`id\` = ?`, [numericId]);
  } catch {
    memoryProjectsStore = memoryProjectsStore.filter((p) => p.id !== numericId);
  }
  return { success: true, id: numericId };
}

// Issues Helper
export async function getAllIssuesDB() {
  await initDB();
  try {
    const p = getPool();
    const [issues]: any = await p.query(`SELECT * FROM \`issues\` ORDER BY \`createdAt\` DESC`);
    const [subtasks]: any = await p.query(`SELECT * FROM \`subtasks\``);
    const [images]: any = await p.query(`SELECT * FROM \`images\``);

    return issues.map((iss: any) => ({
      ...iss,
      labels: JSON.parse(iss.labels || '[]'),
      isFavorite: Boolean(iss.isFavorite),
      assignee: {
        id: iss.assigneeName,
        name: iss.assigneeName,
        avatar: iss.assigneeAvatar,
        email: `${iss.assigneeName}@teader.io`,
        role: 'Engineer',
      },
      reporter: {
        id: iss.reporterName,
        name: iss.reporterName,
        avatar: iss.reporterAvatar,
        email: `${iss.reporterName}@teader.io`,
        role: 'Product Manager',
      },
      tags: ['p0'],
      subtasks: subtasks
        .filter((st: any) => st.issueId === iss.id)
        .map((st: any) => {
          const matchedImg = images.find((img: any) => img.id === st.imageId || img.subtaskId === st.id);
          return {
            ...st,
            completed: Boolean(st.completed),
            imageId: st.imageId || matchedImg?.id,
            imageUrl: matchedImg?.url,
          };
        }),
      images: images.filter((img: any) => img.taskId === iss.id),
      timeline: [],
      comments: [],
    }));
  } catch {
    return memoryIssuesStore;
  }
}

export async function createIssueDB(data: {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeName?: string;
  labels?: string[];
  project?: string;
  projectId?: number;
  subtasks?: { id: string; title: string; completed: boolean }[];
}) {
  await initDB();
  const id = `issue_${Date.now()}`;
  const keyNumber = Math.floor(2700 + Math.random() * 500);

  const projects = await getAllProjectsDB();
  let targetProject: any = null;

  if (data.projectId) {
    targetProject = projects.find((p: any) => String(p.id) === String(data.projectId));
  }
  if (!targetProject && data.project) {
    targetProject = projects.find((p: any) => p.name === data.project || p.key === data.project);
  }
  if (!targetProject) {
    targetProject = projects[0] || { id: 1, key: 'PRJTDR9X8K7L6M5N4P3Q2R1S0T9U8V', name: 'Teader Platform Core' };
  }

  const projectKeyPrefix = (targetProject.key || 'TDR').slice(0, 6);
  const projectName = targetProject.name || 'Teader Platform Core';
  const projectId = targetProject.id || 1;

  const key = `${projectKeyPrefix}-${keyNumber}`;
  const title = data.title.trim();
  const description = data.description?.trim() || '';
  const status = data.status || 'todo';
  const priority = data.priority || 'medium';
  const assigneeName = data.assigneeName || 'General (Anyone)';
  const labelsJSON = JSON.stringify(data.labels || ['Task']);
  const subtasks = data.subtasks || [];

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO \`issues\` (\`id\`, \`key\`, \`title\`, \`description\`, \`status\`, \`priority\`, \`assigneeName\`, \`projectId\`, \`project\`, \`labels\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, key, title, description, status, priority, assigneeName, projectId, projectName, labelsJSON]
    );

    for (const sub of subtasks) {
      await p.query(
        `INSERT INTO \`subtasks\` (\`id\`, \`issueId\`, \`title\`, \`completed\`) VALUES (?, ?, ?, ?)`,
        [sub.id || `sub_${Date.now()}_${Math.random()}`, id, sub.title, sub.completed ? 1 : 0]
      );
    }
  } catch {
    const newIssue = {
      id,
      key,
      title,
      description,
      status,
      priority,
      projectId,
      project: projectName,
      assigneeName,
      assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      reporterName: 'karri',
      reporterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      labels: data.labels || ['Task'],
      tags: ['new'],
      sprint: 'Sprint 24.3',
      epic: 'Platform Core',
      isFavorite: false,
      assignee: {
        id: 'usr_1',
        name: assigneeName,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        email: '',
        role: 'Engineer',
      },
      reporter: {
        id: 'usr_2',
        name: 'karri',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        email: 'karri@teader.io',
        role: 'Staff Product Manager',
      },
      subtasks: subtasks.map((st, i) => ({ id: st.id || `sub_${Date.now()}_${i}`, title: st.title, completed: Boolean(st.completed) })),
      images: [],
      timeline: [],
      comments: [],
    };
    memoryIssuesStore.unshift(newIssue);
    return newIssue;
  }

  const all = await getAllIssuesDB();
  return all.find((i: any) => i.id === id);
}

export async function updateIssueStatusDB(id: string, status: string, title?: string, description?: string) {
  await initDB();
  try {
    const p = getPool();
    if (title && description !== undefined) {
      await p.query(`UPDATE \`issues\` SET \`status\` = ?, \`title\` = ?, \`description\` = ? WHERE \`id\` = ?`, [status, title, description, id]);
    } else if (title) {
      await p.query(`UPDATE \`issues\` SET \`status\` = ?, \`title\` = ? WHERE \`id\` = ?`, [status, title, id]);
    } else {
      await p.query(`UPDATE \`issues\` SET \`status\` = ? WHERE \`id\` = ?`, [status, id]);
    }
  } catch {
    const target = memoryIssuesStore.find((i) => i.id === id);
    if (target) {
      target.status = status;
      if (title) target.title = title;
      if (description !== undefined) target.description = description;
    }
  }
}

export async function addSubtaskDB(issueId: string, title: string) {
  await initDB();
  const subId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO \`subtasks\` (\`id\`, \`issueId\`, \`title\`, \`completed\`) VALUES (?, ?, ?, 0)`,
      [subId, issueId, title.trim()]
    );

    const [rows]: any = await p.query(`SELECT \`status\` FROM \`issues\` WHERE \`id\` = ?`, [issueId]);
    if (rows && rows[0] && rows[0].status === 'done') {
      await p.query(`UPDATE \`issues\` SET \`status\` = 'needs_review' WHERE \`id\` = ?`, [issueId]);
    }
  } catch {
    const target = memoryIssuesStore.find((i) => i.id === issueId);
    if (target) {
      target.subtasks.push({ id: subId, title: title.trim(), completed: false });
      if (target.status === 'done') {
        target.status = 'needs_review';
      }
    }
  }
  return { id: subId, issueId, title: title.trim(), completed: false };
}

export async function toggleSubtaskDB(subId: string, completed: boolean) {
  await initDB();
  try {
    const p = getPool();
    await p.query(`UPDATE \`subtasks\` SET \`completed\` = ? WHERE \`id\` = ?`, [completed ? 1 : 0, subId]);

    if (!completed) {
      const [subRows]: any = await p.query(`SELECT \`issueId\` FROM \`subtasks\` WHERE \`id\` = ?`, [subId]);
      if (subRows && subRows[0]) {
        const issueId = subRows[0].issueId;
        const [issRows]: any = await p.query(`SELECT \`status\` FROM \`issues\` WHERE \`id\` = ?`, [issueId]);
        if (issRows && issRows[0] && issRows[0].status === 'done') {
          await p.query(`UPDATE \`issues\` SET \`status\` = 'needs_review' WHERE \`id\` = ?`, [issueId]);
        }
      }
    }
  } catch {
    for (const iss of memoryIssuesStore) {
      const st = iss.subtasks.find((s: any) => s.id === subId);
      if (st) {
        st.completed = completed;
        if (!completed && iss.status === 'done') {
          iss.status = 'needs_review';
        }
        break;
      }
    }
  }
}
