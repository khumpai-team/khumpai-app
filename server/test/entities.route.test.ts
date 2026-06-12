import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { like } from 'drizzle-orm';
import { createApp } from '../src/index.js';
import { db, schema } from '../src/db/client.js';
import { prepareTestDb } from './helpers/testDb.js';

beforeAll(async () => {
  prepareTestDb();
  await db.delete(schema.doctorNotes).where(like(schema.doctorNotes.id, 't-%'));
});

const app = () => createApp();

describe('entities API', () => {
  it('adds a doctor note visible in /api/state', async () => {
    await request(app()).post('/api/doctor-notes').send({
      id: 't-dn-1', personId: 'carlos', text: 'prueba',
      timestamp: new Date().toISOString(), source: 'user', forQuestion: true,
    }).expect(201);
    const res = await request(app()).get('/api/state').expect(200);
    expect(res.body.doctorNotes.find((n: { id: string }) => n.id === 't-dn-1')).toBeTruthy();
  });

  it('records medication adherence idempotently (update, not duplicate)', async () => {
    const body = { date: '2026-06-12', scheduledTime: '08:00', taken: true };
    await request(app()).post('/api/medications/med-metformina/adherence').send(body).expect(200);
    await request(app()).post('/api/medications/med-metformina/adherence').send({ ...body, taken: false }).expect(200);
    const res = await request(app()).get('/api/state').expect(200);
    const med = res.body.medications.find((m: { id: string }) => m.id === 'med-metformina');
    const recs = med.adherenceLog.filter(
      (r: { date: string; scheduledTime: string }) => r.date === '2026-06-12' && r.scheduledTime === '08:00',
    );
    expect(recs.length).toBe(1);
    expect(recs[0].taken).toBe(false);
  });

  it('upserts prefs', async () => {
    await request(app()).patch('/api/prefs').send({
      preferredInputMode: 'voice',
      inputModeCounts: { text: 1, voice: 5, quick_action: 0 },
      activeHours: [9],
      activeHourCounts: { '9': 1 },
      acceptedSuggestionTypes: {},
      rejectedSuggestionTypes: {},
    }).expect(200);
    const res = await request(app()).get('/api/state').expect(200);
    expect(res.body.prefs.preferredInputMode).toBe('voice');
  });
});
