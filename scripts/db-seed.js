const mysql = require('mysql2/promise');

const DB_HOST = process.env.MYSQL_HOST || 'localhost';
const DB_USER = process.env.MYSQL_USER || 'ajaysaagar';
const DB_PASSWORD = process.env.MYSQL_PASSWORD || 'aass209c';
const DB_NAME = process.env.MYSQL_DATABASE || 'teader_db';
const DB_PORT = Number(process.env.MYSQL_PORT) || 3306;

async function seed() {
  console.log('--- Teader Database Migration & Reset ---');

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

    // Drop old tables to migrate schema cleanly
    console.log('Dropping existing tables for clean schema migration...');
    await p.query(`DROP TABLE IF EXISTS \`subtasks\`;`);
    await p.query(`DROP TABLE IF EXISTS \`issues\`;`);
    await p.query(`DROP TABLE IF EXISTS \`projects\`;`);

    // Create Projects Table with INT AUTO_INCREMENT PRIMARY KEY
    console.log('Creating `projects` table (INT AUTO_INCREMENT PRIMARY KEY)...');
    await p.query(`
      CREATE TABLE \`projects\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(32) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` TEXT,
        \`ownerName\` VARCHAR(128) DEFAULT 'karri',
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create Issues Table with projectId INT Foreign Key
    console.log('Creating `issues` table (projectId INT FOREIGN KEY)...');
    await p.query(`
      CREATE TABLE \`issues\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`key\` VARCHAR(32) NOT NULL UNIQUE,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'todo',
        \`priority\` VARCHAR(32) NOT NULL DEFAULT 'medium',
        \`assigneeName\` VARCHAR(128) DEFAULT 'jori',
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
        FOREIGN KEY (\`projectId\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create Subtasks Table
    console.log('Creating `subtasks` table...');
    await p.query(`
      CREATE TABLE \`subtasks\` (
        \`id\` VARCHAR(64) PRIMARY KEY,
        \`issueId\` VARCHAR(64) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`completed\` TINYINT(1) DEFAULT 0,
        \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (\`issueId\`) REFERENCES \`issues\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Insert Projects
    console.log('Seeding initial projects...');
    const projects = [
      { id: 1, key: 'TDR', name: 'Teader Platform Core', description: 'Core backend microservices and streaming architecture.', ownerName: 'karri' },
      { id: 2, key: 'MOB', name: 'Teader Mobile App', description: 'iOS and Android client performance & launch optimizations.', ownerName: 'karri' },
      { id: 3, key: 'UI', name: 'Teader UI Refresh', description: 'Design system and dark theme layout components.', ownerName: 'karri' },
    ];

    for (const proj of projects) {
      await p.query(
        `INSERT INTO \`projects\` (\`id\`, \`key\`, \`name\`, \`description\`, \`ownerName\`) VALUES (?, ?, ?, ?, ?)`,
        [proj.id, proj.key, proj.name, proj.description, proj.ownerName]
      );
    }

    // Insert Issues
    console.log('Seeding initial tasks & subtasks...');
    const issues = [
      {
        id: 'issue_2703',
        key: 'TDR-2703',
        title: 'Faster app launch',
        description: 'Render UI before vehicle_state sync when minimum required state is present.',
        status: 'in_progress',
        priority: 'high',
        assigneeName: 'jori',
        assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        reporterName: 'karri',
        reporterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        labels: JSON.stringify(['Performance', 'iOS']),
        sprint: 'Sprint 24.3',
        epic: 'Mobile Performance',
        projectId: 1,
        project: 'Teader Platform Core',
        isFavorite: true,
        subtasks: [
          { id: 'sub_1', title: 'Build waitingStatusById map', completed: true },
          { id: 'sub_2', title: 'Reset dimmed rows on history reload', completed: true },
        ],
      },
      {
        id: 'issue_2704',
        key: 'TDR-2704',
        title: 'Core tasks execution pipeline',
        description: 'Optimize streaming WebSocket subscriptions for background workers.',
        status: 'todo',
        priority: 'medium',
        assigneeName: 'karri',
        assigneeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        reporterName: 'jori',
        reporterAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        labels: JSON.stringify(['Core', 'Backend']),
        sprint: 'Sprint 24.3',
        epic: 'System Insights',
        projectId: 1,
        project: 'Teader Platform Core',
        isFavorite: true,
        subtasks: [
          { id: 'sub_3', title: 'Setup WebSocket heartbeats', completed: false },
        ],
      },
      {
        id: 'issue_2705',
        key: 'UI-804',
        title: 'UI Refresh dark theme polish',
        description: 'Refine borders, typography, and card padding for Teader client.',
        status: 'needs_review',
        priority: 'high',
        assigneeName: 'jori',
        assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        reporterName: 'karri',
        reporterAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        labels: JSON.stringify(['UI', 'Design System']),
        sprint: 'Sprint 24.3',
        epic: 'UI Refresh',
        projectId: 3,
        project: 'Teader UI Refresh',
        isFavorite: true,
        subtasks: [],
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

      for (const sub of issue.subtasks) {
        await p.query(
          `INSERT INTO \`subtasks\` (\`id\`, \`issueId\`, \`title\`, \`completed\`) VALUES (?, ?, ?, ?)`,
          [sub.id, issue.id, sub.title, sub.completed ? 1 : 0]
        );
      }
    }

    console.log('🎉 MySQL Database seeding & migration completed successfully!');
    await p.end();
  } catch (err) {
    console.error('Error during database seed:', err.message);
    process.exit(1);
  }
}

seed();
