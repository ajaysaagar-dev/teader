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
  console.log('--- Teader PostgreSQL Database Schema & Hierarchical Seed Migration ---');

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

    // 1. Clean drop old tables in correct dependency order
    console.log('Dropping existing tables for clean schema migration...');
    await pool.query(`DROP TABLE IF EXISTS "project_messages" CASCADE;`);
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

    // 2. Create Users Table
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

    // 3. Create Projects Table
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

    // 4. Create Project Members Table
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

    // 5. Create Issues Table
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

    // 6. Create Subtasks Table
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

    // 7. Create Images Table
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

    // 8. Create Comments Table
    console.log('Creating "comments" table...');
    await pool.query(`
      CREATE TABLE "comments" (
        "id" VARCHAR(64) PRIMARY KEY,
        "body" TEXT NOT NULL,
        "issueId" VARCHAR(64) NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
        "authorId" INT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "parentId" VARCHAR(64) DEFAULT NULL,
        "editedAt" TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Create Activities Table
    console.log('Creating "activities" table...');
    await pool.query(`
      CREATE TABLE "activities" (
        "id" VARCHAR(64) PRIMARY KEY,
        "issueId" VARCHAR(64) NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
        "actorId" INT DEFAULT NULL,
        "actorName" VARCHAR(128) NOT NULL DEFAULT 'system',
        "type" VARCHAR(64) NOT NULL,
        "payload" JSONB DEFAULT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Create Project Docs Table
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

    // 11. Create Project Messages Table
    console.log('Creating "project_messages" table...');
    await pool.query(`
      CREATE TABLE "project_messages" (
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

    // ─── Insert Users ──────────────────────────────────────────────────────────
    console.log('Seeding users for karri and team...');
    const defaultPasswordHash = hashPassword('password123');

    const users = [
      { id: 1, name: 'karri', email: 'karri@teader.io', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
      { id: 2, name: 'jori', email: 'jori@teader.io', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
      { id: 3, name: 'ajaysaagar', email: 'ajaysaagar@teader.io', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80' },
      { id: 4, name: 'sarah', email: 'sarah@teader.io', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
      { id: 5, name: 'alex', email: 'alex@teader.io', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
    ];

    for (const u of users) {
      await pool.query(
        `INSERT INTO "users" ("id", "name", "email", "password", "avatar") VALUES ($1, $2, $3, $4, $5)`,
        [u.id, u.name, u.email, defaultPasswordHash, u.avatar]
      );
    }
    await pool.query(`SELECT setval('users_id_seq', 10, true);`);

    // ─── Insert Projects Owned by Karri ────────────────────────────────────────
    console.log('Seeding projects for user karri...');
    const projects = [
      {
        id: 1,
        key: 'PRJTDR9X8K7L6M5N4P3Q2R1S0T9U8V',
        name: 'Teader Platform Core',
        description: 'Next-generation project management engineered for high-performance software teams and autonomous AI coding agents.',
        owner_id: 1,
        creatorId: 1,
        ownerName: 'karri',
      },
      {
        id: 2,
        key: 'PRJAIX8Y7Z6W5V4U3T2S1R0Q9P8O7N',
        name: 'Autonomous AI Agent Orchestrator',
        description: 'Multi-agent task execution engine, tool calling runtime sandbox, and LLM reasoning pipelines.',
        owner_id: 1,
        creatorId: 1,
        ownerName: 'karri',
      },
      {
        id: 3,
        key: 'PRJDSK7A6B5C4D3E2F1G0H9I8J7K6L',
        name: 'Teader Desktop Native Client',
        description: 'Electron 34 desktop shell with custom titlebars, ultra-low RAM footprint, and local offline sync.',
        owner_id: 1,
        creatorId: 1,
        ownerName: 'karri',
      },
      {
        id: 4,
        key: 'PRJEDG5M4N3O2P1Q0R9S8T7U6V5W4X',
        name: 'High-Throughput Edge API Gateway',
        description: 'Distributed WebSocket broadcast cluster, zero-downtime database migrations, and edge caching layer.',
        owner_id: 1,
        creatorId: 1,
        ownerName: 'karri',
      },
    ];

    for (const p of projects) {
      await pool.query(
        `INSERT INTO "projects" ("id", "key", "name", "description", "owner_id", "creatorId", "ownerName")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, p.key, p.name, p.description, p.owner_id, p.creatorId, p.ownerName]
      );

      // Add members
      await pool.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 1, 'owner')`, [p.id]);
      await pool.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 2, 'member')`, [p.id]);
      await pool.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 3, 'admin')`, [p.id]);
      await pool.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 4, 'member')`, [p.id]);
      await pool.query(`INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, 5, 'viewer')`, [p.id]);
    }
    await pool.query(`SELECT setval('projects_id_seq', 10, true);`);

    // ─── Insert Issues for User Karri ──────────────────────────────────────────
    console.log('Seeding rich issues for user karri...');
    const issues = [
      // Project 1: Teader Platform Core
      {
        id: 'iss_101',
        key: 'TDR-101',
        title: 'PostgreSQL Connection Pooling & High-Availability Integration',
        description: 'Provision and configure PostgreSQL connection pooling with prepared statements and SSL.',
        status: 'done',
        priority: 'critical',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 1,
        project: 'Teader Platform Core',
        labels: '["Database", "PostgreSQL", "Backend"]',
        sprint: 'Sprint 24.3',
        epic: 'Platform Core',
        estimatedHours: 8,
        loggedHours: 8,
        isFavorite: true,
      },
      {
        id: 'iss_102',
        key: 'TDR-102',
        title: 'Hierarchical Subtask Trees with Multi-Level Parent-Child Nesting',
        description: 'Design and implement recursive nested subtask trees with multi-level folding, drag-and-drop, and real-time state calculation.',
        status: 'in_progress',
        priority: 'critical',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 1,
        project: 'Teader Platform Core',
        labels: '["Tree", "Subtasks", "UI Architecture"]',
        sprint: 'Sprint 24.3',
        epic: 'Platform Core',
        estimatedHours: 12,
        loggedHours: 6.5,
        isFavorite: true,
      },
      {
        id: 'iss_103',
        key: 'TDR-103',
        title: 'Interactive DAG Dependency Graph Visualization Tab',
        description: 'Render DAG graph with SVG bezier curves showing task blockers, critical path analysis, and downstream dependencies.',
        status: 'in_progress',
        priority: 'high',
        assigneeName: 'ajaysaagar',
        reporterName: 'karri',
        projectId: 1,
        project: 'Teader Platform Core',
        labels: '["Graph", "Frontend", "UI"]',
        sprint: 'Sprint 24.3',
        epic: 'Platform Core',
        estimatedHours: 6,
        loggedHours: 3.5,
        isFavorite: false,
      },
      {
        id: 'iss_104',
        key: 'TDR-104',
        title: 'Multi-Document Server Markdown Hub & Specs Editor',
        description: 'Save and switch between physical .md files stored directly on the server filesystem with live markdown rendering.',
        status: 'in_progress',
        priority: 'medium',
        assigneeName: 'jori',
        reporterName: 'karri',
        projectId: 1,
        project: 'Teader Platform Core',
        labels: '["Docs", "Markdown", "Wiki"]',
        sprint: 'Sprint 24.3',
        epic: 'Platform Core',
        estimatedHours: 5,
        loggedHours: 2.5,
        isFavorite: false,
      },
      {
        id: 'iss_105',
        key: 'TDR-105',
        title: 'Automated Workflow Engine with Trigger-Action Rules',
        description: 'Configurable project automations: auto-complete subtasks, auto-assign reviewers, and escalate priority on SLA breach.',
        status: 'todo',
        priority: 'medium',
        assigneeName: 'sarah',
        reporterName: 'karri',
        projectId: 1,
        project: 'Teader Platform Core',
        labels: '["Automations", "Rules", "Workflow"]',
        sprint: 'Sprint 24.4',
        epic: 'Platform Core',
        estimatedHours: 8,
        loggedHours: 0,
        isFavorite: false,
      },
      {
        id: 'iss_106',
        key: 'TDR-106',
        title: 'Dynamic UI Scale Zoom Engine with Viewport Normalization',
        description: 'Implement real-time CSS zoom scaling (0.75x to 1.5x) with persisted local storage and fluid responsive flex containers.',
        status: 'done',
        priority: 'high',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 1,
        project: 'Teader Platform Core',
        labels: '["Accessibility", "UI Scale", "Settings"]',
        sprint: 'Sprint 24.3',
        epic: 'Platform Core',
        estimatedHours: 4,
        loggedHours: 4,
        isFavorite: true,
      },
      {
        id: 'iss_107',
        key: 'TDR-107',
        title: 'Project Key Collaboration & Team Access Encryption',
        description: 'Generate 30-character unique project keys for instant team onboarding and production-safe one-click clipboard copying.',
        status: 'done',
        priority: 'high',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 1,
        project: 'Teader Platform Core',
        labels: '["Security", "Access Keys", "Collaboration"]',
        sprint: 'Sprint 24.3',
        epic: 'Platform Core',
        estimatedHours: 4,
        loggedHours: 4,
        isFavorite: false,
      },
      {
        id: 'iss_108',
        key: 'TDR-108',
        title: 'Audit Logging & Real-Time Activity Feed',
        description: 'Record granular task status transitions, collaborator comments, and deployment event timelines.',
        status: 'needs_review',
        priority: 'medium',
        assigneeName: 'alex',
        reporterName: 'karri',
        projectId: 1,
        project: 'Teader Platform Core',
        labels: '["Audit", "Activity", "Telemetry"]',
        sprint: 'Sprint 24.3',
        epic: 'Platform Core',
        estimatedHours: 5,
        loggedHours: 4.5,
        isFavorite: false,
      },

      // Project 2: Autonomous AI Agent Orchestrator
      {
        id: 'iss_201',
        key: 'AIX-201',
        title: 'Autonomous AI Coding Agent Tool Calling Sandbox',
        description: 'Build isolated subprocess runtime for executing shell commands, file viewing, regex searches, and git patch application.',
        status: 'in_progress',
        priority: 'critical',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 2,
        project: 'Autonomous AI Agent Orchestrator',
        labels: '["AI Agent", "Sandbox", "Tool Calling"]',
        sprint: 'Sprint AI.1',
        epic: 'Agent Runtime',
        estimatedHours: 16,
        loggedHours: 9,
        isFavorite: true,
      },
      {
        id: 'iss_202',
        key: 'AIX-202',
        title: 'LLM Context Window Management & Dynamic Prompt Condensation',
        description: 'Implement streaming token budget counter and hierarchical context truncation to prevent token overflow.',
        status: 'todo',
        priority: 'high',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 2,
        project: 'Autonomous AI Agent Orchestrator',
        labels: '["LLM", "Context", "Token Management"]',
        sprint: 'Sprint AI.1',
        epic: 'Agent Runtime',
        estimatedHours: 8,
        loggedHours: 1,
        isFavorite: false,
      },
      {
        id: 'iss_203',
        key: 'AIX-203',
        title: 'Multi-Agent Subagent Delegation Protocol & IPC Bridge',
        description: 'Coordinate parallel specialized subagents (researchers, coders, testers) with structured message queues.',
        status: 'done',
        priority: 'critical',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 2,
        project: 'Autonomous AI Agent Orchestrator',
        labels: '["Multi-Agent", "IPC", "Orchestration"]',
        sprint: 'Sprint AI.1',
        epic: 'Agent Runtime',
        estimatedHours: 10,
        loggedHours: 10,
        isFavorite: true,
      },

      // Project 3: Teader Desktop Native Client
      {
        id: 'iss_301',
        key: 'DESK-301',
        title: 'Electron 34 Desktop Shell with Custom Frameless Titlebar',
        description: 'Native frameless window with custom minimize, maximize, and close controls matching obsidian dark palette.',
        status: 'done',
        priority: 'high',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 3,
        project: 'Teader Desktop Native Client',
        labels: '["Electron", "Desktop", "Frameless UI"]',
        sprint: 'Sprint Desktop.1',
        epic: 'Desktop Client',
        estimatedHours: 6,
        loggedHours: 6,
        isFavorite: true,
      },
      {
        id: 'iss_302',
        key: 'DESK-302',
        title: 'Memory Footprint & Cold Boot Optimization for Electron Shell',
        description: 'Tuning V8 flags (--max-old-space-size=256), background throttling, and lazy rendering to achieve under 150MB baseline RAM.',
        status: 'done',
        priority: 'high',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 3,
        project: 'Teader Desktop Native Client',
        labels: '["Performance", "V8", "RAM Optimization"]',
        sprint: 'Sprint Desktop.1',
        epic: 'Desktop Client',
        estimatedHours: 5,
        loggedHours: 5,
        isFavorite: false,
      },
      {
        id: 'iss_303',
        key: 'DESK-303',
        title: 'Local Offline Cache Hydration & Background Sync Queue',
        description: 'Persist active tasks in IndexedDB with local change queuing and automatic cloud synchronization upon reconnection.',
        status: 'in_progress',
        priority: 'critical',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 3,
        project: 'Teader Desktop Native Client',
        labels: '["Offline", "IndexedDB", "Sync"]',
        sprint: 'Sprint Desktop.1',
        epic: 'Desktop Client',
        estimatedHours: 10,
        loggedHours: 5,
        isFavorite: true,
      },

      // Project 4: High-Throughput Edge API Gateway
      {
        id: 'iss_401',
        key: 'EDG-401',
        title: 'Distributed WebSocket Cluster & Low-Latency Broadcast',
        description: 'Real-time task synchronization across multiple users and browser tabs with under 15ms broadcast latency.',
        status: 'in_progress',
        priority: 'critical',
        assigneeName: 'karri',
        reporterName: 'karri',
        projectId: 4,
        project: 'High-Throughput Edge API Gateway',
        labels: '["WebSocket", "Real-Time", "Edge"]',
        sprint: 'Sprint Edge.1',
        epic: 'Edge Gateway',
        estimatedHours: 8,
        loggedHours: 4,
        isFavorite: true,
      },
    ];

    for (const iss of issues) {
      await pool.query(
        `INSERT INTO "issues" ("id", "key", "title", "description", "status", "priority", "assigneeName", "reporterName", "projectId", "project", "labels", "sprint", "epic", "estimatedHours", "loggedHours", "isFavorite")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [iss.id, iss.key, iss.title, iss.description, iss.status, iss.priority, iss.assigneeName, iss.reporterName, iss.projectId, iss.project, iss.labels, iss.sprint, iss.epic, iss.estimatedHours, iss.loggedHours, iss.isFavorite]
      );
    }

    // ─── Insert Hierarchical Nested Subtasks & Folders ───────────────────────────
    console.log('Seeding deeply nested hierarchical subtasks for user karri...');

    const subtasks = [
      // ── Tree for TDR-102 (Hierarchical Subtask Trees) ──
      // Level 1 Root Folder
      { id: 'tree_f1', issueId: 'iss_102', parentId: null, title: '📁 Architectural Design & Data Model', completed: true, isFolder: true, type: 'folder' },
      // Level 2 Sub-Folder
      { id: 'tree_f1_1', issueId: 'iss_102', parentId: 'tree_f1', title: '📂 Database Schema & Foreign Key Trees', completed: true, isFolder: true, type: 'folder' },
      // Level 3 Subtasks
      { id: 'tree_s1_1_1', issueId: 'iss_102', parentId: 'tree_f1_1', title: 'Design self-referencing parentId foreign key constraint', completed: true, isFolder: false, type: 'subtask' },
      { id: 'tree_s1_1_2', issueId: 'iss_102', parentId: 'tree_f1_1', title: 'Add unique constraints on hierarchical node keys', completed: true, isFolder: false, type: 'subtask' },
      // Level 3 Nested Sub-Folder
      { id: 'tree_f1_1_3', issueId: 'iss_102', parentId: 'tree_f1_1', title: '📂 Indexing & Performance Tuning', completed: false, isFolder: true, type: 'folder' },
      // Level 4 Deep Subtasks
      { id: 'tree_s1_1_3_1', issueId: 'iss_102', parentId: 'tree_f1_1_3', title: 'Create composite B-Tree indexes on (issueId, parentId)', completed: true, isFolder: false, type: 'subtask' },
      { id: 'tree_s1_1_3_2', issueId: 'iss_102', parentId: 'tree_f1_1_3', title: 'Optimize recursive CTE queries for deep tree traversals', completed: false, isFolder: false, type: 'subtask' },

      // Level 2 Sub-Folder: API & Contracts
      { id: 'tree_f1_2', issueId: 'iss_102', parentId: 'tree_f1', title: '📂 API & Serializer Contracts', completed: true, isFolder: true, type: 'folder' },
      { id: 'tree_s1_2_1', issueId: 'iss_102', parentId: 'tree_f1_2', title: 'Build recursive subtask tree serializer in /api/subtasks', completed: true, isFolder: false, type: 'subtask' },
      { id: 'tree_s1_2_2', issueId: 'iss_102', parentId: 'tree_f1_2', title: 'Implement optimistic state rollback on network failure', completed: false, isFolder: false, type: 'subtask' },

      // Level 1 Root Folder: Frontend
      { id: 'tree_f2', issueId: 'iss_102', parentId: null, title: '📁 Frontend Tree View Component', completed: false, isFolder: true, type: 'folder' },
      { id: 'tree_s2_1', issueId: 'iss_102', parentId: 'tree_f2', title: 'Build recursive TreeView render component with indentation guidelines', completed: true, isFolder: false, type: 'subtask' },
      { id: 'tree_s2_2', issueId: 'iss_102', parentId: 'tree_f2', title: 'Add drag-and-drop reordering between folders', completed: false, isFolder: false, type: 'subtask' },
      // Level 2 Sub-Folder: Keyboard Navigation
      { id: 'tree_f2_3', issueId: 'iss_102', parentId: 'tree_f2', title: '📂 Keyboard Navigation & Shortcuts', completed: false, isFolder: true, type: 'folder' },
      { id: 'tree_s2_3_1', issueId: 'iss_102', parentId: 'tree_f2_3', title: 'Support Left/Right arrow keys for expand/collapse', completed: true, isFolder: false, type: 'subtask' },
      { id: 'tree_s2_3_2', issueId: 'iss_102', parentId: 'tree_f2_3', title: 'Support Enter key to add sibling subtask at current depth', completed: true, isFolder: false, type: 'subtask' },
      { id: 'tree_s2_3_3', issueId: 'iss_102', parentId: 'tree_f2_3', title: 'Support Tab/Shift+Tab to indent/outdent subtask level', completed: false, isFolder: false, type: 'subtask' },

      // Level 1 Root Folder: QA & Testing
      { id: 'tree_f3', issueId: 'iss_102', parentId: null, title: '📁 Quality Assurance & Automated Tests', completed: false, isFolder: true, type: 'folder' },
      { id: 'tree_s3_1', issueId: 'iss_102', parentId: 'tree_f3', title: 'Unit tests for cycle detection in parentId references', completed: true, isFolder: false, type: 'subtask' },
      { id: 'tree_s3_2', issueId: 'iss_102', parentId: 'tree_f3', title: 'E2E tests for deeply nested 5-level task tree creation', completed: false, isFolder: false, type: 'subtask' },
      { id: 'tree_s3_3', issueId: 'iss_102', parentId: 'tree_f3', title: 'Stress test rendering with 500+ hierarchical nodes', completed: false, isFolder: false, type: 'subtask' },

      // ── Tree for AIX-201 (Autonomous AI Agent) ──
      { id: 'aix_f1', issueId: 'iss_201', parentId: null, title: '📁 Execution Sandbox & Isolation', completed: true, isFolder: true, type: 'folder' },
      { id: 'aix_f1_1', issueId: 'iss_201', parentId: 'aix_f1', title: '📂 Process Spawner & PTY Streams', completed: true, isFolder: true, type: 'folder' },
      { id: 'aix_s1_1_1', issueId: 'iss_201', parentId: 'aix_f1_1', title: 'Create unprivileged subprocess execution worker', completed: true, isFolder: false, type: 'subtask' },
      { id: 'aix_s1_1_2', issueId: 'iss_201', parentId: 'aix_f1_1', title: 'Stream stdout and stderr chunks in real-time over WebSocket', completed: true, isFolder: false, type: 'subtask' },
      { id: 'aix_f1_2', issueId: 'iss_201', parentId: 'aix_f1', title: '📂 Filesystem Access Policies', completed: false, isFolder: true, type: 'folder' },
      { id: 'aix_s1_2_1', issueId: 'iss_201', parentId: 'aix_f1_2', title: 'Enforce strict workspace directory jail boundaries', completed: true, isFolder: false, type: 'subtask' },
      { id: 'aix_s1_2_2', issueId: 'iss_201', parentId: 'aix_f1_2', title: 'Implement read-only mode for sensitive system paths', completed: false, isFolder: false, type: 'subtask' },
      { id: 'aix_f2', issueId: 'iss_201', parentId: null, title: '📁 Tool Calling Schema & Parsers', completed: true, isFolder: true, type: 'folder' },
      { id: 'aix_s2_1', issueId: 'iss_201', parentId: 'aix_f2', title: 'Define JSON Schema interfaces for tool declarations', completed: true, isFolder: false, type: 'subtask' },
      { id: 'aix_s2_2', issueId: 'iss_201', parentId: 'aix_f2', title: 'Implement structured tool call parser and argument validator', completed: true, isFolder: false, type: 'subtask' },

      // ── Tree for DESK-303 (Offline Sync) ──
      { id: 'dsk_f1', issueId: 'iss_303', parentId: null, title: '📁 Offline Storage Engine', completed: true, isFolder: true, type: 'folder' },
      { id: 'dsk_f1_1', issueId: 'iss_303', parentId: 'dsk_f1', title: '📂 IndexedDB & SQLite Adapter', completed: true, isFolder: true, type: 'folder' },
      { id: 'dsk_s1_1_1', issueId: 'iss_303', parentId: 'dsk_f1_1', title: 'Create offline schema migrations for IndexedDB tables', completed: true, isFolder: false, type: 'subtask' },
      { id: 'dsk_s1_1_2', issueId: 'iss_303', parentId: 'dsk_f1_1', title: 'Write LRU cache eviction policy for local assets', completed: true, isFolder: false, type: 'subtask' },
      { id: 'dsk_f1_2', issueId: 'iss_303', parentId: 'dsk_f1', title: '📂 Mutation Queue & Conflict Resolution', completed: false, isFolder: true, type: 'folder' },
      { id: 'dsk_s1_2_1', issueId: 'iss_303', parentId: 'dsk_f1_2', title: 'Record pending mutations with vector clocks', completed: true, isFolder: false, type: 'subtask' },
      { id: 'dsk_s1_2_2', issueId: 'iss_303', parentId: 'dsk_f1_2', title: 'Implement Last-Write-Wins and 3-way merge resolution', completed: false, isFolder: false, type: 'subtask' },

      // ── Tree for TDR-101 (Database Infrastructure) ──
      { id: 'db_f1', issueId: 'iss_101', parentId: null, title: '📁 Database Infrastructure & Schema', completed: true, isFolder: true, type: 'folder' },
      { id: 'db_s1', issueId: 'iss_101', parentId: 'db_f1', title: 'Configure pg.Pool connection settings with 10 max clients', completed: true, isFolder: false, type: 'subtask' },
      { id: 'db_s2', issueId: 'iss_101', parentId: 'db_f1', title: 'Verify primary keys & foreign key constraints on all 11 tables', completed: true, isFolder: false, type: 'subtask' },
      { id: 'db_s3', issueId: 'iss_101', parentId: 'db_f1', title: 'Implement automatic reconnection retry on idle timeout', completed: true, isFolder: false, type: 'subtask' },
    ];

    for (const st of subtasks) {
      await pool.query(
        `INSERT INTO "subtasks" ("id", "issueId", "parentId", "title", "completed", "isFolder", "type")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [st.id, st.issueId, st.parentId, st.title, st.completed, st.isFolder, st.type]
      );
    }

    // ─── Insert Comments ───────────────────────────────────────────────────────
    console.log('Seeding comments on tasks...');
    await pool.query(
      `INSERT INTO "comments" ("id", "body", "issueId", "authorId") VALUES ($1, $2, $3, $4)`,
      ['comm_1', 'PostgreSQL database pool initialization is rock-solid. Response times are under 8ms.', 'iss_101', 1]
    );
    await pool.query(
      `INSERT INTO "comments" ("id", "body", "issueId", "authorId") VALUES ($1, $2, $3, $4)`,
      ['comm_2', 'Recursive subtask nesting with indentation lines looks fantastic in the UI. Testing keyboard shortcuts next.', 'iss_102', 2]
    );
    await pool.query(
      `INSERT INTO "comments" ("id", "body", "issueId", "authorId") VALUES ($1, $2, $3, $4)`,
      ['comm_3', 'All tool executions are running inside isolated sandbox wrappers with telemetry hooks.', 'iss_201', 1]
    );

    // ─── Insert Project Docs ───────────────────────────────────────────────────
    console.log('Seeding project docs...');
    await pool.query(
      `INSERT INTO "project_docs" ("id", "projectId", "userId", "userName", "title", "fileName", "filePath")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['doc_1', 1, 1, 'karri', 'System Architecture & Data Flow', 'architecture.md', '/docs/architecture.md']
    );
    await pool.query(
      `INSERT INTO "project_docs" ("id", "projectId", "userId", "userName", "title", "fileName", "filePath")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['doc_2', 1, 1, 'karri', 'Hierarchical Subtask Tree Specifications', 'subtask_spec.md', '/docs/subtask_spec.md']
    );

    console.log('✓ PostgreSQL Database Schema & Hierarchical Seed Migration Completed Successfully for Karri!');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
