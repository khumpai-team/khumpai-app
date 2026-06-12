import express from 'express';
import { env } from './env.js';
import { stateRoute } from './http/state.route.js';
import { logsRoute } from './http/logs.route.js';

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
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  createApp().listen(env.PORT, () => console.log(`API on :${env.PORT}`));
}
