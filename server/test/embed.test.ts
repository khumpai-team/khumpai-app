import { describe, it, expect } from 'vitest';
import { embedMany } from '../src/rag/embed.js';

describe('embedMany', () => {
  it('returns null when no embedding deployment is configured', async () => {
    // env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT is unset in the test environment.
    const result = await embedMany(['hola']);
    expect(result).toBeNull();
  });
});
