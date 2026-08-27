import mysql from 'mysql2/promise';

// MySQL Connection Config — all credentials must be set via environment variables.
// Hardcoded fallbacks have been intentionally removed.
if (!process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD || !process.env.MYSQL_DATABASE) {
  throw new Error(
    '[teader] Required env vars MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE must be set. ' +
    'See .env.example for reference.'
  );
}
const DB_HOST = process.env.MYSQL_HOST ?? 'localhost';
const DB_USER = process.env.MYSQL_USER;
const DB_PASSWORD = process.env.MYSQL_PASSWORD;
const DB_NAME = process.env.MYSQL_DATABASE;
const DB_PORT = Number(process.env.MYSQL_PORT) || 3306;

let pool: mysql.Pool | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 30000,
      connectTimeout: 4000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
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

import crypto from 'crypto';
import { hashPassword, verifyPassword } from './auth';

/** @deprecated sha256 — used only to compare old hashes during the bcrypt migration window */
function legacySha256(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

export function generate30CharKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PRJ';
  for (let i = 0; i < 27; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Initialize Database & Tables automatically (singleton promise)
export async function initDB(): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
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

    // 5. Create Subtasks Table with infinite recursive parentId & isFolder support
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`subtasks\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`issueId\` VARCHAR(64) NOT NULL,
        \`parentId\` VARCHAR(64) DEFAULT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`completed\` TINYINT(1) DEFAULT 0,
        \`isFolder\` TINYINT(1) DEFAULT 0,
        \`type\` VARCHAR(32) DEFAULT 'subtask',
        \`imageId\` VARCHAR(64) DEFAULT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_subtasks_parentId\` (\`parentId\`),
        FOREIGN KEY (\`issueId\`) REFERENCES \`issues\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns exist on existing table
    try { await p.query(`ALTER TABLE \`subtasks\` ADD COLUMN \`parentId\` VARCHAR(64) DEFAULT NULL;`); } catch {}
    try { await p.query(`ALTER TABLE \`subtasks\` ADD COLUMN \`isFolder\` TINYINT(1) DEFAULT 0;`); } catch {}
    try { await p.query(`ALTER TABLE \`subtasks\` ADD COLUMN \`type\` VARCHAR(32) DEFAULT 'subtask';`); } catch {}
    try { await p.query(`ALTER TABLE \`subtasks\` ADD INDEX \`idx_subtasks_parentId\` (\`parentId\`);`); } catch {}

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

    // 7. Add `role` column to project_members (P1-5)
    try { await p.query(`ALTER TABLE \`project_members\` ADD COLUMN \`role\` VARCHAR(32) NOT NULL DEFAULT 'member';`); } catch {}

    // 8. Create Comments table (P1-2)
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`comments\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`body\` TEXT NOT NULL,
        \`issueId\` VARCHAR(64) NOT NULL,
        \`authorId\` INT NOT NULL,
        \`parentId\` VARCHAR(64) DEFAULT NULL,
        \`editedAt\` TIMESTAMP NULL DEFAULT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_comments_issueId\` (\`issueId\`),
        FOREIGN KEY (\`issueId\`) REFERENCES \`issues\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`authorId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. Create Activity / Audit log table (P1-3)
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`activities\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`issueId\` VARCHAR(64) NOT NULL,
        \`actorId\` INT DEFAULT NULL,
        \`actorName\` VARCHAR(128) NOT NULL DEFAULT 'system',
        \`type\` VARCHAR(64) NOT NULL,
        \`payload\` JSON DEFAULT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_activities_issueId\` (\`issueId\`),
        FOREIGN KEY (\`issueId\`) REFERENCES \`issues\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 10. Create Labels table (P1-4)
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`labels\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(128) NOT NULL,
        \`color\` VARCHAR(32) NOT NULL DEFAULT '#787C83',
        \`projectId\` INT NOT NULL,
        FOREIGN KEY (\`projectId\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 11. Create IssueLabel join table (P1-4)
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`issue_labels\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`issueId\` VARCHAR(64) NOT NULL,
        \`labelId\` INT NOT NULL,
        UNIQUE KEY \`unique_issue_label\` (\`issueId\`, \`labelId\`),
        FOREIGN KEY (\`issueId\`) REFERENCES \`issues\`(\`id\`) ON DELETE CASCADE,
        FOREIGN KEY (\`labelId\`) REFERENCES \`labels\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 12. Create Sprints table (P1-6)
    await p.query(`
      CREATE TABLE IF NOT EXISTS \`sprints\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(128) NOT NULL,
        \`projectId\` INT NOT NULL,
        \`startDate\` DATE DEFAULT NULL,
        \`endDate\` DATE DEFAULT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`projectId\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 13. Add assigneeId / reporterId / sprintId FK columns to issues (P1-1)
    try { await p.query(`ALTER TABLE \`issues\` ADD COLUMN \`assigneeId\` INT DEFAULT NULL;`); } catch {}
    try { await p.query(`ALTER TABLE \`issues\` ADD COLUMN \`reporterId\` INT DEFAULT NULL;`); } catch {}
    try { await p.query(`ALTER TABLE \`issues\` ADD COLUMN \`sprintId\` INT DEFAULT NULL;`); } catch {}


    const [userRows]: any = await p.query(`SELECT COUNT(*) as cnt FROM \`users\``);
    if (userRows[0].cnt === 0) {
      await seedDefaultUsers(p);
    }

    // Seed Default Projects if Empty
    const [projectRows]: any = await p.query(`SELECT COUNT(*) as cnt FROM \`projects\``);
    if (projectRows[0].cnt === 0) {
      await seedDefaultProjectsAndTasks(p);
    }

        initialized = true;
      } catch (err: any) {
        console.warn('MySQL initialization note:', err.message);
        if (memoryUsersStore.length === 0) memoryUsersStore = getInitialSeedUsers();
        if (memoryProjectsStore.length === 0) memoryProjectsStore = getInitialSeedProjects();
        if (memoryIssuesStore.length === 0) memoryIssuesStore = getInitialSeedIssues();
      } finally {
        initialized = true;
      }
    })();
  }
  return initPromise;
}


function getInitialSeedUsers() {
  // Pre-hashed bcrypt hash for 'password123' (cost: 12)
  const defaultPasswordHash = '$2b$12$lL3YVRs0PjHqNNMDJ8xKbempzfCQcMDdwHZn6k0A7oFtrZpOn82ea';
  return [
    {
      id: 1,
      name: 'karri',
      email: 'karri@teader.io',
      password: defaultPasswordHash,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 2,
      name: 'jori',
      email: 'jori@teader.io',
      password: defaultPasswordHash,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 3,
      name: 'ajaysaagar',
      email: 'ajaysaagar@teader.io',
      password: defaultPasswordHash,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    },
  ];
}


function getInitialSeedProjects() {
  return [
    {
      id: 1,
      key: 'PRJTDR9X8K7L6M5N4P3Q2R1S0T9U8V',
      name: 'Teader Platform Core',
      description: 'Core backend microservices, real-time WebSocket pipelines, and streaming architecture.',
      owner_id: 1,
      creatorId: 1,
      ownerName: 'karri',
    },
    {
      id: 2,
      key: 'PRJMOB8Y7X6W5V4U3T2S1R0Q9P8O7N',
      name: 'Teader Mobile App',
      description: 'iOS and Android client performance, gesture interactions, and offline caching engine.',
      owner_id: 1,
      creatorId: 1,
      ownerName: 'karri',
    },
    {
      id: 3,
      key: 'PRJUI7Z6Y5X4W3V2U1T0S9R8Q7P6O5',
      name: 'Teader UI Refresh',
      description: 'Design system, dark theme typography, and high-density spatial layouts.',
      owner_id: 1,
      creatorId: 1,
      ownerName: 'karri',
    },
  ];
}

function getInitialSeedIssues() {
  return [
    {
      id: 'issue_2703',
      key: 'TDR-2703',
      title: 'Optimize initial workspace load & cold start performance',
      description: 'Defer non-critical telemetry streams and hydrate core project workspace prior to full background sync to achieve <200ms TTI.',
      status: 'in_progress',
      priority: 'high',
      assigneeName: 'jori',
      assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      reporterName: 'karri',
      reporterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      labels: ['Performance', 'Frontend', 'Optimization'],
      sprint: 'Sprint 24.3',
      epic: 'Platform Performance',
      projectId: 1,
      project: 'Teader Platform Core',
      isFavorite: true,
      subtasks: [
        { id: 'sub_1', title: 'Implement cached workspace hydration in localStorage/IndexedDB', completed: true },
        { id: 'sub_2', title: 'Reset dimmed skeleton rows on route reload', completed: true },
        { id: 'sub_3', title: 'Add performance marks and measure cold launch TTI metrics', completed: false },
      ],
      timeline: [],
      comments: [],
      images: [],
    },
    {
      id: 'issue_2704',
      key: 'TDR-2704',
      title: 'Implement real-time WebSocket subscription engine for task updates',
      description: 'Establish persistent bi-directional WebSocket connection channels with automatic heartbeat reconnection and state backoff for live collaboration.',
      status: 'todo',
      priority: 'medium',
      assigneeName: 'karri',
      assigneeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      reporterName: 'jori',
      reporterAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      labels: ['Realtime', 'Backend', 'WebSockets'],
      sprint: 'Sprint 24.3',
      epic: 'Real-time Infrastructure',
      projectId: 1,
      project: 'Teader Platform Core',
      isFavorite: true,
      subtasks: [
        { id: 'sub_4', title: 'Setup WebSocket client heartbeats and reconnection backoff', completed: false },
        { id: 'sub_5', title: 'Add presence tracking and active editor broadcast channels', completed: false },
        { id: 'sub_6', title: 'Benchmark socket latency under concurrent project updates', completed: false },
      ],
      timeline: [],
      comments: [],
      images: [],
    },
    {
      id: 'issue_2705',
      key: 'TDR-2705',
      title: 'Build automated database migration & schema validation pipeline',
      description: 'Create transactional schema migrations and automated integrity tests for project keys, subtask relations, and user access roles.',
      status: 'needs_review',
      priority: 'critical',
      assigneeName: 'jori',
      assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      reporterName: 'karri',
      reporterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      labels: ['Database', 'MySQL', 'Prisma', 'DevOps'],
      sprint: 'Sprint 24.3',
      epic: 'Database Architecture',
      projectId: 1,
      project: 'Teader Platform Core',
      isFavorite: true,
      subtasks: [
        { id: 'sub_7', title: 'Add composite index on project_members (projectId, userId)', completed: true },
        { id: 'sub_8', title: 'Implement foreign key cascades for deleted project tasks', completed: true },
        { id: 'sub_9', title: 'Write automated rollback unit tests for schema changes', completed: false },
      ],
      timeline: [],
      comments: [],
      images: [],
    },
    {
      id: 'issue_2706',
      key: 'TDR-2706',
      title: 'Design RESTful OpenAPI v3 specification and Swagger UI docs',
      description: 'Document full issue CRUD endpoints, project membership APIs, subtask toggles, and user authentication schemas.',
      status: 'done',
      priority: 'medium',
      assigneeName: 'karri',
      assigneeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      reporterName: 'jori',
      reporterAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      labels: ['API', 'OpenAPI', 'Documentation'],
      sprint: 'Sprint 24.3',
      epic: 'API Architecture',
      projectId: 1,
      project: 'Teader Platform Core',
      isFavorite: false,
      subtasks: [
        { id: 'sub_10', title: 'Generate OpenAPI spec JSON endpoint at /api/swagger', completed: true },
        { id: 'sub_11', title: 'Integrate Swagger UI interactive test console', completed: true },
      ],
      timeline: [],
      comments: [],
      images: [],
    },
    {
      id: 'issue_2707',
      key: 'MOB-101',
      title: 'Implement gesture-based Kanban card reordering for mobile touch',
      description: 'Add fluid haptic feedback and spring physics using Framer Motion gestures for moving tasks between columns on iOS and Android viewports.',
      status: 'in_progress',
      priority: 'high',
      assigneeName: 'jori',
      assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      reporterName: 'karri',
      reporterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      labels: ['Mobile', 'Touch', 'Gestures'],
      sprint: 'Sprint 24.3',
      epic: 'Mobile Experience',
      projectId: 2,
      project: 'Teader Mobile App',
      isFavorite: true,
      subtasks: [
        { id: 'sub_12', title: 'Configure touch-drag event listeners with horizontal scroll lock', completed: true },
        { id: 'sub_13', title: 'Add vibration haptic feedback on card drop into new stage', completed: false },
      ],
      timeline: [],
      comments: [],
      images: [],
    },
    {
      id: 'issue_2708',
      key: 'MOB-102',
      title: 'Offline mode mutation queuing and background synchronization',
      description: 'Queue offline task status changes in IndexedDB and replay with exponential backoff upon network restoration.',
      status: 'todo',
      priority: 'critical',
      assigneeName: 'karri',
      assigneeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      reporterName: 'jori',
      reporterAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      labels: ['Offline', 'ServiceWorker', 'Sync'],
      sprint: 'Sprint 24.3',
      epic: 'Mobile Experience',
      projectId: 2,
      project: 'Teader Mobile App',
      isFavorite: false,
      subtasks: [
        { id: 'sub_14', title: 'Implement optimistic offline task status transitions', completed: false },
        { id: 'sub_15', title: 'Handle conflict resolution when online task has newer timestamp', completed: false },
      ],
      timeline: [],
      comments: [],
      images: [],
    },
    {
      id: 'issue_2709',
      key: 'UI-804',
      title: 'Refine dark theme design system typography and high-density spacing',
      description: 'Standardize 8px spatial grid, semantic color tokens, subtle glassmorphic borders (#2A2C30), and WCAG-compliant contrast across all components.',
      status: 'needs_review',
      priority: 'high',
      assigneeName: 'jori',
      assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      reporterName: 'karri',
      reporterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      labels: ['UI/UX', 'Design System', 'TailwindCSS'],
      sprint: 'Sprint 24.3',
      epic: 'Design System',
      projectId: 3,
      project: 'Teader UI Refresh',
      isFavorite: true,
      subtasks: [
        { id: 'sub_16', title: 'Audit contrast ratios for secondary and muted typography', completed: true },
        { id: 'sub_17', title: 'Standardize badge and pill border radius across views', completed: true },
        { id: 'sub_18', title: 'Ensure smooth 150ms Framer Motion micro-interactions', completed: false },
      ],
      timeline: [],
      comments: [],
      images: [],
    },
    {
      id: 'issue_2710',
      key: 'UI-805',
      title: 'Add hierarchical tree connector lines and SVG branch guides',
      description: 'Render clean vertical connecting guide rails for Epics -> Tasks -> Sub-works tree layout with dynamic collapse animations.',
      status: 'done',
      priority: 'medium',
      assigneeName: 'karri',
      assigneeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      reporterName: 'jori',
      reporterAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      labels: ['Hierarchy', 'Tree', 'Components'],
      sprint: 'Sprint 24.3',
      epic: 'Design System',
      projectId: 3,
      project: 'Teader UI Refresh',
      isFavorite: false,
      subtasks: [
        { id: 'sub_19', title: 'Implement nested indentation and guide line styling', completed: true },
        { id: 'sub_20', title: 'Add expand/collapse all toggle controls with animations', completed: true },
      ],
      timeline: [],
      comments: [],
      images: [],
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

async function seedDefaultProjectsAndTasks(p: mysql.Pool) {
  for (const proj of getInitialSeedProjects()) {
    await p.query(
      `INSERT INTO \`projects\` (\`id\`, \`key\`, \`name\`, \`description\`, \`owner_id\`, \`creatorId\`, \`ownerName\`) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [proj.id, proj.key, proj.name, proj.description, proj.owner_id, proj.creatorId, proj.ownerName]
    );
    await p.query(`INSERT IGNORE INTO \`project_members\` (\`projectId\`, \`userId\`) VALUES (?, ?)`, [proj.id, 1]);
    await p.query(`INSERT IGNORE INTO \`project_members\` (\`projectId\`, \`userId\`) VALUES (?, ?)`, [proj.id, 2]);
    await p.query(`INSERT IGNORE INTO \`project_members\` (\`projectId\`, \`userId\`) VALUES (?, ?)`, [proj.id, 3]);
  }

  for (const iss of getInitialSeedIssues()) {
    await p.query(
      `INSERT INTO \`issues\` (\`id\`, \`key\`, \`title\`, \`description\`, \`status\`, \`priority\`, \`assigneeName\`, \`assigneeAvatar\`, \`reporterName\`, \`reporterAvatar\`, \`labels\`, \`sprint\`, \`epic\`, \`projectId\`, \`project\`, \`isFavorite\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        iss.id,
        iss.key,
        iss.title,
        iss.description,
        iss.status,
        iss.priority,
        iss.assigneeName,
        iss.assigneeAvatar,
        iss.reporterName,
        iss.reporterAvatar,
        JSON.stringify(iss.labels),
        iss.sprint,
        iss.epic,
        iss.projectId,
        iss.project,
        iss.isFavorite ? 1 : 0,
      ]
    );

    for (const sub of iss.subtasks) {
      await p.query(
        `INSERT INTO \`subtasks\` (\`id\`, \`issueId\`, \`title\`, \`completed\`) VALUES (?, ?, ?, ?)`,
        [sub.id, iss.id, sub.title, sub.completed ? 1 : 0]
      );
    }
  }
}

// User Auth Helpers
export async function registerUserDB(data: { name: string; email: string; password: string }) {
  await initDB();
  const name = data.name.trim();
  const email = data.email.toLowerCase().trim();
  const hashedPassword = await hashPassword(data.password); // bcrypt
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

  try {
    const p = getPool();
    const [rows]: any = await p.query(
      `SELECT * FROM \`users\` WHERE \`email\` = ?`,
      [emailLower]
    );

    if (rows && rows.length > 0) {
      const user = rows[0];
      const isValid = await verifyPassword(passwordUnhashed, user.password);

      if (!isValid) throw new Error('Invalid email or password');

      // ─── Migration: re-hash sha256 passwords to bcrypt on successful login ───
      if (/^[a-f0-9]{64}$/.test(user.password)) {
        try {
          const newHash = await hashPassword(passwordUnhashed);
          await p.query(`UPDATE \`users\` SET \`password\` = ? WHERE \`id\` = ?`, [newHash, user.id]);
        } catch {}
      }

      return { id: user.id, name: user.name, email: user.email, avatar: user.avatar };
    }
  } catch (err: any) {
    if (err.message === 'Invalid email or password') throw err;
  }

  // Fallback to in-memory store (e.g. if DB is unreachable, empty, or during offline dev)
  const memUser = memoryUsersStore.find((u) => u.email === emailLower);
  if (memUser && (await verifyPassword(passwordUnhashed, memUser.password))) {
    return { id: memUser.id, name: memUser.name, email: memUser.email, avatar: memUser.avatar };
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

export async function getProjectByIdDB(id: string | number) {
  const projects = await getAllProjectsDB();
  return projects.find((p: any) => String(p.id) === String(id) || String(p.key).toLowerCase() === String(id).toLowerCase()) || null;
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
      subtasks: buildSubtaskTree(
        subtasks.filter((st: any) => st.issueId === iss.id),
        images
      ),
      images: images.filter((img: any) => img.taskId === iss.id),
      timeline: [],
      comments: [],
    }));
  } catch {
    return memoryIssuesStore;
  }
}

// Recursive Helper to Build Infinite Nested Tree of Subtasks and Folders
export function buildSubtaskTree(flatSubtasks: any[], images: any[] = []): any[] {
  const map = new Map<string, any>();
  const roots: any[] = [];

  flatSubtasks.forEach((st) => {
    const matchedImg = images.find((img: any) => img.id === st.imageId || img.subtaskId === st.id);
    map.set(st.id, {
      id: st.id,
      issueId: st.issueId,
      parentId: st.parentId || null,
      title: st.title,
      completed: Boolean(st.completed),
      isFolder: Boolean(st.isFolder),
      type: st.type || (st.isFolder ? 'folder' : 'subtask'),
      imageId: st.imageId || matchedImg?.id,
      imageUrl: matchedImg?.url,
      createdAt: st.createdAt,
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

export async function createIssueDB(data: {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeName?: string;
  labels?: string[];
  project?: string;
  projectId?: number;
  subtasks?: { id?: string; parentId?: string | null; title: string; completed: boolean; isFolder?: boolean; type?: 'folder' | 'subtask' }[];
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
        `INSERT INTO \`subtasks\` (\`id\`, \`issueId\`, \`parentId\`, \`title\`, \`completed\`, \`isFolder\`, \`type\`) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sub.id || `sub_${Date.now()}_${Math.random()}`,
          id,
          sub.parentId || null,
          sub.title,
          sub.completed ? 1 : 0,
          sub.isFolder ? 1 : 0,
          sub.type || (sub.isFolder ? 'folder' : 'subtask')
        ]
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
      subtasks: buildSubtaskTree(
        subtasks.map((st, i) => ({
          id: st.id || `sub_${Date.now()}_${i}`,
          issueId: id,
          parentId: st.parentId || null,
          title: st.title,
          completed: Boolean(st.completed),
          isFolder: Boolean(st.isFolder),
          type: st.type || (st.isFolder ? 'folder' : 'subtask'),
        }))
      ),
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

  if (updates.status !== undefined) {
    fields.push('`status` = ?');
    values.push(updates.status);
  }
  if (updates.title !== undefined) {
    fields.push('`title` = ?');
    values.push(updates.title.trim());
  }
  if (updates.description !== undefined) {
    fields.push('`description` = ?');
    values.push(updates.description.trim());
  }
  if (updates.epic !== undefined) {
    fields.push('`epic` = ?');
    values.push(updates.epic.trim());
  }
  if (updates.priority !== undefined) {
    fields.push('`priority` = ?');
    values.push(updates.priority);
  }
  if (updates.assigneeName !== undefined) {
    fields.push('`assigneeName` = ?');
    values.push(updates.assigneeName);
  }
  if (updates.dueDate !== undefined) {
    fields.push('`dueDate` = ?');
    values.push(updates.dueDate);
  }
  if (updates.estimatedHours !== undefined) {
    fields.push('`estimatedHours` = ?');
    values.push(updates.estimatedHours);
  }
  if (updates.loggedHours !== undefined) {
    fields.push('`loggedHours` = ?');
    values.push(updates.loggedHours);
  }
  if (updates.labels !== undefined) {
    fields.push('`labels` = ?');
    values.push(JSON.stringify(updates.labels));
  }

  try {
    const p = getPool();
    if (fields.length > 0) {
      values.push(id);
      await p.query(`UPDATE \`issues\` SET ${fields.join(', ')} WHERE \`id\` = ?`, values);
    }
  } catch {
    // Failover to memory store
  }

  // Always sync memory store
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

  if (updates.title !== undefined) {
    fields.push('`title` = ?');
    values.push(updates.title.trim());
  }
  if (updates.completed !== undefined) {
    fields.push('`completed` = ?');
    values.push(updates.completed ? 1 : 0);
  }
  if (updates.parentId !== undefined) {
    fields.push('`parentId` = ?');
    values.push(updates.parentId);
  }
  if (updates.issueId !== undefined) {
    fields.push('`issueId` = ?');
    values.push(updates.issueId);
  }

  if (fields.length === 0) return;

  try {
    const p = getPool();
    values.push(subId);
    await p.query(`UPDATE \`subtasks\` SET ${fields.join(', ')} WHERE \`id\` = ?`, values);

    // If completed was updated and it is a folder, cascade to direct child items
    if (updates.completed !== undefined) {
      await p.query(`UPDATE \`subtasks\` SET \`completed\` = ? WHERE \`parentId\` = ?`, [
        updates.completed ? 1 : 0,
        subId,
      ]);
    }
  } catch {
    // Failover: Extract node and re-insert into new parent or root
    let extracted: any = null;
    const removeMem = (items: any[]): any[] => {
      const res: any[] = [];
      for (const item of items) {
        if (item.id === subId) {
          extracted = item;
        } else {
          const copy = { ...item };
          if (copy.subtasks) copy.subtasks = removeMem(copy.subtasks);
          res.push(copy);
        }
      }
      return res;
    };

    for (const iss of memoryIssuesStore) {
      if (iss.subtasks) iss.subtasks = removeMem(iss.subtasks);
    }

    if (extracted) {
      if (updates.title !== undefined) extracted.title = updates.title.trim();
      if (updates.completed !== undefined) extracted.completed = updates.completed;
      if (updates.parentId !== undefined) extracted.parentId = updates.parentId;
      if (updates.issueId !== undefined) extracted.issueId = updates.issueId;

      const targetIss = memoryIssuesStore.find((i) => i.id === (updates.issueId || extracted.issueId));
      if (targetIss) {
        if (!targetIss.subtasks) targetIss.subtasks = [];
        if (!updates.parentId) {
          targetIss.subtasks.push(extracted);
        } else {
          const insertMem = (items: any[]): boolean => {
            for (const it of items) {
              if (it.id === updates.parentId) {
                if (!it.subtasks) it.subtasks = [];
                it.isFolder = true;
                it.subtasks.push(extracted);
                return true;
              }
              if (it.subtasks && insertMem(it.subtasks)) return true;
            }
            return false;
          };
          if (!insertMem(targetIss.subtasks)) {
            targetIss.subtasks.push(extracted);
          }
        }
      }
    }
  }
}


export async function addSubtaskDB(
  issueId: string,
  title: string,
  parentId: string | null = null,
  isFolder: boolean = false,
  type: 'folder' | 'subtask' = 'subtask'
) {
  await initDB();
  const subId = isFolder ? `fld_${Date.now()}_${Math.floor(Math.random() * 1000)}` : `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  try {
    const p = getPool();
    await p.query(
      `INSERT INTO \`subtasks\` (\`id\`, \`issueId\`, \`parentId\`, \`title\`, \`completed\`, \`isFolder\`, \`type\`) VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [subId, issueId, parentId, title.trim(), isFolder ? 1 : 0, type]
    );

    const [rows]: any = await p.query(`SELECT \`status\` FROM \`issues\` WHERE \`id\` = ?`, [issueId]);
    if (rows && rows[0] && rows[0].status === 'done') {
      await p.query(`UPDATE \`issues\` SET \`status\` = 'needs_review' WHERE \`id\` = ?`, [issueId]);
    }
  } catch {
    const target = memoryIssuesStore.find((i) => i.id === issueId);
    if (target) {
      const newItem = {
        id: subId,
        issueId,
        parentId,
        title: title.trim(),
        completed: false,
        isFolder,
        type,
        subtasks: [],
      };
      if (!parentId) {
        target.subtasks.push(newItem);
      } else {
        const findAndInsert = (items: any[]): boolean => {
          for (const it of items) {
            if (it.id === parentId) {
              if (!it.subtasks) it.subtasks = [];
              it.subtasks.push(newItem);
              return true;
            }
            if (it.subtasks && findAndInsert(it.subtasks)) return true;
          }
          return false;
        };
        findAndInsert(target.subtasks);
      }
      if (target.status === 'done') {
        target.status = 'needs_review';
      }
    }
  }
  return { id: subId, issueId, parentId, title: title.trim(), completed: false, isFolder, type, subtasks: [] };
}

export async function deleteSubtaskDB(subId: string) {
  await initDB();
  try {
    const p = getPool();
    await p.query(`DELETE FROM \`subtasks\` WHERE \`id\` = ? OR \`parentId\` = ?`, [subId, subId]);
  } catch {
    const removeRecursive = (items: any[]) => {
      const idx = items.findIndex((s) => s.id === subId);
      if (idx !== -1) {
        items.splice(idx, 1);
        return true;
      }
      for (const it of items) {
        if (it.subtasks && removeRecursive(it.subtasks)) return true;
      }
      return false;
    };
    for (const iss of memoryIssuesStore) {
      if (iss.subtasks) removeRecursive(iss.subtasks);
    }
  }
}

export async function toggleSubtaskDB(subId: string, completed: boolean) {
  await initDB();
  try {
    const p = getPool();
    await p.query(`UPDATE \`subtasks\` SET \`completed\` = ? WHERE \`id\` = ?`, [completed ? 1 : 0, subId]);

    // Also update any child subtasks if this was a folder
    await p.query(`UPDATE \`subtasks\` SET \`completed\` = ? WHERE \`parentId\` = ?`, [completed ? 1 : 0, subId]);

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
    const updateRecursive = (items: any[]) => {
      for (const st of items) {
        if (st.id === subId) {
          st.completed = completed;
          if (st.subtasks) {
            const setChild = (children: any[]) => {
              children.forEach((c) => {
                c.completed = completed;
                if (c.subtasks) setChild(c.subtasks);
              });
            };
            setChild(st.subtasks);
          }
          return true;
        }
        if (st.subtasks && updateRecursive(st.subtasks)) return true;
      }
      return false;
    };

    for (const iss of memoryIssuesStore) {
      if (iss.subtasks) {
        updateRecursive(iss.subtasks);
        if (!completed && iss.status === 'done') {
          iss.status = 'needs_review';
        }
      }
    }
  }
}
