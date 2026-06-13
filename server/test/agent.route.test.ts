import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { env } from '../src/env.js';

// Hermetic: force the unconfigured state regardless of what's in server/.env,
// so the test never makes a real Azure call. The live streaming path is
// exercised manually with real creds.
describe('POST /api/agent/chat', () => {
  it('returns a clean SSE error when Azure is not configured', async () => {
    const saved = { ep: env.AZURE_OPENAI_ENDPOINT, key: env.AZURE_OPENAI_API_KEY };
    env.AZURE_OPENAI_ENDPOINT = '';
    env.AZURE_OPENAI_API_KEY = '';
    try {
      const res = await request(createApp())
        .post('/api/agent/chat')
        .send({ messages: [{ role: 'user', content: 'Hola' }] })
        .expect(200);
      expect(res.text).toContain('"type":"error"');
      expect(res.text).toContain('"type":"done"');
    } finally {
      env.AZURE_OPENAI_ENDPOINT = saved.ep;
      env.AZURE_OPENAI_API_KEY = saved.key;
    }
  });
});
