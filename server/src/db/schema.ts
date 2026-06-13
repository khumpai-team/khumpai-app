import { pgTable, text, integer, boolean, timestamp, jsonb, date } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const persons = pgTable('persons', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  relation: text('relation').notNull(),
  color: text('color').notNull(),
});

export const logs = pgTable('logs', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull().references(() => persons.id),
  type: text('type').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  source: text('source').notNull(),
  confirmed: boolean('confirmed').notNull().default(false),
  isOfflineCapture: boolean('is_offline_capture').notNull().default(false),
  payload: jsonb('payload').notNull(),
});

export const medications = pgTable('medications', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull().references(() => persons.id),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  frequency: text('frequency').notNull(),
  schedule: jsonb('schedule').notNull(),
  adherenceLog: jsonb('adherence_log').notNull(),
});

export const doctorNotes = pgTable('doctor_notes', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull().references(() => persons.id),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  source: text('source').notNull(),
  forQuestion: boolean('for_question').notNull().default(false),
});

export const doctorVisits = pgTable('doctor_visits', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull().references(() => persons.id),
  date: date('date').notNull(),
  whatDoctorSaid: text('what_doctor_said').notNull(),
  indications: jsonb('indications').notNull(),
  nextAppointment: date('next_appointment'),
});

export const insights = pgTable('insights', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull().references(() => persons.id),
  pattern: text('pattern').notNull(),
  confidence: text('confidence').notNull(),
  basedOnCount: integer('based_on_count').notNull(),
  text: text('text').notNull(),
  chartData: jsonb('chart_data').notNull(),
});

export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull(),
  icon: text('icon'),
});

export const userPrefs = pgTable('user_prefs', {
  userId: text('user_id').primaryKey().references(() => users.id),
  prefs: jsonb('prefs').notNull(),
});

export const emergencyContacts = pgTable('emergency_contacts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  relation: text('relation').notNull(),
  isCaregiverUser: boolean('is_caregiver_user').notNull().default(false),
});

export const knowledge = pgTable('knowledge', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  content: text('content').notNull(),
  source: text('source').notNull(),
  sourceUrl: text('source_url'),
});
