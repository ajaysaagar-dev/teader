import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const DB_HOST = process.env.POSTGRES_HOST || '178.238.226.206';
const DB_USER = process.env.POSTGRES_USER || 'ajaysaagar';
const DB_PASSWORD = process.env.POSTGRES_PASSWORD || 'aass209c';
const DB_NAME = process.env.POSTGRES_DATABASE || 'ajaysaagar';
const DB_PORT = Number(process.env.POSTGRES_PORT) || 5432;

async function seedTestProject() {
  const pool = new Pool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,
    connectionTimeoutMillis: 10000,
  });

  console.log(`Connecting to PostgreSQL at ${DB_HOST}:${DB_PORT}/${DB_NAME}...`);

  try {
    // Ensure columns exist in issues and project_docs tables
    await pool.query('ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "blockedBy" TEXT;').catch(() => {});
    await pool.query('ALTER TABLE "project_docs" ADD COLUMN IF NOT EXISTS "content" TEXT;').catch(() => {});

    // 1. Find or create user 'test'
    const userRes = await pool.query('SELECT * FROM "users" WHERE "name" = $1 OR "email" = $2', ['test', 'test@teader.io']);
    let userId: number;
    let userName = 'test';


    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
      userName = userRes.rows[0].name;
      console.log(`Found existing user 'test' (ID: ${userId})`);
    } else {
      const passwordHash = await bcrypt.hash('password123', 10);
      const insertedUser = await pool.query(
        'INSERT INTO "users" ("name", "email", "password", "avatar") VALUES ($1, $2, $3, $4) RETURNING "id"',
        [
          'test',
          'test@teader.io',
          passwordHash,
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        ]
      );
      userId = insertedUser.rows[0].id;
      console.log(`Created new user 'test' (ID: ${userId})`);
    }

    // 2. Find or create project 'TestProject'
    const projRes = await pool.query(
      'SELECT * FROM "projects" WHERE "name" = $1 OR "key" = $2',
      ['TestProject', 'TEST']
    );

    let projectId: number;
    if (projRes.rows.length > 0) {
      projectId = projRes.rows[0].id;
      console.log(`Found existing project 'TestProject' (ID: ${projectId})`);
    } else {
      const newProj = await pool.query(
        'INSERT INTO "projects" ("key", "name", "description", "owner_id", "creatorId", "ownerName") VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"',
        [
          'TEST',
          'TestProject',
          'Enterprise game engine test suite with 100+ tasks, modular subtasks, and branch explorer timeline graph.',
          userId,
          userId,
          'test',
        ]
      );
      projectId = newProj.rows[0].id;
      console.log(`Created project 'TestProject' (ID: ${projectId})`);
    }

    // 3. Ensure user 'test' and others are in project_members
    await pool.query(
      'INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [projectId, userId, 'owner']
    ).catch(() => {});

    const otherUsers = await pool.query('SELECT "id", "name" FROM "users" WHERE "id" != $1 LIMIT 5', [userId]);
    for (const u of otherUsers.rows) {
      await pool.query(
        'INSERT INTO "project_members" ("projectId", "userId", "role") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [projectId, u.id, 'member']
      ).catch(() => {});
    }

    // 4. Generate 110+ realistic tasks and 250+ subtasks across 11 technical domains
    const EPICS = [
      'Core Engine Architecture',
      'High-Performance Rendering',
      'Networking & Multiplayer',
      'Physics Simulation & Collisions',
      'Audio DSP Pipeline',
      'Asset Pipeline & Importer',
      'AI Navigation & Behaviour Trees',
      'VFX Graph & Particle Shaders',
      'UI Framework & Design System',
      'Security, Auth & Telemetry',
      'DevOps & CI/CD Pipeline',
    ];

    const STATUSES: ('todo' | 'in_progress' | 'needs_review' | 'done' | 'blocked')[] = [
      'todo',
      'in_progress',
      'needs_review',
      'done',
      'blocked',
    ];

    const PRIORITIES: ('critical' | 'high' | 'medium' | 'low')[] = [
      'critical',
      'high',
      'medium',
      'low',
    ];

    const ASSIGNEES = ['test', 'karri', 'jori', 'ajaysaagar'];

    const TASK_TEMPLATES = [
      {
        title: 'Implement SIMD-accelerated Matrix4x4 transformation matrix operations',
        epic: 'Core Engine Architecture',
        subtasks: [
          'Benchmark AVX2 vs Neon intrinsics',
          'Write unit tests for inverse transform and determinant calculation',
          'Integrate with scene graph node hierarchical caching',
        ],
      },
      {
        title: 'Design Vulkan 1.3 deferred render pass pipeline with dynamic render passes',
        epic: 'High-Performance Rendering',
        subtasks: [
          'Setup G-Buffer with normals, albedo, and roughness attachments',
          'Implement compute shader tile-based lighting dispatch',
          'Add support for HDR tone-mapping and ACES color grading',
        ],
      },
      {
        title: 'Develop low-latency UDP client-server state synchronization with delta compression',
        epic: 'Networking & Multiplayer',
        subtasks: [
          'Implement bit-packed snapshot serialization',
          'Write client-side prediction and server reconciliation buffer',
          'Add simulated packet loss and jitter telemetry tools',
        ],
      },
      {
        title: 'Implement continuous collision detection (CCD) for fast-moving projectiles',
        epic: 'Physics Simulation & Collisions',
        subtasks: [
          'Integrate swept sphere-box intersection tests',
          'Optimize broadphase BVH dynamic tree queries',
          'Profile physics step execution under 500 active rigidbodies',
        ],
      },
      {
        title: 'Build spatial 3D audio HRTF convolution reverb DSP node',
        epic: 'Audio DSP Pipeline',
        subtasks: [
          'Load Ambisonic B-format impulse response WAV files',
          'Implement frequency-domain FFT convolution with overlap-add',
          'Add audio occlusion raycasting against scene geometry',
        ],
      },
      {
        title: 'Create GLTF 2.0 and USDZ binary mesh asset importer with meshopt compression',
        epic: 'Asset Pipeline & Importer',
        subtasks: [
          'Decompress Draco geometry buffers in worker threads',
          'Generate tangent spaces using MikkTSpace standard',
          'Bake automatic LODs using quadric mesh decimation',
        ],
      },
      {
        title: 'Develop hierarchical pathfinding (HPA*) with dynamic obstacle avoidance (RVO2)',
        epic: 'AI Navigation & Behaviour Trees',
        subtasks: [
          'Build cluster-based navmesh abstraction grid',
          'Implement Reciprocal Velocity Obstacles (RVO) avoidance vector math',
          'Visualize agent debug paths in gizmo overlay',
        ],
      },
      {
        title: 'Compute shader GPU particle emitter with vector field turbulence simulation',
        epic: 'VFX Graph & Particle Shaders',
        subtasks: [
          'Write indirect draw arguments buffer generator',
          'Simulate curl noise and vortex velocity fields on 1,000,000 particles',
          'Implement depth-buffer soft particle blend shader',
        ],
      },
      {
        title: 'Design dark-mode responsive glassmorphic UI component library in React/Tailwind',
        epic: 'UI Framework & Design System',
        subtasks: [
          'Construct accessible tree view navigation with keyboard shortcuts',
          'Add fluid SVG spline connection canvas renderer',
          'Implement real-time markdown docs preview with syntax highlight',
        ],
      },
      {
        title: 'Implement OAuth2 token rotation with salted bcrypt credential hashing',
        epic: 'Security, Auth & Telemetry',
        subtasks: [
          'Configure JWT HttpOnly secure cookie middleware',
          'Implement IP-based rate limiting with sliding window Redis/Postgres',
          'Write automated penetration test suites for SQL injection prevention',
        ],
      },
      {
        title: 'Configure automated Turbopack Next.js Docker container deployment pipeline',
        epic: 'DevOps & CI/CD Pipeline',
        subtasks: [
          'Write multi-stage Dockerfile with standalone output optimization',
          'Setup GitHub Actions workflow with Vitest and typechecking',
          'Configure health check probes and PostgreSQL connection pool monitoring',
        ],
      },
    ];

    console.log('Seeding 110+ tasks and 250+ subtasks into TestProject...');

    let taskIndex = 1;
    let totalSubtasksCount = 0;

    // Generate 110 tasks (10 rounds of template variations)
    for (let round = 1; round <= 10; round++) {
      for (const tpl of TASK_TEMPLATES) {
        const taskNum = taskIndex++;
        const key = `TEST-${taskNum}`;
        const id = `iss_test_${taskNum}`;
        const title = round === 1 ? tpl.title : `${tpl.title} (Phase ${round})`;
        const epic = tpl.epic;
        const status = STATUSES[(taskNum * 7) % STATUSES.length];
        const priority = PRIORITIES[(taskNum * 3) % PRIORITIES.length];
        const assignee = ASSIGNEES[(taskNum * 5) % ASSIGNEES.length];
        const estimatedHours = 2 + (taskNum % 14);

        const description = `## Task Overview\n\n${title}.\n\n### Requirements & Scope\n- Deliverable for **${epic}**.\n- High-velocity engineering standard.\n- Full test coverage and performance verification required.\n\n### Technical Architecture\n\`\`\`ts\nexport interface TaskConfig {\n  phase: ${round},\n  domain: "${epic}",\n  priority: "${priority}",\n  lead: "${assignee}"\n}\n\`\`\`\n`;

        // Check if task already exists
        const existingTask = await pool.query(
          'SELECT "id" FROM "issues" WHERE "projectId" = $1 AND "key" = $2',
          [projectId, key]
        );

        let issueDbId: string = id;

        if (existingTask.rows.length > 0) {
          issueDbId = existingTask.rows[0].id;
          await pool.query(
            'UPDATE "issues" SET "title" = $1, "description" = $2, "status" = $3, "priority" = $4, "assigneeName" = $5, "epic" = $6, "estimatedHours" = $7 WHERE "id" = $8',
            [title, description, status, priority, assignee, epic, estimatedHours, issueDbId]
          );
        } else {
          await pool.query(
            `INSERT INTO "issues" (
              "id", "key", "title", "description", "status", "priority", 
              "assigneeName", "reporterName", "projectId", "project", 
              "epic", "estimatedHours", "labels", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
            [
              id,
              key,
              title,
              description,
              status,
              priority,
              assignee,
              userName,
              projectId,
              'TestProject',
              epic,
              estimatedHours,
              JSON.stringify(['Engine', epic.split(' ')[0]]),
            ]
          );
        }

        // Insert subtasks
        for (let sIdx = 0; sIdx < tpl.subtasks.length; sIdx++) {
          const subTitle = tpl.subtasks[sIdx];
          const subId = `sub_test_${taskNum}_${sIdx + 1}`;
          const completed = status === 'done' || (sIdx === 0 && status === 'in_progress');
          const isFolder = sIdx === 0 && taskNum % 4 === 0;

          await pool.query(
            `INSERT INTO "subtasks" ("id", "issueId", "title", "completed", "isFolder", "type", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT ("id") DO UPDATE SET "title" = $3, "completed" = $4`,
            [
              subId,
              issueDbId,
              subTitle,
              completed,
              isFolder,
              isFolder ? 'folder' : 'subtask',
            ]
          ).catch(() => {});
          totalSubtasksCount++;
        }
      }
    }

    // Add dependency blocking links between tasks (for Timeline & Branch Explorer graph)
    console.log('Adding dependency blocking relationships for Graph Timeline...');
    const allTaskKeys = await pool.query(
      'SELECT "id", "key" FROM "issues" WHERE "projectId" = $1 ORDER BY "key" ASC',
      [projectId]
    );

    const rows = allTaskKeys.rows;
    for (let i = 2; i < rows.length; i += 3) {
      const current = rows[i];
      const prev1 = rows[i - 1]?.key;
      const prev2 = rows[i - 2]?.key;
      const blockedBy = [prev1, prev2].filter(Boolean);

      await pool.query(
        'UPDATE "issues" SET "blockedBy" = $1 WHERE "id" = $2',
        [JSON.stringify(blockedBy), current.id]
      );
    }

    // 5. Seed sample project documentation .md files for TestProject
    console.log('Seeding project docs for TestProject...');
    const docRes = await pool.query(
      'SELECT "id" FROM "project_docs" WHERE "projectId" = $1 LIMIT 1',
      [projectId]
    ).catch(() => ({ rows: [] }));

    if (docRes.rows.length === 0) {
      const doc1Content = '# TestProject Architecture\n\nWelcome to **TestProject** technical specification.\n\n## 1. Core Subsystems\n- **Render Pipeline**: Vulkan 1.3 with clustered forward+ lighting.\n- **Physics**: Real-time rigid body dynamics.\n- **Networking**: High-frequency snapshot delta sync.\n\n## 2. Milestone Roadmap\n- [x] Phase 1: Core scaffolding\n- [ ] Phase 2: Render pass optimizations\n- [ ] Phase 3: Stress tests with 100+ entities\n';
      const doc2Content = '# Engineering Guidelines\n\nBest practices and code conventions for TestProject.\n\n### 1. Performance Guidelines\n- Avoid heap allocations in hot render/physics loops.\n- Use contiguous arrays (ArrayBuffer / Float32Array) for particle caches.\n\n```ts\n// Zero-allocation transform loop\nfor (let i = 0; i < count; i++) {\n  transforms[i * 4 + 0] += velocities[i * 4 + 0] * dt;\n}\n```\n';

      await pool.query(
        `INSERT INTO "project_docs" ("projectId", "userId", "userName", "title", "fileName", "filePath", "content", "createdAt", "updatedAt")
         VALUES 
         ($1, $2, $3, 'Engine Architecture Overview', 'proj_test_engine_overview.md', 'data/docs/proj_test_engine_overview.md', $4, NOW(), NOW()),
         ($1, $2, $3, 'Coding Standards & Guidelines', 'proj_test_coding_guidelines.md', 'data/docs/proj_test_coding_guidelines.md', $5, NOW(), NOW())`,
        [projectId, userId, userName, doc1Content, doc2Content]
      ).catch(() => {});
    }

    console.log(`\n🎉 Successfully seeded TestProject in PostgreSQL!`);
    console.log(`- User: ${userName} (ID: ${userId})`);
    console.log(`- Project: TestProject (Key: TEST, ID: ${projectId})`);
    console.log(`- Tasks: ${taskIndex - 1} tasks created`);
    console.log(`- Subtasks: ${totalSubtasksCount} subtasks created`);
    console.log(`- Dependencies & Docs generated successfully!\n`);
  } catch (err: any) {
    console.error('Error during seeding:', err.message);
  } finally {
    await pool.end();
  }
}

seedTestProject();
