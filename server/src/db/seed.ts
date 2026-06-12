/**
 * Seed the database from the front-end SEED_STATE (single source of truth).
 * SEED_STATE is pure data; its only import is `import type ... from '@/types'`,
 * which tsx erases at runtime — so this relative import runs without alias setup.
 * Idempotent: re-running inserts nothing new (onConflictDoNothing).
 */
import { db, schema } from './client.js';
import { SEED_STATE } from '../../../src/data/seed';

async function seed() {
  const s = SEED_STATE;

  await db.insert(schema.users).values({ id: s.user.id, name: s.user.name }).onConflictDoNothing();

  for (const p of s.persons) {
    await db.insert(schema.persons)
      .values({ id: p.id, userId: s.user.id, name: p.name, relation: p.relation, color: p.color })
      .onConflictDoNothing();
  }

  for (const l of s.logs) {
    await db.insert(schema.logs).values({
      id: l.id, personId: l.personId, type: l.type,
      timestamp: new Date(l.timestamp), createdAt: new Date(l.createdAt),
      editedAt: l.editedAt ? new Date(l.editedAt) : null,
      source: l.source, confirmed: l.confirmed, isOfflineCapture: l.isOfflineCapture,
      payload: l.payload,
    }).onConflictDoNothing();
  }

  for (const m of s.medications) {
    await db.insert(schema.medications).values({
      id: m.id, personId: m.personId, name: m.name, dose: m.dose,
      frequency: m.frequency, schedule: m.schedule, adherenceLog: m.adherenceLog,
    }).onConflictDoNothing();
  }

  for (const n of s.doctorNotes) {
    await db.insert(schema.doctorNotes).values({
      id: n.id, personId: n.personId, text: n.text, timestamp: new Date(n.timestamp),
      source: n.source, forQuestion: n.forQuestion,
    }).onConflictDoNothing();
  }

  for (const v of s.doctorVisits) {
    await db.insert(schema.doctorVisits).values({
      id: v.id, personId: v.personId, date: v.date, whatDoctorSaid: v.whatDoctorSaid,
      indications: v.indications, nextAppointment: v.nextAppointment ?? null,
    }).onConflictDoNothing();
  }

  for (const i of s.insights) {
    await db.insert(schema.insights).values({
      id: i.id, personId: i.personId, pattern: i.pattern, confidence: i.confidence,
      basedOnCount: i.basedOnCount, text: i.text, chartData: i.chartData,
    }).onConflictDoNothing();
  }

  for (const a of s.achievements) {
    await db.insert(schema.achievements).values({
      id: a.id, userId: s.user.id, title: a.title, description: a.description,
      unlockedAt: new Date(a.unlockedAt), icon: a.icon ?? null,
    }).onConflictDoNothing();
  }

  await db.insert(schema.userPrefs)
    .values({ userId: s.user.id, prefs: s.prefs })
    .onConflictDoNothing();

  await db.insert(schema.emergencyContacts).values({
    id: 'ec-1', userId: s.user.id, name: s.emergencyContact.name,
    phone: s.emergencyContact.phone, relation: s.emergencyContact.relation,
    isCaregiverUser: s.emergencyContact.isCaregiverUser,
  }).onConflictDoNothing();

  console.log('Seeded.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
