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
      POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
      POSTGRES_USER: process.env.POSTGRES_USER || 'test',
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'test',
      POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
