import { initTelemetry } from './telemetry.js';
initTelemetry();

import express from 'express';
import path from 'node:path';
import { env } from './env.js';
import { stateRoute } from './http/state.route.js';
import { logsRoute } from './http/logs.route.js';
import { entitiesRoute } from './http/entities.route.js';
import { agentRoute } from './http/agent.route.js';
import { ragRoute } from './http/rag.route.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN);
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use(stateRoute);
  app.use(logsRoute);
  app.use(entitiesRoute);
  app.use(agentRoute);
  app.use(ragRoute);

  // Production single-origin: serve the built SPA from dist/ (set SPA_DIST in
  // prod; in dev the Vite server serves the SPA + proxies /api, so this is off).
  const distDir = process.env.SPA_DIST;
  if (distDir) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) { next(); return; }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  createApp().listen(env.PORT, () => console.log(`API on :${env.PORT}`));
}
