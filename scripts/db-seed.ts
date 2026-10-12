import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// ─── 1. Load Environment Variables from .env ───────────────────────────────────
function loadEnv() {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch {}
  }
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();
process.env.JWT_SECRET = process.env.JWT_SECRET || '302b4b1b1e9e7f19263522aadef2f9c98234636ab47d21bfe5a0f1b4a45e61b3a73920f27fc1aa4e6ac8587fddfd2d988901c4301e08a5ad612297a049426ec1';

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

async function runSeed() {
  const { initDB, getPool } = await import('../lib/db');
  const isReset = process.argv.includes('--reset') || process.env.npm_lifecycle_event === 'db:reset';
  console.log(`\n🚀 [Teader Database Seed] Starting database ${isReset ? 'reset & migration' : 'setup & seed'}...`);

  const p = getPool();

  if (isReset) {
    console.log('🧹 Dropping existing tables for a clean migration...');
    const tablesToDrop = [
      'project_repositories',
      'project_history',
      'project_channels',
      'project_messages',
      'project_charts',
      'project_doc_folders',
      'project_docs',
      'activities',
      'comments',
      'images',
      'subtasks',
      'issue_labels',
      'labels',
      'issues',
      'project_member_permissions',
      'project_join_requests',
      'project_members',
      'sprints',
      'projects',
      'users',
    ];
    for (const table of tablesToDrop) {
      await p.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
    }
    console.log('✓ Tables dropped.');
  }

  // 1. Initialize Tables Schema via initDB()
  console.log('📦 Verifying & initializing database schema...');
  await initDB();
  console.log('✓ All database tables, schemas & columns initialized.');

  // 2. Default Users
  console.log('👤 Seeding default users...');
  const defaultPasswordHash = hashPassword('password123');
  const users = [
    { id: 1, name: 'karri', email: 'karri@teader.io', avatar: '/profiles/profile-1.webp' },
    { id: 2, name: 'jori', email: 'jori@teader.io', avatar: '/profiles/profile-2.webp' },
    { id: 3, name: 'ajaysaagar', email: 'ajaysaagar@teader.io', avatar: '/profiles/profile-3.webp' },
    { id: 4, name: 'sarah', email: 'sarah@teader.io', avatar: '/profiles/profile-4.webp' },
    { id: 5, name: 'alex', email: 'alex@teader.io', avatar: '/profiles/profile-5.webp' },
    { id: 13, name: 'ajaysaagar', email: 'ajaysaagar.dev@gmail.com', avatar: '/profiles/profile-13.webp' },
    { id: 14, name: 'Elena Rostova', email: 'elena@teader.io', avatar: '/profiles/profile-14.webp' },
    { id: 15, name: 'Marcus Vance', email: 'marcus@teader.io', avatar: '/profiles/profile-15.webp' },
  ];

  for (const u of users) {
    await p.query(
      `INSERT INTO "users" ("id", "name", "email", "password", "avatar")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("id") DO UPDATE SET "name" = $2, "avatar" = $5, "password" = $4`,
      [u.id, u.name, u.email, defaultPasswordHash, u.avatar]
    );
  }
  await p.query(`SELECT setval('users_id_seq', 20, true);`).catch(() => {});

  // 3. Demo Projects
  console.log('📁 Seeding demo projects...');
  const demoProjects = [
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
      description: 'Electron desktop shell with custom titlebars, ultra-low RAM footprint, and local offline sync.',
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

  for (const proj of demoProjects) {
    await p.query(
      `INSERT INTO "projects" ("id", "key", "name", "description", "owner_id", "creatorId", "ownerName")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("id") DO UPDATE SET "name" = $3, "description" = $4`,
      [proj.id, proj.key, proj.name, proj.description, proj.owner_id, proj.creatorId, proj.ownerName]
    );

    // Seed project members
    const memberRoles = [
      { userId: 1, role: 'owner' },
      { userId: 2, role: 'member' },
      { userId: 3, role: 'admin' },
      { userId: 4, role: 'member' },
      { userId: 5, role: 'viewer' },
      { userId: 13, role: 'admin' },
    ];
    for (const mr of memberRoles) {
      await p.query(
        `INSERT INTO "project_members" ("projectId", "userId", "role")
         VALUES ($1, $2, $3)
         ON CONFLICT ("projectId", "userId") DO UPDATE SET "role" = $3`,
        [proj.id, mr.userId, mr.role]
      );
    }

    // Seed default channels
    const channels = ['general', 'engineering', 'design', 'announcements'];
    for (const ch of channels) {
      await p.query(
        `INSERT INTO "project_channels" ("projectId", "name", "description", "creatorId")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("projectId", "name") DO NOTHING`,
        [proj.id, ch, `${ch.charAt(0).toUpperCase() + ch.slice(1)} discussion channel`, 1]
      );
    }
  }
  await p.query(`SELECT setval('projects_id_seq', 20, true);`).catch(() => {});

  // 4. Rich Issues
  console.log('📌 Seeding rich demo issues...');
  const demoIssues = [
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
    // Project 2: AI Agent Orchestrator
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
    // Project 3: Desktop Native Client
    {
      id: 'iss_301',
      key: 'DESK-301',
      title: 'Electron Desktop Shell with Custom Frameless Titlebar',
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
    // Project 4: Edge API Gateway
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

  for (const iss of demoIssues) {
    await p.query(
      `INSERT INTO "issues" (
        "id", "key", "title", "description", "status", "priority",
        "assigneeName", "reporterName", "projectId", "project",
        "labels", "sprint", "epic", "estimatedHours", "loggedHours", "isFavorite"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT ("id") DO UPDATE SET
        "title" = $3, "description" = $4, "status" = $5, "priority" = $6, "updatedAt" = CURRENT_TIMESTAMP`,
      [
        iss.id, iss.key, iss.title, iss.description, iss.status, iss.priority,
        iss.assigneeName, iss.reporterName, iss.projectId, iss.project,
        iss.labels, iss.sprint, iss.epic, iss.estimatedHours, iss.loggedHours, iss.isFavorite
      ]
    );
  }

  // 5. Hierarchical Subtasks & Folders
  console.log('🌲 Seeding hierarchical nested subtasks & folders...');
  const subtasks = [
    // ── Tree for TDR-102 (Hierarchical Subtask Trees) ──
    { id: 'tree_f1', issueId: 'iss_102', parentId: null, title: '📁 Architectural Design & Data Model', completed: true, isFolder: true, type: 'folder' },
    { id: 'tree_f1_1', issueId: 'iss_102', parentId: 'tree_f1', title: '📂 Database Schema & Foreign Key Trees', completed: true, isFolder: true, type: 'folder' },
    { id: 'tree_s1_1_1', issueId: 'iss_102', parentId: 'tree_f1_1', title: 'Design self-referencing parentId foreign key constraint', completed: true, isFolder: false, type: 'subtask' },
    { id: 'tree_s1_1_2', issueId: 'iss_102', parentId: 'tree_f1_1', title: 'Add unique constraints on hierarchical node keys', completed: true, isFolder: false, type: 'subtask' },
    { id: 'tree_f1_1_3', issueId: 'iss_102', parentId: 'tree_f1_1', title: '📂 Indexing & Performance Tuning', completed: false, isFolder: true, type: 'folder' },
    { id: 'tree_s1_1_3_1', issueId: 'iss_102', parentId: 'tree_f1_1_3', title: 'Create composite B-Tree indexes on (issueId, parentId)', completed: true, isFolder: false, type: 'subtask' },
    { id: 'tree_s1_1_3_2', issueId: 'iss_102', parentId: 'tree_f1_1_3', title: 'Optimize recursive CTE queries for deep tree traversals', completed: false, isFolder: false, type: 'subtask' },
    { id: 'tree_f1_2', issueId: 'iss_102', parentId: 'tree_f1', title: '📂 API & Serializer Contracts', completed: true, isFolder: true, type: 'folder' },
    { id: 'tree_s1_2_1', issueId: 'iss_102', parentId: 'tree_f1_2', title: 'Build recursive subtask tree serializer in /api/subtasks', completed: true, isFolder: false, type: 'subtask' },
    { id: 'tree_s1_2_2', issueId: 'iss_102', parentId: 'tree_f1_2', title: 'Implement optimistic state rollback on network failure', completed: false, isFolder: false, type: 'subtask' },
    { id: 'tree_f2', issueId: 'iss_102', parentId: null, title: '📁 Frontend Tree View Component', completed: false, isFolder: true, type: 'folder' },
    { id: 'tree_s2_1', issueId: 'iss_102', parentId: 'tree_f2', title: 'Build recursive TreeView render component with indentation guidelines', completed: true, isFolder: false, type: 'subtask' },
    { id: 'tree_s2_2', issueId: 'iss_102', parentId: 'tree_f2', title: 'Add drag-and-drop reordering between folders', completed: false, isFolder: false, type: 'subtask' },
    { id: 'tree_f2_3', issueId: 'iss_102', parentId: 'tree_f2', title: '📂 Keyboard Navigation & Shortcuts', completed: false, isFolder: true, type: 'folder' },
    { id: 'tree_s2_3_1', issueId: 'iss_102', parentId: 'tree_f2_3', title: 'Support Left/Right arrow keys for expand/collapse', completed: true, isFolder: false, type: 'subtask' },
    { id: 'tree_s2_3_2', issueId: 'iss_102', parentId: 'tree_f2_3', title: 'Support Enter key to add sibling subtask at current depth', completed: true, isFolder: false, type: 'subtask' },
    { id: 'tree_s2_3_3', issueId: 'iss_102', parentId: 'tree_f2_3', title: 'Support Tab/Shift+Tab to indent/outdent subtask level', completed: false, isFolder: false, type: 'subtask' },
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
    { id: 'db_s2', issueId: 'iss_101', parentId: 'db_f1', title: 'Verify primary keys & foreign key constraints on all tables', completed: true, isFolder: false, type: 'subtask' },
    { id: 'db_s3', issueId: 'iss_101', parentId: 'db_f1', title: 'Implement automatic reconnection retry on idle timeout', completed: true, isFolder: false, type: 'subtask' },
  ];

  for (const st of subtasks) {
    await p.query(
      `INSERT INTO "subtasks" ("id", "issueId", "parentId", "title", "completed", "isFolder", "type")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("id") DO UPDATE SET
         "title" = $4, "completed" = $5, "isFolder" = $6, "type" = $7`,
      [st.id, st.issueId, st.parentId, st.title, st.completed, st.isFolder, st.type]
    );
  }

  // 6. Comments
  console.log('💬 Seeding comments...');
  const comments = [
    { id: 'comm_1', body: 'PostgreSQL database pool initialization is rock-solid. Response times are under 8ms.', issueId: 'iss_101', authorId: 1 },
    { id: 'comm_2', body: 'Recursive subtask nesting with indentation lines looks fantastic in the UI. Testing keyboard shortcuts next.', issueId: 'iss_102', authorId: 2 },
    { id: 'comm_3', body: 'All tool executions are running inside isolated sandbox wrappers with telemetry hooks.', issueId: 'iss_201', authorId: 1 },
  ];
  for (const c of comments) {
    await p.query(
      `INSERT INTO "comments" ("id", "body", "issueId", "authorId")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("id") DO UPDATE SET "body" = $2`,
      [c.id, c.body, c.issueId, c.authorId]
    );
  }

  // 7. Project Docs & Folders
  console.log('📄 Seeding project docs & doc folders...');
  await p.query(
    `INSERT INTO "project_doc_folders" ("projectId", "name", "orderIndex")
     VALUES ($1, $2, $3)
     ON CONFLICT ("projectId", "name") DO NOTHING`,
    [1, 'Start', 0]
  );

  const docs = [
    {
      id: 'doc_1',
      projectId: 1,
      userId: 1,
      userName: 'karri',
      title: 'System Architecture & Data Flow',
      fileName: 'architecture.md',
      filePath: '/docs/architecture.md',
      folder: 'Start',
      content: '# System Architecture\n\nTeader is a next-generation workspace platform built on Next.js, PostgreSQL, and WebSocket realtime messaging.',
    },
    {
      id: 'doc_2',
      projectId: 1,
      userId: 1,
      userName: 'karri',
      title: 'Hierarchical Subtask Tree Specifications',
      fileName: 'subtask_spec.md',
      filePath: '/docs/subtask_spec.md',
      folder: 'Start',
      content: '# Subtask Tree Specifications\n\nMulti-level nested subtask tree with folders, keyboard navigation, and instant DAG synchronization.',
    },
  ];

  for (const d of docs) {
    await p.query(
      `INSERT INTO "project_docs" ("id", "projectId", "userId", "userName", "title", "fileName", "filePath", "folder", "content")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("fileName") DO UPDATE SET
         "title" = $5, "filePath" = $7, "folder" = $8, "content" = $9, "updatedAt" = CURRENT_TIMESTAMP`,
      [d.id, d.projectId, d.userId, d.userName, d.title, d.fileName, d.filePath, d.folder, d.content]
    );
  }

  console.log('\n✨ [Teader Database Seed] Completed successfully!');
  console.log('   - Tables initialized & validated');
  console.log('   - Default users seeded (karri, jori, ajaysaagar, sarah, alex, etc.)');
  console.log('   - Demo projects seeded (Platform Core, AI Orchestrator, Desktop Client, Edge Gateway, Huge)');
  console.log('   - Issues, subtask trees, channels, comments, and documentation ready.\n');
}

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ [Teader Database Seed] Error:', err);
    process.exit(1);
  });
