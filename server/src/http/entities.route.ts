import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';

const DEMO_USER = 'carlos';

export const entitiesRoute = Router();

entitiesRoute.post('/api/doctor-notes', async (req, res) => {
  const n = req.body;
  await db.insert(schema.doctorNotes).values({
    id: n.id, personId: n.personId, text: n.text,
    timestamp: new Date(n.timestamp), source: n.source, forQuestion: !!n.forQuestion,
  }).onConflictDoNothing();
  res.status(201).json({ ok: true });
});

entitiesRoute.post('/api/medications/:id/adherence', async (req, res) => {
  const { date, scheduledTime, taken } = req.body as { date: string; scheduledTime: string; taken: boolean };
  const [med] = await db.select().from(schema.medications).where(eq(schema.medications.id, req.params.id));
  if (!med) { res.status(404).json({ error: 'no med' }); return; }
  const log = (med.adherenceLog as Array<{ date: string; scheduledTime: string; taken: boolean }>).slice();
  const i = log.findIndex((r) => r.date === date && r.scheduledTime === scheduledTime);
  if (i >= 0) log[i] = { date, scheduledTime, taken };
  else log.push({ date, scheduledTime, taken });
  await db.update(schema.medications).set({ adherenceLog: log }).where(eq(schema.medications.id, req.params.id));
  res.status(200).json({ ok: true });
});

entitiesRoute.post('/api/doctor-visits', async (req, res) => {
  const v = req.body;
  await db.insert(schema.doctorVisits).values({
    id: v.id, personId: v.personId, date: v.date, whatDoctorSaid: v.whatDoctorSaid,
    indications: v.indications, nextAppointment: v.nextAppointment ?? null,
  }).onConflictDoNothing();
  res.status(201).json({ ok: true });
});

entitiesRoute.patch('/api/prefs', async (req, res) => {
  await db.insert(schema.userPrefs)
    .values({ userId: DEMO_USER, prefs: req.body })
    .onConflictDoUpdate({ target: schema.userPrefs.userId, set: { prefs: req.body } });
  res.status(200).json({ ok: true });
});

entitiesRoute.post('/api/achievements', async (req, res) => {
  const a = req.body;
  await db.insert(schema.achievements).values({
    id: a.id, userId: DEMO_USER, title: a.title, description: a.description,
    unlockedAt: new Date(a.unlockedAt), icon: a.icon ?? null,
  }).onConflictDoNothing();
  res.status(201).json({ ok: true });
});
