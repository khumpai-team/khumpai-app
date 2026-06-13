# Model-driven Diary Builder — Implementation Plan

> **For agentic workers:** implement task-by-task (TDD). Steps use `- [ ]`.

**Goal:** Make the diary generator model-driven via a STRICT `registerEntry` tool on `gpt-5.4-mini`, with a cache-friendly prompt and server-built patient context, keeping all safety/arc/offline deterministic.

**Architecture:** Shared `src/agent/foundryConfig.ts` holds the strict tool schema + few-shots (stable, cacheable prefix). `server/src/http/agent.route.ts` assembles messages (stable system prefix → dynamic context+datetime → bounded history), calls Azure with strict tools, and falls back to non-strict on HTTP 400. The browser `FoundryAgentProvider` already relays `tool_calls`→card and normalizes the draft.

**Tech:** Azure `gpt-5.4-mini`, openai SDK strict function tools, Vitest.

---

## Task 1 — Strict `registerEntry` schema + few-shots (foundryConfig)

**Files:** Modify `src/agent/foundryConfig.ts`; Test `tests/foundryConfig.test.ts`.

- [ ] **Step 1: Replace the `registerEntry` tool definition** with a strict `anyOf`-per-type schema, built DRY:

```ts
const entryVariant = (
  type: string,
  payloadProps: Record<string, unknown>,
  payloadRequired: string[],
) => ({
  type: 'object',
  additionalProperties: false,
  required: ['type', 'timestamp', 'payload'],
  properties: {
    type: { type: 'string', enum: [type] },
    timestamp: {
      type: 'string',
      description: 'ISO 8601 of when it happened. Use the datetime in "Contexto actual"; compute "esta mañana/ayer/anoche" from it — never invent a year.',
    },
    payload: { type: 'object', additionalProperties: false, required: payloadRequired, properties: payloadProps },
  },
});

const ENTRY_VARIANTS = [
  entryVariant('glucose',
    { value: { type: 'number', description: 'mg/dL' },
      moment: { type: 'string', enum: ['ayunas', 'post-desayuno', 'post-almuerzo', 'post-cena'] } },
    ['value', 'moment']),
  entryVariant('meal',
    { description: { type: 'string' }, context: { type: 'string', enum: ['casa', 'fuera'] } },
    ['description', 'context']),
  entryVariant('sleep', { hours: { type: 'number' } }, ['hours']),
  entryVariant('medication', { name: { type: 'string' }, taken: { type: 'boolean' } }, ['name', 'taken']),
  entryVariant('symptom', { description: { type: 'string' } }, ['description']),
];

// Inside FOUNDRY_TOOL_DEFINITIONS, replace the registerEntry object with:
const REGISTER_ENTRY_TOOL = {
  type: 'function',
  function: {
    name: 'registerEntry',
    strict: true,
    description:
      'Extract a health log entry (glucose, meal, sleep, medication, or symptom) from the patient message, for the user to confirm before it is saved.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['entry', 'secondaryEntry', 'ack'],
      properties: {
        entry: { anyOf: ENTRY_VARIANTS },
        secondaryEntry: { anyOf: [...ENTRY_VARIANTS, { type: 'null' }] },
        ack: { type: 'string', description: 'Warm Peruvian-Spanish acknowledgement shown after the user confirms.' },
      },
    },
  },
} as const;
```
Keep the other 14 tools unchanged (non-strict is fine; only `registerEntry` is the diary generator). Export a `STRICT_TOOLS` boolean helper if useful.

- [ ] **Step 2: Add a stable few-shot block** appended to `KHUMPI_SYSTEM_PROMPT` (NOT a separate message — keeps the prefix one byte-stable system message). Append:

```ts
export const DIARY_FEWSHOTS = `
## Ejemplos de extracción (registerEntry)
- "cené arroz con pollo y me salió 160" → entry meal {description:"arroz con pollo", context:"casa"}, secondaryEntry glucose {value:160, moment:"post-cena"}.
- "ayer en ayunas me salió 130" → entry glucose {value:130, moment:"ayunas"}, timestamp = ayer (desde Contexto actual).
- "dormí 5 horas" → entry sleep {hours:5}.
- "ya tomé mi metformina" → entry medication {name:"Metformina", taken:true}.
`.trim();
```

- [ ] **Step 3: Test `tests/foundryConfig.test.ts`** — structural strict-compliance:

```ts
import { describe, it, expect } from 'vitest';
import { FOUNDRY_TOOL_DEFINITIONS } from '@/agent/foundryConfig';

describe('registerEntry strict schema', () => {
  const t = FOUNDRY_TOOL_DEFINITIONS.find((d) => d.function.name === 'registerEntry')!;
  it('is strict', () => expect((t.function as { strict?: boolean }).strict).toBe(true));
  it('has 5 entry variants', () => {
    const variants = (t.function.parameters as any).properties.entry.anyOf;
    expect(variants).toHaveLength(5);
  });
  it('every object disallows additionalProperties and requires all keys', () => {
    const walk = (s: any): void => {
      if (s && s.type === 'object') {
        expect(s.additionalProperties).toBe(false);
        expect(new Set(s.required)).toEqual(new Set(Object.keys(s.properties)));
        Object.values(s.properties).forEach(walk);
      }
      (s?.anyOf ?? []).forEach(walk);
    };
    walk((t.function.parameters as any).properties.entry);
  });
});
```

- [ ] **Step 4:** `npx tsc --noEmit` (0 errors) + `npx vitest run tests/foundryConfig.test.ts` (PASS). Commit:
```bash
git add src/agent/foundryConfig.ts tests/foundryConfig.test.ts
git commit -m "feat(agent): strict anyOf registerEntry schema + diary few-shots"
```

## Task 2 — Cache-friendly message assembly + patient context (server)

**Files:** Modify `server/src/http/agent.route.ts`; Create `server/src/http/buildMessages.ts`; Test `server/test/buildMessages.test.ts`.

- [ ] **Step 1: Create the pure assembler `server/src/http/buildMessages.ts`:**

```ts
import { KHUMPI_SYSTEM_PROMPT, DIARY_FEWSHOTS } from '../../../src/agent/foundryConfig';

export interface ChatMsg { role: string; content: string | null }

/** STABLE prefix (cacheable): system prompt + few-shots, byte-identical every turn. */
export const SYSTEM_PREFIX: ChatMsg = {
  role: 'system',
  content: `${KHUMPI_SYSTEM_PROMPT}\n\n${DIARY_FEWSHOTS}`,
};

/** Assemble: stable prefix → dynamic context (datetime + patient) → bounded history. */
export function buildAgentMessages(opts: {
  history: ChatMsg[];
  patientContext: string;
  nowIso: string;
  windowTurns?: number;
}): ChatMsg[] {
  const { history, patientContext, nowIso, windowTurns = 6 } = opts;
  const context: ChatMsg = {
    role: 'system',
    content: `## Contexto actual\nFecha y hora: ${nowIso}\n${patientContext}`,
  };
  const recent = history.slice(-windowTurns);
  return [SYSTEM_PREFIX, context, ...recent];
}
```

- [ ] **Step 2: Test `server/test/buildMessages.test.ts`** — the cacheable prefix is byte-stable; dynamic content is isolated:

```ts
import { describe, it, expect } from 'vitest';
import { buildAgentMessages, SYSTEM_PREFIX } from '../src/http/buildMessages.js';

describe('buildAgentMessages', () => {
  it('keeps a byte-identical system prefix across different inputs', () => {
    const a = buildAgentMessages({ history: [{ role: 'user', content: 'hola' }], patientContext: 'X', nowIso: '2026-06-12T10:00:00Z' });
    const b = buildAgentMessages({ history: [{ role: 'user', content: 'otra cosa' }], patientContext: 'Y', nowIso: '2026-06-13T11:00:00Z' });
    expect(a[0]).toEqual(SYSTEM_PREFIX);
    expect(b[0]).toEqual(SYSTEM_PREFIX);
    expect(a[0].content).toBe(b[0].content);
  });
  it('puts datetime + patient context in the second (dynamic) message only', () => {
    const m = buildAgentMessages({ history: [], patientContext: 'última azúcar 130', nowIso: '2026-06-12T10:00:00Z' });
    expect(m[1].content).toContain('2026-06-12');
    expect(m[1].content).toContain('última azúcar 130');
    expect(SYSTEM_PREFIX.content).not.toContain('2026-06-12');
  });
  it('bounds the history window', () => {
    const hist = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    const m = buildAgentMessages({ history: hist, patientContext: '', nowIso: 'now', windowTurns: 6 });
    expect(m.length).toBe(2 + 6);
  });
});
```

- [ ] **Step 3: Run → fail, then implement the route changes** in `agent.route.ts`:
  - Add `buildPatientContext()` — query the DB for a compact block (current person name, today's date, last 1–2 glucose readings, med name + schedule). Return a short Spanish string.
  - Replace the inline message building with: `const messages = buildAgentMessages({ history: req.body?.messages ?? [], patientContext: await buildPatientContext(), nowIso: new Date().toISOString() });`
  - **Remove** the old `nowCtx` appended to the system message (datetime now lives in the dynamic context message → keeps the prefix cacheable).
  - Pass `tools: FOUNDRY_TOOL_DEFINITIONS` (registerEntry now strict).
  - **Strict fallback:** wrap `client.chat.completions.create(...)` in try/catch; on an error whose status is 400 (or message mentions `schema`/`strict`/`response_format`), retry once with a non-strict copy of the tools (`tools.map(t => t.function.name==='registerEntry' ? {...t, function:{...t.function, strict:false}} : t)`). Log which path was used.

- [ ] **Step 4:** `cd server && npx vitest run` (all green incl. new) + `npx tsc --noEmit`. Commit:
```bash
git add server/src/http/buildMessages.ts server/test/buildMessages.test.ts server/src/http/agent.route.ts
git commit -m "feat(server): cache-friendly prompt assembly + patient context + strict fallback"
```

## Task 3 — Client normalization of typed variants

**Files:** Modify `src/agent/FoundryAgentProvider.ts` (only if needed); Test via existing integration.

- [ ] **Step 1:** Verify `normaliseEntry` handles the `anyOf` variant `entry` shape. The model now emits `entry = { type, timestamp, payload }` (a single variant) — which is exactly what `normaliseEntry` already consumes (it spreads `entry` and fills `id/personId/source/confirmed/isOfflineCapture/createdAt`). Confirm no change needed; if the variant omits a base field, ensure the fill still produces a valid `LogEntry`.
- [ ] **Step 2:** Optional safety clamp: if the model's `timestamp` year differs from the current year, set it to `now` (guards the "esta mañana → now" drift).
- [ ] **Step 3:** `npx tsc --noEmit` + `npx vitest run` (front-end 155 green). Commit if changed:
```bash
git add src/agent/FoundryAgentProvider.ts
git commit -m "feat(agent): normalize strict typed-variant entries (+ timestamp clamp)"
```

## Task 4 — Verify end-to-end (manual, needs Azure key)

- [ ] Start Postgres + server + front-end. With `VITE_AGENT_PROVIDER=foundry`, send:
  - "cené arroz con pollo y me salió 160" → expect a `registerEntry` card with meal + secondary glucose, correct `context`/`moment`.
  - "ayer en ayunas me salió 130" → glucose, moment ayunas, timestamp = yesterday.
  - Confirm the card → reload the page → the entry **persists** (Spec 1 round-trip).
- [ ] Curl check the strict path didn't 400 (server logs show "strict" not "fallback"). If it fell back, bump `AZURE_OPENAI_API_VERSION` and re-test.

---

## Self-Review
- **Spec coverage:** strict tool (Task 1) · cache-friendly prefix + context + window (Task 2) · fallback (Task 2 Step 3) · client normalize (Task 3) · manual e2e (Task 4). All §-items mapped.
- **Type consistency:** `DIARY_FEWSHOTS`/`KHUMPI_SYSTEM_PROMPT` exported from foundryConfig and imported by `buildMessages.ts`; `buildAgentMessages`/`SYSTEM_PREFIX` names match across route + test.
- **No placeholders:** all code shown; the one DB-query body (`buildPatientContext`) is specified by its inputs/outputs (compact Spanish context string) — implementer writes the Drizzle selects against the Spec 1 schema.
