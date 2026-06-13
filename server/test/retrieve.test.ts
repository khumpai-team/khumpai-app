import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { retrieve } from '../src/rag/retrieve.js';

beforeAll(() => {
  // Idempotent: upserts knowledge rows before any test
  execSync('npm run db:ingest', {
    stdio: 'inherit',
    cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  });
}, 30_000);

describe('retrieve()', () => {
  it('returns results for "puedo comer arroz" and content mentions arroz or fibra', async () => {
    const results = await retrieve('puedo comer arroz', 3);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const combined = results.map((r) => r.content.toLowerCase()).join(' ');
    expect(combined).toMatch(/arroz|fibra|carbohidrato/);
  });

  it('each result has source set to a non-empty string', async () => {
    const results = await retrieve('diabetes tipo 2', 4);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(typeof r.source).toBe('string');
      expect(r.source.length).toBeGreaterThan(0);
    }
  });

  it('returns results for a short keyword via ILIKE fallback', async () => {
    const results = await retrieve('pie', 4);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for a nonsense query', async () => {
    const results = await retrieve('xyzabcqwerty12345', 4);
    expect(results).toEqual([]);
  });
});
