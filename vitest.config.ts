import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    env: {
      // Provide defaults for unit tests that don't need the real DB
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-unit-tests-minimum-32-bytes-long-xxxxxxxxxxx',
      MYSQL_USER: process.env.MYSQL_USER || 'test',
      MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || 'test',
      MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
