import { describe, it, expect } from 'vitest';
import { chunkText } from '../src/rag/pdf/chunk.js';

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    const chunks = chunkText('hola mundo', { maxWords: 600, overlapWords: 80 });
    expect(chunks).toEqual(['hola mundo']);
  });

  it('splits long text into overlapping chunks', () => {
    const words = Array.from({ length: 1300 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(words, { maxWords: 600, overlapWords: 80 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Each chunk no longer than maxWords
    for (const c of chunks) expect(c.split(/\s+/).length).toBeLessThanOrEqual(600);
    // Overlap: the start of chunk 2 repeats the tail of chunk 1
    const tail1 = chunks[0].split(/\s+/).slice(-80);
    const head2 = chunks[1].split(/\s+/).slice(0, 80);
    expect(head2).toEqual(tail1);
  });
});
