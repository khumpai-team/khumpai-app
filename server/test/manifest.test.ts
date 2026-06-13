import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MANIFEST, manifestFor } from '../src/rag/manifest.js';

const DOCS_DIR = resolve(__dirname, '../../docs/rag-docs');

describe('rag manifest', () => {
  it('has an entry for every PDF in docs/rag-docs', () => {
    const pdfs = readdirSync(DOCS_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
    expect(pdfs.length).toBeGreaterThan(0);
    for (const f of pdfs) {
      const m = manifestFor(f);
      expect(m, `missing manifest for ${f}`).toBeDefined();
      expect(m!.source.length).toBeGreaterThan(0);
      expect(m!.topic.length).toBeGreaterThan(0);
    }
  });

  it('marks the detailed food-composition table as online-only', () => {
    const entry = MANIFEST.find((m) => m.topic === 'composicion-alimentos');
    expect(entry).toBeDefined();
    expect(entry!.offline).toBe(false);
  });
});
