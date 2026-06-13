import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { extractPdf } from '../src/rag/pdf/extract.js';

const DOCS_DIR = resolve(__dirname, '../../docs/rag-docs');

describe('extractPdf', () => {
  it('extracts a meaningful amount of text from a text-based PDF', async () => {
    const file = 'Recomendaciones para el autocuidado de los pies - OPS.pdf';
    const res = await extractPdf(resolve(DOCS_DIR, file));
    expect(res.charCount).toBeGreaterThan(200);
    expect(res.text.toLowerCase()).toContain('pie');
  }, 30000);
});
