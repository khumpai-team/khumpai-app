import { db, schema } from '../db/client.js';
import { KNOWLEDGE } from '../data/knowledge.js';

export async function ingestKnowledge(): Promise<number> {
  for (const entry of KNOWLEDGE) {
    await db
      .insert(schema.knowledge)
      .values({
        id: entry.id,
        topic: entry.topic,
        content: entry.content,
        source: entry.source,
        sourceUrl: entry.sourceUrl ?? null,
      })
      .onConflictDoUpdate({
        target: schema.knowledge.id,
        set: {
          topic: entry.topic,
          content: entry.content,
          source: entry.source,
          sourceUrl: entry.sourceUrl ?? null,
        },
      });
  }
  return KNOWLEDGE.length;
}

// Run as script
const count = await ingestKnowledge();
console.log(`Ingested ${count} knowledge entries`);
process.exit(0);
