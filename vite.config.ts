/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // With VITE_DATA_SOURCE=api in development, forward /api to the PHP server (`npm run api`).
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000' },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
