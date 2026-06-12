import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { foundryProxyPlugin } from './src/agent/server/foundryProxyPlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), foundryProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
