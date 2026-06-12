import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { LogEntryBody, BatchBody } from './validation.js';

export const logsRoute = Router();

const row = (b: ReturnType<typeof LogEntryBody.parse>) => ({
  id: b.id,
  personId: b.personId,
  type: b.type,
  timestamp: new Date(b.timestamp),
  createdAt: new Date(b.createdAt),
  editedAt: b.editedAt ? new Date(b.editedAt) : null,
  source: b.source,
  confirmed: b.confirmed,
  isOfflineCapture: b.isOfflineCapture,
  payload: b.payload,
});

logsRoute.post('/api/logs', async (req, res) => {
  const parsed = LogEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.insert(schema.logs).values(row(parsed.data)).onConflictDoNothing();
  res.status(201).json({ ok: true });
});

logsRoute.post('/api/logs/:id/confirm', async (req, res) => {
  await db.update(schema.logs).set({ confirmed: true }).where(eq(schema.logs.id, req.params.id));
  const [r] = await db.select().from(schema.logs).where(eq(schema.logs.id, req.params.id));
  res.status(200).json({ confirmed: r?.confirmed ?? false });
});

logsRoute.patch('/api/logs/:id', async (req, res) => {
  const parsed = LogEntryBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch: Record<string, unknown> = { editedAt: new Date() };
  if (parsed.data.payload) patch.payload = parsed.data.payload;
  await db.update(schema.logs).set(patch).where(eq(schema.logs.id, req.params.id));
  res.status(200).json({ ok: true });
});

logsRoute.post('/api/logs/batch', async (req, res) => {
  const parsed = BatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  // Insert chronologically so event ordering is preserved; idempotent by id.
  const sorted = [...parsed.data.entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let inserted = 0;
  for (const e of sorted) {
    const r = await db.insert(schema.logs).values(row(e)).onConflictDoNothing().returning({ id: schema.logs.id });
    inserted += r.length;
  }
  res.status(200).json({ inserted });
});
