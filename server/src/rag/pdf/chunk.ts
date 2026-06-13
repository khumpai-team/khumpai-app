export interface ChunkOptions {
  maxWords: number;
  overlapWords: number;
}

/**
 * Split text into word-windowed chunks with a fixed overlap. Word-based (not
 * token-based) for determinism and zero deps; ~600 words ≈ ~800 tokens.
 */
export function chunkText(text: string, opts: ChunkOptions): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= opts.maxWords) return [words.join(' ')];

  const chunks: string[] = [];
  const step = Math.max(1, opts.maxWords - opts.overlapWords);
  for (let start = 0; start < words.length; start += step) {
    chunks.push(words.slice(start, start + opts.maxWords).join(' '));
    if (start + opts.maxWords >= words.length) break;
  }
  return chunks;
}
