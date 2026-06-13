import { AzureOpenAI } from 'openai';
import { env } from '../env.js';

function client(): AzureOpenAI | null {
  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY || !env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT) {
    return null;
  }
  return new AzureOpenAI({
    endpoint: env.AZURE_OPENAI_ENDPOINT,
    apiKey: env.AZURE_OPENAI_API_KEY,
    apiVersion: env.AZURE_OPENAI_API_VERSION,
    deployment: env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
  });
}

/** Embed many texts. Returns null when embeddings are unconfigured. */
export async function embedMany(texts: string[]): Promise<number[][] | null> {
  const c = client();
  if (!c) return null;
  const res = await c.embeddings.create({
    model: env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!,
    input: texts,
  });
  return res.data.map((d) => d.embedding as number[]);
}

/** Embed a single text. Returns null when embeddings are unconfigured. */
export async function embedOne(text: string): Promise<number[] | null> {
  const out = await embedMany([text]);
  return out ? out[0] : null;
}
