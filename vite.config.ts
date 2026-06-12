import { defineConfig } from 'vite';
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
});
