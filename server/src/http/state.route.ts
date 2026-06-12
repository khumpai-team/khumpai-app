import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';

const DEMO_USER = 'carlos';
const toIso = (d: Date) => d.toISOString();

export const stateRoute = Router();

stateRoute.get('/api/state', async (_req, res) => {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, DEMO_USER));
  if (!user) { res.status(404).json({ error: 'no user' }); return; }
  const persons = await db.select().from(schema.persons).where(eq(schema.persons.userId, DEMO_USER));
  const logs = await db.select().from(schema.logs);
  const medications = await db.select().from(schema.medications);
  const doctorNotes = await db.select().from(schema.doctorNotes);
  const doctorVisits = await db.select().from(schema.doctorVisits);
  const insights = await db.select().from(schema.insights);
  const achievements = await db.select().from(schema.achievements).where(eq(schema.achievements.userId, DEMO_USER));
  const [prefsRow] = await db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, DEMO_USER));
  const [contact] = await db.select().from(schema.emergencyContacts).where(eq(schema.emergencyContacts.userId, DEMO_USER));

  res.json({
    mode: 'patient',
    user: { id: user.id, name: user.name },
    persons: persons.map((p) => ({ id: p.id, name: p.name, relation: p.relation, color: p.color })),
    currentPersonId: persons[0]?.id ?? DEMO_USER,
    logs: logs.map((r) => ({
      id: r.id, personId: r.personId, type: r.type,
      timestamp: toIso(r.timestamp), createdAt: toIso(r.createdAt),
      editedAt: r.editedAt ? toIso(r.editedAt) : undefined,
      source: r.source, confirmed: r.confirmed, isOfflineCapture: r.isOfflineCapture,
      payload: r.payload,
    })),
    medications: medications.map((m) => ({
      id: m.id, personId: m.personId, name: m.name, dose: m.dose,
      frequency: m.frequency, schedule: m.schedule, adherenceLog: m.adherenceLog,
    })),
    doctorNotes: doctorNotes.map((n) => ({
      id: n.id, personId: n.personId, text: n.text, timestamp: toIso(n.timestamp),
      source: n.source, forQuestion: n.forQuestion,
    })),
    doctorVisits: doctorVisits.map((v) => ({
      id: v.id, personId: v.personId, date: v.date, whatDoctorSaid: v.whatDoctorSaid,
      indications: v.indications, nextAppointment: v.nextAppointment ?? undefined,
    })),
    insights: insights.map((i) => ({
      id: i.id, personId: i.personId, pattern: i.pattern, confidence: i.confidence,
      basedOnCount: i.basedOnCount, text: i.text, chartData: i.chartData,
    })),
    prefs: prefsRow?.prefs ?? {},
    emergencyContact: contact
      ? { name: contact.name, phone: contact.phone, relation: contact.relation, isCaregiverUser: contact.isCaregiverUser }
      : null,
    isOffline: false,
    syncQueue: [],
    precomputedPackage: null,
    chatHistory: [],
    achievements: achievements.map((a) => ({
      id: a.id, title: a.title, description: a.description,
      unlockedAt: toIso(a.unlockedAt), icon: a.icon ?? undefined,
    })),
  });
});
