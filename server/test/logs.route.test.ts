import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { like } from 'drizzle-orm';
import { createApp } from '../src/index.js';
import { db, schema } from '../src/db/client.js';
import { prepareTestDb } from './helpers/testDb.js';

// Re-runnable: ensure schema+seed, then clear any leftover test rows (id 't-%').
beforeAll(async () => {
  prepareTestDb();
  await db.delete(schema.logs).where(like(schema.logs.id, 't-%'));
  await db.delete(schema.doctorNotes).where(like(schema.doctorNotes.id, 't-%'));
});

const app = () => createApp();
const draft = (id: string) => ({
  id,
  personId: 'carlos',
  type: 'glucose' as const,
  timestamp: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  source: 'conversation' as const,
  confirmed: false,
  isOfflineCapture: false,
  payload: { value: 142, moment: 'ayunas' },
});

describe('logs API', () => {
  it('creates a log', async () => {
    await request(app()).post('/api/logs').send(draft('t-log-1')).expect(201);
    const res = await request(app()).get('/api/state').expect(200);
    expect(res.body.logs.find((l: { id: string }) => l.id === 't-log-1')).toBeTruthy();
  });

  it('confirm is idempotent', async () => {
    await request(app()).post('/api/logs').send(draft('t-log-2')).expect(201);
    await request(app()).post('/api/logs/t-log-2/confirm').expect(200);
    const again = await request(app()).post('/api/logs/t-log-2/confirm').expect(200);
    expect(again.body.confirmed).toBe(true);
  });

  it('batch flush inserts chronologically and is idempotent by id', async () => {
    const a = { ...draft('t-batch-a'), timestamp: '2026-06-10T08:00:00.000Z' };
    const b = { ...draft('t-batch-b'), timestamp: '2026-06-10T07:00:00.000Z' };
    const res = await request(app()).post('/api/logs/batch').send({ entries: [a, b] }).expect(200);
    expect(res.body.inserted).toBe(2);
    const res2 = await request(app()).post('/api/logs/batch').send({ entries: [a, b] }).expect(200);
    expect(res2.body.inserted).toBe(0);
  });

  it('rejects an invalid body', async () => {
    await request(app()).post('/api/logs').send({ nope: true }).expect(400);
  });
});
