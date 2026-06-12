import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { prepareTestDb } from './helpers/testDb.js';

beforeAll(() => prepareTestDb());

describe('GET /api/state', () => {
  it('returns the seeded AppState for the demo user', async () => {
    const res = await request(createApp()).get('/api/state').expect(200);
    expect(res.body.user.name).toBe('Carlos');
    expect(res.body.logs.length).toBeGreaterThanOrEqual(30);
    expect(res.body.currentPersonId).toBe('carlos');
    expect(res.body.emergencyContact.name).toBe('María');
    expect(res.body.medications[0].name).toBe('Metformina');
  });
});
