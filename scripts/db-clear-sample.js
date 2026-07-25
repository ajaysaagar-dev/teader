const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'ajaysaagar',
    password: process.env.MYSQL_PASSWORD || 'aass209c',
    database: process.env.MYSQL_DATABASE || 'teader_db',
    port: Number(process.env.MYSQL_PORT) || 3306,
  });

  console.log('Connected to MySQL DB. Removing sample projects...');
  await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
  await connection.query('TRUNCATE TABLE `subtasks`;');
  await connection.query('TRUNCATE TABLE `issues`;');
  await connection.query('TRUNCATE TABLE `project_members`;');
  await connection.query('TRUNCATE TABLE `projects`;');
  await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('Sample projects and tasks successfully removed!');
  await connection.end();
}

main().catch((err) => {
  console.error('Error clearing database:', err);
  process.exit(1);
});
