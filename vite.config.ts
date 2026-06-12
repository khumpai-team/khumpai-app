import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Forward API calls to the Express backend (data + Azure OpenAI proxy).
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
  // Root vitest runs only the front-end suite; the server suite runs in server/.
  test: { include: ['tests/**/*.{test,spec}.{ts,tsx}'] },
});
