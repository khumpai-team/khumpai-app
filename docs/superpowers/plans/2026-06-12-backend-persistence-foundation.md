# Backend & Persistence Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ephemeral `sessionStorage` with a durable Azure-Postgres-backed Express API, and move the Azure OpenAI proxy into that API — without changing the UI's store action surface or the `AgentProvider` seam.

**Architecture:** A standalone Express API in `server/` (own package.json) talks to Azure Database for PostgreSQL via Drizzle ORM. The Vite app keeps its Zustand store as an in-memory cache but bootstraps from `GET /api/state` and write-throughs mutations to the API via a new repository layer. The dev-only Vite proxy middleware is removed; its streaming logic moves to `POST /api/agent/chat`, reached through Vite's `server.proxy`.

**Tech Stack:** Express, Drizzle ORM + drizzle-kit, `postgres` (postgres-js) driver, Zod, openai (`AzureOpenAI`), Vitest + supertest, Docker Postgres for local/test.

---

## File Structure

```
server/                          # NEW — standalone API package (server-only deps)
  package.json
  tsconfig.json
  drizzle.config.ts
  .env.example
  src/
    index.ts                     # express app + listen
    env.ts                       # validated env loader
    db/
      client.ts                  # drizzle client (postgres-js)
      schema.ts                  # all tables
      seed.ts                    # port SEED_STATE → DB
    http/
      validation.ts              # zod request schemas
      state.route.ts             # GET /api/state
      logs.route.ts              # logs CRUD + confirm + batch
      entities.route.ts          # doctor-notes, medications, visits, prefs, achievements
      agent.route.ts             # POST /api/agent/chat (SSE proxy)
  test/
    helpers/testDb.ts            # spin up/migrate a throwaway test schema
    logs.route.test.ts
    state.route.test.ts
src/lib/api/
  client.ts                      # NEW — typed fetch client for the API
src/store/appStore.ts            # MODIFY — bootstrap + write-through
src/agent/FoundryAgentProvider.ts# MODIFY — point at /api/agent/chat
vite.config.ts                   # MODIFY — remove plugin, add server.proxy
src/agent/server/foundryProxyPlugin.ts # DELETE — logic moves to server
```

---

## Phase 1 — Server scaffold + DB schema

### Task 1: Scaffold the `server/` package

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/.env.example`, `server/src/env.ts`, `server/src/index.ts`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "khumpai-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node --import tsx src/index.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/db/seed.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "^0.36.0",
    "express": "^4.21.0",
    "openai": "^6.42.0",
    "postgres": "^3.4.5",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "drizzle-kit": "^0.28.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^4.1.8",
    "@types/express": "^4.17.21",
    "@types/supertest": "^6.0.2"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create `server/.env.example`**

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/khumpai
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
AZURE_OPENAI_API_VERSION=2024-12-01-preview
PORT=8787
ALLOWED_ORIGIN=http://localhost:5173
```

- [ ] **Step 4: Create `server/src/env.ts`**

```ts
import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().url(),
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().default('gpt-4.1'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-12-01-preview'),
  PORT: z.coerce.number().default(8787),
  ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = Env.parse(process.env);
```

- [ ] **Step 5: Create `server/src/index.ts` (minimal health check first)**

```ts
import express from 'express';
import { env } from './env.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN);
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  createApp().listen(env.PORT, () => console.log(`API on :${env.PORT}`));
}
```

- [ ] **Step 6: Install + verify health route**

Run: `cd server && npm install && DATABASE_URL=postgres://localhost/x npm run dev`
Then: `curl -s localhost:8787/api/health` → Expected: `{"ok":true}`

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/tsconfig.json server/.env.example server/src/env.ts server/src/index.ts
git commit -m "feat(server): scaffold Express API with health route"
```

### Task 2: Define the Drizzle schema

**Files:**
- Create: `server/src/db/schema.ts`, `server/drizzle.config.ts`, `server/src/db/client.ts`

- [ ] **Step 1: Create `server/src/db/schema.ts`**

```ts
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
  relation: text('relation').notNull(),       // 'self' | 'father' | 'mother'
  color: text('color').notNull(),
});

export const logs = pgTable('logs', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull().references(() => persons.id),
  type: text('type').notNull(),               // LogType
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  source: text('source').notNull(),
  confirmed: boolean('confirmed').notNull().default(false),
  isOfflineCapture: boolean('is_offline_capture').notNull().default(false),
  payload: jsonb('payload').notNull(),        // PayloadByType[type]
});

export const medications = pgTable('medications', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull().references(() => persons.id),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  frequency: text('frequency').notNull(),
  schedule: jsonb('schedule').notNull(),       // string[]
  adherenceLog: jsonb('adherence_log').notNull(), // AdherenceRecord[]
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
  indications: jsonb('indications').notNull(), // string[]
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
  prefs: jsonb('prefs').notNull(),             // UserPrefs
});

export const emergencyContacts = pgTable('emergency_contacts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  relation: text('relation').notNull(),
  isCaregiverUser: boolean('is_caregiver_user').notNull().default(false),
});
```

- [ ] **Step 2: Create `server/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 3: Create `server/src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { env } from '../env.js';

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });
export { schema };
```

- [ ] **Step 4: Generate + apply the migration**

Run: `cd server && npm run db:generate && npm run db:migrate`
Expected: a `drizzle/0000_*.sql` file is created and applied; tables exist in Postgres.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/schema.ts server/drizzle.config.ts server/src/db/client.ts server/drizzle/
git commit -m "feat(server): drizzle schema + initial migration"
```

### Task 3: Seed Carlos into the DB

**Files:**
- Create: `server/src/db/seed.ts`

- [ ] **Step 1: Write `server/src/db/seed.ts`**

Import the existing front-end seed (single source of truth) and insert rows. The
front-end `SEED_STATE` is pure data and safe to import server-side.

```ts
import { db, schema } from './client.js';
import { SEED_STATE } from '../../../src/data/seed.ts';

async function seed() {
  const s = SEED_STATE;
  await db.insert(schema.users).values({ id: s.user.id, name: s.user.name }).onConflictDoNothing();
  for (const p of s.persons) await db.insert(schema.persons).values({ ...p, userId: s.user.id }).onConflictDoNothing();
  for (const l of s.logs) await db.insert(schema.logs).values({
    id: l.id, personId: l.personId, type: l.type,
    timestamp: new Date(l.timestamp), createdAt: new Date(l.createdAt),
    editedAt: l.editedAt ? new Date(l.editedAt) : null,
    source: l.source, confirmed: l.confirmed, isOfflineCapture: l.isOfflineCapture,
    payload: l.payload,
  }).onConflictDoNothing();
  for (const m of s.medications) await db.insert(schema.medications).values({
    id: m.id, personId: m.personId, name: m.name, dose: m.dose,
    frequency: m.frequency, schedule: m.schedule, adherenceLog: m.adherenceLog,
  }).onConflictDoNothing();
  for (const n of s.doctorNotes) await db.insert(schema.doctorNotes).values({
    id: n.id, personId: n.personId, text: n.text, timestamp: new Date(n.timestamp),
    source: n.source, forQuestion: n.forQuestion,
  }).onConflictDoNothing();
  for (const v of s.doctorVisits) await db.insert(schema.doctorVisits).values({
    id: v.id, personId: v.personId, date: v.date, whatDoctorSaid: v.whatDoctorSaid,
    indications: v.indications, nextAppointment: v.nextAppointment ?? null,
  }).onConflictDoNothing();
  for (const i of s.insights) await db.insert(schema.insights).values({
    id: i.id, personId: i.personId, pattern: i.pattern, confidence: i.confidence,
    basedOnCount: i.basedOnCount, text: i.text, chartData: i.chartData,
  }).onConflictDoNothing();
  for (const a of s.achievements) await db.insert(schema.achievements).values({
    id: a.id, userId: s.user.id, title: a.title, description: a.description,
    unlockedAt: new Date(a.unlockedAt), icon: a.icon ?? null,
  }).onConflictDoNothing();
  await db.insert(schema.userPrefs).values({ userId: s.user.id, prefs: s.prefs }).onConflictDoNothing();
  await db.insert(schema.emergencyContacts).values({ id: 'ec-1', userId: s.user.id, ...s.emergencyContact }).onConflictDoNothing();
  console.log('Seeded.');
  process.exit(0);
}
seed();
```

- [ ] **Step 2: Run the seed**

Run: `cd server && npm run db:seed`
Expected: `Seeded.` and rows present (`psql $DATABASE_URL -c "select count(*) from logs;"` ≥ 30).

- [ ] **Step 3: Commit**

```bash
git add server/src/db/seed.ts
git commit -m "feat(server): seed Carlos from shared SEED_STATE"
```

---

## Phase 2 — Data API (TDD)

### Task 4: Test harness for the API

**Files:**
- Create: `server/test/helpers/testDb.ts`, `server/vitest.config.ts`

- [ ] **Step 1: Create `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', hookTimeout: 30000 } });
```

- [ ] **Step 2: Create `server/test/helpers/testDb.ts`**

```ts
import { execSync } from 'node:child_process';
// Assumes a local/CI Postgres reachable via DATABASE_URL pointing at a test DB.
// Applies migrations + seed before the suite.
export function prepareTestDb() {
  execSync('npm run db:migrate', { stdio: 'inherit' });
  execSync('npm run db:seed', { stdio: 'inherit' });
}
```

- [ ] **Step 3: Commit**

```bash
git add server/vitest.config.ts server/test/helpers/testDb.ts
git commit -m "test(server): vitest + test-db harness"
```

### Task 5: `GET /api/state` (bootstrap) — TDD

**Files:**
- Create: `server/src/http/state.route.ts`, `server/test/state.route.test.ts`
- Modify: `server/src/index.ts` (mount route)

- [ ] **Step 1: Write the failing test — `server/test/state.route.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { prepareTestDb } from './helpers/testDb.js';

beforeAll(() => prepareTestDb());

describe('GET /api/state', () => {
  it('returns the seeded AppState for the demo user', async () => {
    const res = await request(createApp()).get('/api/state').expect(200);
    expect(res.body.user.name).toBe('Carlos');
    expect(res.body.logs.length).toBeGreaterThanOrEqual(30);
    expect(res.body.currentPersonId).toBe('carlos');
    expect(res.body.emergencyContact.name).toBe('María');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `cd server && npx vitest run test/state.route.test.ts`
Expected: FAIL (route 404 / cannot find `/api/state`).

- [ ] **Step 3: Implement `server/src/http/state.route.ts`**

```ts
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';

const DEMO_USER = 'carlos';

export const stateRoute = Router();

stateRoute.get('/api/state', async (_req, res) => {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, DEMO_USER));
  if (!user) return res.status(404).json({ error: 'no user' });
  const persons = await db.select().from(schema.persons).where(eq(schema.persons.userId, DEMO_USER));
  const personIds = persons.map((p) => p.id);
  const inPersons = (col: any) => personIds.length ? (db as any) : (db as any); // see note
  const logs = await db.select().from(schema.logs);
  const medications = await db.select().from(schema.medications);
  const doctorNotes = await db.select().from(schema.doctorNotes);
  const doctorVisits = await db.select().from(schema.doctorVisits);
  const insights = await db.select().from(schema.insights);
  const achievements = await db.select().from(schema.achievements).where(eq(schema.achievements.userId, DEMO_USER));
  const [prefsRow] = await db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, DEMO_USER));
  const [contact] = await db.select().from(schema.emergencyContacts).where(eq(schema.emergencyContacts.userId, DEMO_USER));

  const toLog = (r: typeof logs[number]) => ({
    id: r.id, personId: r.personId, type: r.type,
    timestamp: r.timestamp.toISOString(), createdAt: r.createdAt.toISOString(),
    editedAt: r.editedAt?.toISOString(), source: r.source, confirmed: r.confirmed,
    isOfflineCapture: r.isOfflineCapture, payload: r.payload,
  });

  res.json({
    mode: 'patient',
    user: { id: user.id, name: user.name },
    persons,
    currentPersonId: persons[0]?.id ?? DEMO_USER,
    logs: logs.map(toLog),
    medications,
    doctorNotes: doctorNotes.map((n) => ({ ...n, timestamp: n.timestamp.toISOString() })),
    doctorVisits,
    insights,
    prefs: prefsRow?.prefs ?? {},
    emergencyContact: contact
      ? { name: contact.name, phone: contact.phone, relation: contact.relation, isCaregiverUser: contact.isCaregiverUser }
      : null,
    isOffline: false,
    syncQueue: [],
    precomputedPackage: null,
    chatHistory: [],
    achievements: achievements.map((a) => ({ ...a, unlockedAt: a.unlockedAt.toISOString() })),
  });
});
```
> Note: the `inPersons` placeholder line above is illustrative scoping; with a single demo user all rows belong to Carlos, so the broad `select()` is correct for now. When real multi-user lands, filter logs/medications/etc. by `inArray(col, personIds)`.

- [ ] **Step 4: Mount the route in `server/src/index.ts`**

Add after the health route, before `return app;`:
```ts
import { stateRoute } from './http/state.route.js';
// ...inside createApp(), after app.get('/api/health', ...):
app.use(stateRoute);
```

- [ ] **Step 5: Run → pass**

Run: `cd server && npx vitest run test/state.route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/http/state.route.ts server/test/state.route.test.ts server/src/index.ts
git commit -m "feat(server): GET /api/state bootstrap (TDD)"
```

### Task 6: Logs write API — create / confirm / edit / batch (TDD)

**Files:**
- Create: `server/src/http/validation.ts`, `server/src/http/logs.route.ts`, `server/test/logs.route.test.ts`
- Modify: `server/src/index.ts` (mount)

- [ ] **Step 1: Write the failing test — `server/test/logs.route.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { prepareTestDb } from './helpers/testDb.js';

beforeAll(() => prepareTestDb());
const app = () => createApp();
const draft = (id: string) => ({
  id, personId: 'carlos', type: 'glucose',
  timestamp: new Date().toISOString(), createdAt: new Date().toISOString(),
  source: 'conversation', confirmed: false, isOfflineCapture: false,
  payload: { value: 142, moment: 'ayunas' },
});

describe('logs API', () => {
  it('creates a log', async () => {
    await request(app()).post('/api/logs').send(draft('t-log-1')).expect(201);
    const res = await request(app()).get('/api/state').expect(200);
    expect(res.body.logs.find((l: any) => l.id === 't-log-1')).toBeTruthy();
  });

  it('confirm is idempotent', async () => {
    await request(app()).post('/api/logs').send(draft('t-log-2')).expect(201);
    await request(app()).post('/api/logs/t-log-2/confirm').expect(200);
    const again = await request(app()).post('/api/logs/t-log-2/confirm').expect(200);
    expect(again.body.confirmed).toBe(true);
  });

  it('batch flush inserts in chronological order and is idempotent by id', async () => {
    const a = { ...draft('t-batch-a'), timestamp: '2026-06-10T08:00:00.000Z' };
    const b = { ...draft('t-batch-b'), timestamp: '2026-06-10T07:00:00.000Z' };
    const res = await request(app()).post('/api/logs/batch').send({ entries: [a, b] }).expect(200);
    expect(res.body.inserted).toBe(2);
    // re-sending the same ids does not duplicate
    const res2 = await request(app()).post('/api/logs/batch').send({ entries: [a, b] }).expect(200);
    expect(res2.body.inserted).toBe(0);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `cd server && npx vitest run test/logs.route.test.ts`
Expected: FAIL (routes missing).

- [ ] **Step 3: Create `server/src/http/validation.ts`**

```ts
import { z } from 'zod';

export const LogEntryBody = z.object({
  id: z.string(),
  personId: z.string(),
  type: z.enum(['meal', 'glucose', 'medication', 'symptom', 'sleep', 'mood', 'stress', 'activity']),
  timestamp: z.string(),
  createdAt: z.string(),
  editedAt: z.string().optional(),
  source: z.enum(['conversation', 'quick_action', 'notification', 'seed']),
  confirmed: z.boolean(),
  isOfflineCapture: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
});
export const BatchBody = z.object({ entries: z.array(LogEntryBody) });
```

- [ ] **Step 4: Implement `server/src/http/logs.route.ts`**

```ts
import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { LogEntryBody, BatchBody } from './validation.js';

export const logsRoute = Router();

const row = (b: ReturnType<typeof LogEntryBody.parse>) => ({
  id: b.id, personId: b.personId, type: b.type,
  timestamp: new Date(b.timestamp), createdAt: new Date(b.createdAt),
  editedAt: b.editedAt ? new Date(b.editedAt) : null,
  source: b.source, confirmed: b.confirmed, isOfflineCapture: b.isOfflineCapture,
  payload: b.payload,
});

logsRoute.post('/api/logs', async (req, res) => {
  const parsed = LogEntryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
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
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const patch: Record<string, unknown> = { editedAt: new Date() };
  if (parsed.data.payload) patch.payload = parsed.data.payload;
  await db.update(schema.logs).set(patch).where(eq(schema.logs.id, req.params.id));
  res.status(200).json({ ok: true });
});

logsRoute.post('/api/logs/batch', async (req, res) => {
  const parsed = BatchBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const sorted = [...parsed.data.entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let inserted = 0;
  for (const e of sorted) {
    const r = await db.insert(schema.logs).values(row(e)).onConflictDoNothing().returning({ id: schema.logs.id });
    inserted += r.length;
  }
  res.status(200).json({ inserted });
});
```

- [ ] **Step 5: Mount + run → pass**

Modify `server/src/index.ts`: `import { logsRoute } from './http/logs.route.js';` and `app.use(logsRoute);`
Run: `cd server && npx vitest run test/logs.route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/http/validation.ts server/src/http/logs.route.ts server/test/logs.route.test.ts server/src/index.ts
git commit -m "feat(server): logs create/confirm/edit/batch (TDD)"
```

### Task 7: Remaining entity writes (doctor-notes, medications adherence, visits, prefs, achievements)

**Files:**
- Create: `server/src/http/entities.route.ts`
- Modify: `server/src/index.ts` (mount)

- [ ] **Step 1: Implement `server/src/http/entities.route.ts`** (complete, all endpoints)

```ts
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';

export const entitiesRoute = Router();

entitiesRoute.post('/api/doctor-notes', async (req, res) => {
  const n = req.body; // { id, personId, text, timestamp, source, forQuestion }
  await db.insert(schema.doctorNotes).values({
    id: n.id, personId: n.personId, text: n.text,
    timestamp: new Date(n.timestamp), source: n.source, forQuestion: !!n.forQuestion,
  }).onConflictDoNothing();
  res.status(201).json({ ok: true });
});

entitiesRoute.post('/api/medications/:id/adherence', async (req, res) => {
  const { date, scheduledTime, taken } = req.body;
  const [med] = await db.select().from(schema.medications).where(eq(schema.medications.id, req.params.id));
  if (!med) return res.status(404).json({ error: 'no med' });
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
  const userId = 'carlos';
  await db.insert(schema.userPrefs).values({ userId, prefs: req.body })
    .onConflictDoUpdate({ target: schema.userPrefs.userId, set: { prefs: req.body } });
  res.status(200).json({ ok: true });
});

entitiesRoute.post('/api/achievements', async (req, res) => {
  const a = req.body; // { id, title, description, unlockedAt, icon? }
  await db.insert(schema.achievements).values({
    id: a.id, userId: 'carlos', title: a.title, description: a.description,
    unlockedAt: new Date(a.unlockedAt), icon: a.icon ?? null,
  }).onConflictDoNothing();
  res.status(201).json({ ok: true });
});
```

- [ ] **Step 2: Add a smoke test in `server/test/logs.route.test.ts`** (append)

```ts
it('adds a doctor note', async () => {
  await request(app()).post('/api/doctor-notes').send({
    id: 't-dn-1', personId: 'carlos', text: 'prueba',
    timestamp: new Date().toISOString(), source: 'user', forQuestion: true,
  }).expect(201);
  const res = await request(app()).get('/api/state').expect(200);
  expect(res.body.doctorNotes.find((n: any) => n.id === 't-dn-1')).toBeTruthy();
});
```

- [ ] **Step 3: Mount + run → pass**

Modify `server/src/index.ts`: `import { entitiesRoute } from './http/entities.route.js';` + `app.use(entitiesRoute);`
Run: `cd server && npx vitest run`
Expected: PASS (all suites).

- [ ] **Step 4: Commit**

```bash
git add server/src/http/entities.route.ts server/test/logs.route.test.ts server/src/index.ts
git commit -m "feat(server): doctor-notes, adherence, visits, prefs, achievements writes"
```

---

## Phase 3 — Migrate the model proxy into the API

### Task 8: `POST /api/agent/chat` (SSE) in the server

**Files:**
- Create: `server/src/http/agent.route.ts`
- Modify: `server/src/index.ts` (mount)
- Reference (copy logic, then delete later): `src/agent/server/foundryProxyPlugin.ts`, `src/agent/foundryConfig.ts`

- [ ] **Step 1: Implement `server/src/http/agent.route.ts`** (port the existing proxy)

```ts
import { Router } from 'express';
import { AzureOpenAI } from 'openai';
import { env } from '../env.js';
// Re-use the shared prompt + tool defs from the front-end (pure data, no DOM).
import { KHUMPI_SYSTEM_PROMPT, FOUNDRY_TOOL_DEFINITIONS } from '../../../src/agent/foundryConfig.ts';

export const agentRoute = Router();

agentRoute.post('/api/agent/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (o: unknown) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  const done = () => { send({ type: 'done' }); res.end(); };

  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
    send({ type: 'error', message: 'Azure OpenAI not configured on the server.' });
    return done();
  }
  let messages = (req.body?.messages ?? []) as Array<{ role: string; content: string | null }>;
  if (messages[0]?.role !== 'system') {
    const nowCtx = `\n\n## Current context\nThe current date and time is ${new Date().toISOString()}.`;
    messages = [{ role: 'system', content: KHUMPI_SYSTEM_PROMPT + nowCtx }, ...messages];
  }
  try {
    const client = new AzureOpenAI({
      endpoint: env.AZURE_OPENAI_ENDPOINT, apiKey: env.AZURE_OPENAI_API_KEY,
      apiVersion: env.AZURE_OPENAI_API_VERSION, deployment: env.AZURE_OPENAI_DEPLOYMENT,
    });
    const stream = await client.chat.completions.create({
      model: env.AZURE_OPENAI_DEPLOYMENT,
      messages: messages as any,
      tools: FOUNDRY_TOOL_DEFINITIONS as any,
      stream: true,
    });
    const acc = new Map<number, { id: string; name: string; arguments: string }>();
    for await (const chunk of stream as AsyncIterable<any>) {
      const choice = chunk?.choices?.[0];
      if (!choice) continue;
      if (typeof choice.delta?.content === 'string' && choice.delta.content)
        send({ type: 'text', delta: choice.delta.content });
      for (const tc of choice.delta?.tool_calls ?? []) {
        const cur = acc.get(tc.index ?? 0) ?? { id: '', name: '', arguments: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name = tc.function.name;
        if (tc.function?.arguments) cur.arguments += tc.function.arguments;
        acc.set(tc.index ?? 0, cur);
      }
      if ((choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') && acc.size) {
        send({ type: 'tool_calls', toolCalls: [...acc.values()].map((a) => ({
          id: a.id, name: a.name, arguments: JSON.parse(a.arguments || '{}'),
        })) });
        acc.clear();
      }
    }
  } catch (err) {
    send({ type: 'error', message: String(err) });
  }
  done();
});
```

- [ ] **Step 2: Mount + manual smoke test**

Modify `server/src/index.ts`: `import { agentRoute } from './http/agent.route.js';` + `app.use(agentRoute);`
Run (server up with real Azure env): `curl -sN -X POST localhost:8787/api/agent/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"Hola"}]}'`
Expected: SSE `data: {"type":"text",...}` lines then `data: {"type":"done"}`.

- [ ] **Step 3: Commit**

```bash
git add server/src/http/agent.route.ts server/src/index.ts
git commit -m "feat(server): migrate Azure OpenAI SSE proxy to /api/agent/chat"
```

---

## Phase 4 — Client: bootstrap + write-through + wiring

### Task 9: API client (repository layer)

**Files:**
- Create: `src/lib/api/client.ts`

- [ ] **Step 1: Implement `src/lib/api/client.ts`**

```ts
import type { AppState, LogEntry, DoctorNote, DoctorVisit, UserPrefs, Achievement, AdherenceRecord } from '@/types';

const base = '/api';
async function jpost(path: string, body: unknown): Promise<void> {
  await fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

export const api = {
  async fetchState(): Promise<AppState | null> {
    try {
      const res = await fetch(base + '/state');
      if (!res.ok) return null;
      return (await res.json()) as AppState;
    } catch { return null; }
  },
  createLog: (e: LogEntry) => jpost('/logs', e),
  confirmLog: (id: string) => jpost(`/logs/${id}/confirm`, {}),
  flushBatch: (entries: LogEntry[]) => jpost('/logs/batch', { entries }),
  addDoctorNote: (n: DoctorNote) => jpost('/doctor-notes', n),
  addDoctorVisit: (v: DoctorVisit) => jpost('/doctor-visits', v),
  logAdherence: (medId: string, r: AdherenceRecord) => jpost(`/medications/${medId}/adherence`, r),
  updatePrefs: (p: UserPrefs) => fetch(base + '/prefs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).then(() => undefined),
  addAchievement: (a: Achievement) => jpost('/achievements', a),
};
```

- [ ] **Step 2: Typecheck**

Run (repo root): `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/client.ts
git commit -m "feat(web): typed API client (repository layer)"
```

### Task 10: Store — bootstrap from API + write-through

**Files:**
- Modify: `src/store/appStore.ts`

- [ ] **Step 1: Replace the persistence strategy.** Remove `persist(..., sessionStorage)` wrapping; keep the store creation. Add a `hydrate()` and make mutating actions write-through via `api`. Concretely:

  1. Drop the `persist`/`createJSONStorage` import and wrapper; export a plain `create<...>()(...)` store initialized from `SEED_STATE` (so first paint has data before hydration).
  2. Add an exported async `hydrateFromServer()`:
     ```ts
     import { api } from '@/lib/api/client';
     export async function hydrateFromServer() {
       const state = await api.fetchState();
       if (state) useAppStore.setState(state);
     }
     ```
  3. In each mutating action, after the in-memory `set(...)`, fire the matching API call (write-through, fire-and-forget with offline fallback):
     - `addLog(e)` → `void api.createLog(e)`
     - `confirmLog(id)` → `void api.confirmLog(id)`
     - `addDoctorNote(n)` → `void api.addDoctorNote(n)`
     - `logMedicationTaken(medId, r)` → `void api.logAdherence(medId, r)`
     - `addDoctorVisit(v)` → `void api.addDoctorVisit(v)` *(add to client)*
     - `updatePrefs(p)` → `void api.updatePrefs(nextPrefs)`
     - `addAchievement(a)` → `void api.addAchievement(a)`
     - `enqueueOffline(e)` → unchanged (stays local until flush)
     - `flushSyncQueue()` → after merging locally, `void api.flushBatch(flushed)`

- [ ] **Step 2: Call `hydrateFromServer()` on app start.** In `src/main.tsx` (UI-agent territory — coordinate), call it before/after render, e.g. `hydrateFromServer();` at module load. If the UI agent owns `main.tsx`, hand them this one-liner instead of editing directly.

- [ ] **Step 3: Typecheck + existing tests**

Run: `npx tsc --noEmit` (0 errors) and `npx vitest run` (still 155 green — store action surface unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/store/appStore.ts
git commit -m "feat(web): store bootstraps from API + write-through persistence"
```

### Task 11: Vite wiring — proxy `/api`, remove dev middleware

**Files:**
- Modify: `vite.config.ts`
- Delete: `src/agent/server/foundryProxyPlugin.ts`
- Modify: `src/agent/FoundryAgentProvider.ts` (endpoint path)

- [ ] **Step 1: Update `vite.config.ts`** — remove `foundryProxyPlugin()` import + usage; add a proxy:

```ts
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
```

- [ ] **Step 2: Point the provider at the new path.** In `src/agent/FoundryAgentProvider.ts`, change the fetch URL from `/api/foundry/chat` to `/api/agent/chat`.

- [ ] **Step 3: Delete the dev middleware**

```bash
git rm src/agent/server/foundryProxyPlugin.ts
```

- [ ] **Step 4: Verify end-to-end (dev)**

Run two terminals: `cd server && npm run dev` and `npm run dev` (root).
- `curl -s localhost:5173/api/health` → `{"ok":true}` (proves the Vite→Express proxy).
- In the browser with `VITE_AGENT_PROVIDER=foundry`, send a logging message → registerEntry card → confirm → entry persists; reload the page → entry **survives** (proves persistence).

- [ ] **Step 5: Typecheck + tests + commit**

Run: `npx tsc --noEmit` (0 errors), `npx vitest run` (155 green).
```bash
git add vite.config.ts src/agent/FoundryAgentProvider.ts
git commit -m "feat(web): proxy /api to Express; retire dev-only middleware"
```

---

## Phase 5 — Docs & coordination

### Task 12: Update COORDINATION.md + README run steps

**Files:**
- Modify: `COORDINATION.md`

- [ ] **Step 1:** Document the new run sequence (start Postgres, `cd server && npm i && npm run db:migrate && npm run db:seed && npm run dev`, then root `npm run dev`), the `/server/.env` vars, that the Foundry key now lives in `server/.env` (front-end `.env` no longer needs Azure keys), and that the store now hydrates from `/api/state`.

- [ ] **Step 2: Commit**

```bash
git add COORDINATION.md
git commit -m "docs: backend run steps + persistence coordination notes"
```

---

## Self-Review

**Spec coverage:** Architecture (Tasks 1,8,11) · Schema (Task 2) · Seed (Task 3) · API surface incl. `/api/state`, logs CRUD/confirm/batch, entities, `/api/agent/chat` (Tasks 5–8) · Client sync bootstrap + write-through + offline flush (Tasks 9–10) · Security (server-only env, CORS — Tasks 1,8) · Testing (Tasks 4–7) · Dev wiring (Task 11) · Docs (Task 12). All Spec 1 sections map to tasks.

**Placeholder scan:** The only intentional illustrative line is the `inPersons` scoping note in Task 5, explicitly explained (single-user → broad select is correct now; multi-user filter noted). No `TBD`/`add error handling`/`write tests for the above` left.

**Type consistency:** `LogEntry` field names match `src/types`; `api.*` method names in Task 9 match the calls in Task 10; route paths in Tasks 5–8 match the client in Task 9 (`/logs`, `/logs/:id/confirm`, `/logs/batch`, `/doctor-notes`, `/medications/:id/adherence`, `/prefs`, `/achievements`, `/agent/chat`). Note: Task 9 references `api.addDoctorVisit` used in Task 10 — **add `addDoctorVisit` to the client in Task 9** (and a `/api/doctor-visits` POST exists in Task 7). Fix applied here as a reminder for the implementer.

## Open items the implementer must confirm
- Local Postgres available (Docker `postgres:16`) before Tasks 2–7.
- `main.tsx` edit (Task 10 Step 2) is UI-agent territory — coordinate or hand off the one-liner.
- Importing `src/...` from `server/` works via tsx (no path alias); if alias issues arise, use relative paths as shown.
