import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

// Without Azure creds in server/.env the proxy must fail cleanly over SSE
// (never crash). The live streaming path is exercised manually with real creds.
describe('POST /api/agent/chat', () => {
  it('returns a clean SSE error when Azure is not configured', async () => {
    const res = await request(createApp())
      .post('/api/agent/chat')
      .send({ messages: [{ role: 'user', content: 'Hola' }] })
      .expect(200);
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('"type":"done"');
  });
});
