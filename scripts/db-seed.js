const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_HOST = process.env.MYSQL_HOST || 'localhost';
const DB_USER = process.env.MYSQL_USER || 'ajaysaagar';
const DB_PASSWORD = process.env.MYSQL_PASSWORD || 'aass209c';
const DB_NAME = process.env.MYSQL_DATABASE || 'teader_db';
const DB_PORT = Number(process.env.MYSQL_PORT) || 3306;

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}


async function seed() {
  console.log('--- Teader Database Complete Schema & Seed Migration (Infinite Nested Folders & Subtasks) ---');

  try {
    // 1. Root Connection (Create Database)
    const rootConn = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT,
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    console.log(`✓ Database '${DB_NAME}' created/verified.`);
    await rootConn.end();

    // 2. Connect to Database Pool
    const p = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
    });

    // Clean drop old tables in correct dependency order
    console.log('Dropping existing tables for clean schema migration...');
    await p.query(`DROP TABLE IF EXISTS \`images\`;`);
    await p.query(`DROP TABLE IF EXISTS \`subtasks\`;`);
    await p.query(`DROP TABLE IF EXISTS \`issues\`;`);
    await p.query(`DROP TABLE IF EXISTS \`project_members\`;`);
    await p.query(`DROP TABLE IF EXISTS \`projects\`;`);
    await p.query(`DROP TABLE IF EXISTS \`users\`;`);

    // 1. Create Users Table
    console.log('Creating `users` table...');
    await p.query(`
      CREATE TABLE \`users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`avatar\` VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Create Projects Table
    console.log('Creating `projects` table...');
    await p.query(`
      CREATE TABLE \`projects\` (
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

    // 3. Create Project Members Table
    console.log('Creating `project_members` table...');
    await p.query(`
      CREATE TABLE \`project_members\` (
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
    console.log('Creating `issues` table...');
    await p.query(`
      CREATE TABLE \`issues\` (
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

    // 5. Create Subtasks Table with infinite parentId & isFolder support
    console.log('Creating `subtasks` table with infinite recursive parentId and isFolder support...');
    await p.query(`
      CREATE TABLE \`subtasks\` (
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

    // 6. Create Images Table
    console.log('Creating `images` table...');
    await p.query(`
      CREATE TABLE \`images\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`fileName\` VARCHAR(255) NOT NULL,
        \`filePath\` VARCHAR(255) NOT NULL,
        \`url\` VARCHAR(255) NOT NULL,
        \`taskId\` VARCHAR(64) DEFAULT NULL,
        \`subtaskId\` VARCHAR(64) DEFAULT NULL,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed Users
    console.log('Seeding users...');
    const defaultPassword = hashPassword('password123');
    const users = [
      {
        id: 1,
        name: 'karri',
        email: 'karri@teader.io',
        password: defaultPassword,
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      },
      {
        id: 2,
        name: 'jori',
        email: 'jori@teader.io',
        password: defaultPassword,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      },
      {
        id: 3,
        name: 'ajaysaagar',
        email: 'ajaysaagar@teader.io',
        password: defaultPassword,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      },
    ];

    for (const u of users) {
      await p.query(
        `INSERT INTO \`users\` (\`id\`, \`name\`, \`email\`, \`password\`, \`avatar\`) VALUES (?, ?, ?, ?, ?)`,
        [u.id, u.name, u.email, u.password, u.avatar]
      );
    }

    // Seed Projects
    console.log('Seeding projects...');
    const projects = [
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

    for (const proj of projects) {
      await p.query(
        `INSERT INTO \`projects\` (\`id\`, \`key\`, \`name\`, \`description\`, \`owner_id\`, \`creatorId\`, \`ownerName\`) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [proj.id, proj.key, proj.name, proj.description, proj.owner_id, proj.creatorId, proj.ownerName]
      );

      // Join members
      await p.query(`INSERT INTO \`project_members\` (\`projectId\`, \`userId\`) VALUES (?, ?)`, [proj.id, 1]);
      await p.query(`INSERT INTO \`project_members\` (\`projectId\`, \`userId\`) VALUES (?, ?)`, [proj.id, 2]);
      await p.query(`INSERT INTO \`project_members\` (\`projectId\`, \`userId\`) VALUES (?, ?)`, [proj.id, 3]);
    }

    // Seed Issues
    console.log('Seeding engineering tasks & nested folders/subtasks...');
    const issues = [
      // Project 1: Teader Platform Core
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
        labels: JSON.stringify(['Performance', 'Frontend', 'Optimization']),
        sprint: 'Sprint 24.3',
        epic: 'Platform Performance',
        projectId: 1,
        project: 'Teader Platform Core',
        isFavorite: true,
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
        labels: JSON.stringify(['Realtime', 'Backend', 'WebSockets']),
        sprint: 'Sprint 24.3',
        epic: 'Real-time Infrastructure',
        projectId: 1,
        project: 'Teader Platform Core',
        isFavorite: true,
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
        labels: JSON.stringify(['Database', 'MySQL', 'Prisma', 'DevOps']),
        sprint: 'Sprint 24.3',
        epic: 'Database Architecture',
        projectId: 1,
        project: 'Teader Platform Core',
        isFavorite: true,
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
        labels: JSON.stringify(['API', 'OpenAPI', 'Documentation']),
        sprint: 'Sprint 24.3',
        epic: 'API Architecture',
        projectId: 1,
        project: 'Teader Platform Core',
        isFavorite: false,
      },

      // Project 2: Teader Mobile App
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
        labels: JSON.stringify(['Mobile', 'Touch', 'Gestures']),
        sprint: 'Sprint 24.3',
        epic: 'Mobile Experience',
        projectId: 2,
        project: 'Teader Mobile App',
        isFavorite: true,
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
        labels: JSON.stringify(['Offline', 'ServiceWorker', 'Sync']),
        sprint: 'Sprint 24.3',
        epic: 'Mobile Experience',
        projectId: 2,
        project: 'Teader Mobile App',
        isFavorite: false,
      },

      // Project 3: Teader UI Refresh
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
        labels: JSON.stringify(['UI/UX', 'Design System', 'TailwindCSS']),
        sprint: 'Sprint 24.3',
        epic: 'Design System',
        projectId: 3,
        project: 'Teader UI Refresh',
        isFavorite: true,
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
        labels: JSON.stringify(['Hierarchy', 'Tree', 'Components']),
        sprint: 'Sprint 24.3',
        epic: 'Design System',
        projectId: 3,
        project: 'Teader UI Refresh',
        isFavorite: false,
      },
    ];

    for (const issue of issues) {
      await p.query(
        `INSERT INTO \`issues\` (\`id\`, \`key\`, \`title\`, \`description\`, \`status\`, \`priority\`, \`assigneeName\`, \`assigneeAvatar\`, \`reporterName\`, \`reporterAvatar\`, \`labels\`, \`sprint\`, \`epic\`, \`projectId\`, \`project\`, \`isFavorite\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          issue.id,
          issue.key,
          issue.title,
          issue.description,
          issue.status,
          issue.priority,
          issue.assigneeName,
          issue.assigneeAvatar,
          issue.reporterName,
          issue.reporterAvatar,
          issue.labels,
          issue.sprint,
          issue.epic,
          issue.projectId,
          issue.project,
          issue.isFavorite ? 1 : 0,
        ]
      );
    }

    // Seed Multi-level Infinite Folders and Subtasks
    const subtaskSeed = [
      // === Issue 2703 (Workspace Cold Start) ===
      // Level 1 Folder: Client Caching Architecture
      { id: 'fld_2703_cache', issueId: 'issue_2703', parentId: null, title: 'Client Caching Architecture', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2703_1', issueId: 'issue_2703', parentId: 'fld_2703_cache', title: 'Implement cached workspace hydration in localStorage/IndexedDB', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2703_2', issueId: 'issue_2703', parentId: 'fld_2703_cache', title: 'Validate cache invalidation on workspace schema version bump', completed: 1, isFolder: 0, type: 'subtask' },
      // Level 2 Nested Folder inside Caching Architecture: Storage Quotas
      { id: 'fld_2703_quota', issueId: 'issue_2703', parentId: 'fld_2703_cache', title: 'Storage Quota Benchmarks', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2703_3', issueId: 'issue_2703', parentId: 'fld_2703_quota', title: 'Test 50MB payload quota in Safari Private Browsing', completed: 0, isFolder: 0, type: 'subtask' },
      { id: 'sub_2703_4', issueId: 'issue_2703', parentId: 'fld_2703_quota', title: 'Setup automatic LRU eviction policy for stale issue records', completed: 0, isFolder: 0, type: 'subtask' },
      
      // Level 1 Folder: Telemetry & Metrics
      { id: 'fld_2703_telemetry', issueId: 'issue_2703', parentId: null, title: 'Telemetry & Profiling Metrics', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2703_5', issueId: 'issue_2703', parentId: 'fld_2703_telemetry', title: 'Reset dimmed skeleton rows on route reload', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2703_6', issueId: 'issue_2703', parentId: 'fld_2703_telemetry', title: 'Add performance marks and measure cold launch TTI metrics', completed: 0, isFolder: 0, type: 'subtask' },

      // === Issue 2704 (WebSocket Engine) ===
      { id: 'fld_2704_conn', issueId: 'issue_2704', parentId: null, title: 'Connection Resilience', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2704_1', issueId: 'issue_2704', parentId: 'fld_2704_conn', title: 'Setup WebSocket client heartbeats and reconnection backoff', completed: 0, isFolder: 0, type: 'subtask' },
      { id: 'sub_2704_2', issueId: 'issue_2704', parentId: 'fld_2704_conn', title: 'Add presence tracking and active editor broadcast channels', completed: 0, isFolder: 0, type: 'subtask' },
      { id: 'fld_2704_bench', issueId: 'issue_2704', parentId: 'fld_2704_conn', title: 'Socket Stress Tests', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2704_3', issueId: 'issue_2704', parentId: 'fld_2704_bench', title: 'Benchmark socket latency under concurrent project updates', completed: 0, isFolder: 0, type: 'subtask' },

      // === Issue 2705 (Database Migrations) ===
      { id: 'fld_2705_schema', issueId: 'issue_2705', parentId: null, title: 'Schema Indexes & Constraints', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2705_1', issueId: 'issue_2705', parentId: 'fld_2705_schema', title: 'Add composite index on project_members (projectId, userId)', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2705_2', issueId: 'issue_2705', parentId: 'fld_2705_schema', title: 'Implement foreign key cascades for deleted project tasks', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2705_3', issueId: 'issue_2705', parentId: 'fld_2705_schema', title: 'Write automated rollback unit tests for schema changes', completed: 0, isFolder: 0, type: 'subtask' },

      // === Issue 2706 (OpenAPI Spec) ===
      { id: 'sub_2706_1', issueId: 'issue_2706', parentId: null, title: 'Generate OpenAPI spec JSON endpoint at /api/swagger', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2706_2', issueId: 'issue_2706', parentId: null, title: 'Integrate Swagger UI interactive test console', completed: 1, isFolder: 0, type: 'subtask' },

      // === Issue 2707 (Mobile Gestures) ===
      { id: 'fld_2707_touch', issueId: 'issue_2707', parentId: null, title: 'Touch Handlers & Physics', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2707_1', issueId: 'issue_2707', parentId: 'fld_2707_touch', title: 'Configure touch-drag event listeners with horizontal scroll lock', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2707_2', issueId: 'issue_2707', parentId: 'fld_2707_touch', title: 'Add vibration haptic feedback on card drop into new stage', completed: 0, isFolder: 0, type: 'subtask' },

      // === Issue 2708 (Offline Sync) ===
      { id: 'fld_2708_sync', issueId: 'issue_2708', parentId: null, title: 'Sync Engine & Resolvers', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2708_1', issueId: 'issue_2708', parentId: 'fld_2708_sync', title: 'Implement optimistic offline task status transitions', completed: 0, isFolder: 0, type: 'subtask' },
      { id: 'sub_2708_2', issueId: 'issue_2708', parentId: 'fld_2708_sync', title: 'Handle conflict resolution when online task has newer timestamp', completed: 0, isFolder: 0, type: 'subtask' },

      // === Issue 2709 (UI Refresh Polish) ===
      { id: 'fld_2709_tokens', issueId: 'issue_2709', parentId: null, title: 'Design Tokens & Aesthetics', completed: 0, isFolder: 1, type: 'folder' },
      { id: 'sub_2709_1', issueId: 'issue_2709', parentId: 'fld_2709_tokens', title: 'Audit contrast ratios for secondary and muted typography', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2709_2', issueId: 'issue_2709', parentId: 'fld_2709_tokens', title: 'Standardize badge and pill border radius across views', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2709_3', issueId: 'issue_2709', parentId: 'fld_2709_tokens', title: 'Ensure smooth 150ms Framer Motion micro-interactions', completed: 0, isFolder: 0, type: 'subtask' },

      // === Issue 2710 (Tree Connector Guides) ===
      { id: 'sub_2710_1', issueId: 'issue_2710', parentId: null, title: 'Implement nested indentation and guide line styling', completed: 1, isFolder: 0, type: 'subtask' },
      { id: 'sub_2710_2', issueId: 'issue_2710', parentId: null, title: 'Add expand/collapse all toggle controls with animations', completed: 1, isFolder: 0, type: 'subtask' },
    ];

    for (const sub of subtaskSeed) {
      await p.query(
        `INSERT INTO \`subtasks\` (\`id\`, \`issueId\`, \`parentId\`, \`title\`, \`completed\`, \`isFolder\`, \`type\`)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sub.id, sub.issueId, sub.parentId, sub.title, sub.completed ? 1 : 0, sub.isFolder ? 1 : 0, sub.type || 'subtask']
      );
    }

    console.log('🎉 MySQL Database seeding & migration with infinite nested folders & subtasks completed successfully!');
    await p.end();
  } catch (err) {
    console.error('Error during database seed:', err.message);
    process.exit(1);
  }
}

seed();
