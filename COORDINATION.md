# Khumpai — Technical Core ↔ UI Coordination

This document is the contract between the **technical-core** layer (agent, tools,
business logic, data, store, tests) and the **UI** layer (components, screens, app).
It lists every public interface the core exposes, how to consume it, and what
remains for Phase 2.

> **Status:** Technical core is complete and verified. `npx tsc --noEmit` is green
> project-wide and `npm test` (Vitest) passes **130/130 tests**, including the
> 25+ case guardrail golden set (100% of dangerous messages blocked, 0% false
> positives on normal messages) and the sleep↔glucose insight demo.

---

## 0. Important: a working agent layer already existed — we built ON it, not around it

The UI scaffold already defined an excellent streaming `AgentProvider` interface and
a working `MockAgentProvider`. **That interface is canonical.** The technical core
treated it as the contract and (a) deepened the tool suite, parser, and data behind
it, and (b) kept every symbol the UI already imports working. **No UI file was
modified.** `useChat.ts` continues to work unchanged.

### Dependencies added to `package.json` (please keep)
The core needed validation + a test runner that weren't present. These are additive
and don't affect the UI build:
- `zod` (runtime) — input validation on every mutating tool.
- `vitest`, `@types/node` (dev) — the test suite.
- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

Vitest reads the existing `vite.config.ts` (the `@` alias resolves in tests too) — no
separate config was added. No `vite`/`tailwind`/`tsconfig` config files were touched.

---

## 1. Canonical import paths (what the UI should import)

| What | Import |
| --- | --- |
| Domain types | `import type { LogEntry, AppState, … } from '@/types'` |
| App store (Zustand) | `import { useAppStore } from '@/store/appStore'` |
| Seed data | `import { SEED_STATE, SEED_INSIGHTS } from '@/data/seed'` |
| Agent UI strings | `import { AGENT_ES } from '@/data/i18n/agent-es'` |
| Foods table | `import { PERUVIAN_FOODS, findFood } from '@/data/peruvian-foods'` |
| The agent (singleton) | `import { agent } from '@/agent'` |
| Agent interface types | `import type { AgentEvent, AgentInput, ToolCall } from '@/agent/AgentProvider'` |
| Tool functions | `import { … } from '@/agent/tools'` |
| Business logic | `import { … } from '@/lib/offlineRules' \| '@/lib/precompute' \| …` |

---

## 2. The agent seam (`@/agent`)

```ts
import { agent } from '@/agent';            // active provider (MockAgentProvider today)
agent.sendMessage({ text, history });        // -> AsyncIterable<AgentEvent>
agent.provideToolResult(result);             // -> AsyncIterable<AgentEvent> (resume after a card)
```

`AgentEvent` stream (consumed by `useChat.ts`):
`{ type:'text_start', messageId } | { type:'text_delta', messageId, delta } |
{ type:'text_end', messageId } | { type:'tool_call', call } | { type:'done' }`

`tool_call.call` is a discriminated union on `name`. The UI renders a card when
`call.name === 'registerEntry'` (args: `{ entry, secondaryEntry?, ack }`), lets the
user confirm/edit, persists, then calls `agent.provideToolResult({ callId, name,
ok, savedEntries })` to stream Khumpi's acknowledgement. This human-in-the-loop
confirm/resume flow is the seam that lets the real Azure provider drop in unchanged.

**Swapping to Azure later:** change the one line in `src/agent/index.ts`
(`new MockAgentProvider()` → `new FoundryAgentProvider()`). Nothing else changes.

---

## 3. Domain model (`@/types`)

`LogEntry` is a discriminated union on `type` (`meal | glucose | medication | symptom
| sleep | mood | stress | activity`), each with a typed `payload`. Timestamps are ISO
strings; `timestamp` = when the event happened, `createdAt` = when registered.
Other types: `Medication`, `DoctorNote`, `DoctorVisit`, `Insight`, `Person`,
`UserPrefs`, `EmergencyContact`, `PrecomputedPackage`, `Achievement`, `ChatMessage`,
`OfflineResponse`, `AppState`. See `src/types/index.ts` (fully commented).

---

## 4. Store (`@/store/appStore`)

`useAppStore` is a Zustand store (persisted to `sessionStorage`, key `"khumpai-app"`),
initialized from `SEED_STATE`. State fields mirror `AppState`. Actions live under
`useAppStore.getState().actions` (also usable outside React):

`addLog · confirmLog (idempotent) · editLog · addDoctorNote · logMedicationTaken
(idempotent on date+time) · upsertMedication · addDoctorVisit · setOffline ·
flushSyncQueue (chronological merge) · updatePrefs · addAchievement (idempotent by
id) · enqueueOffline`

---

## 5. Tools (`@/agent/tools`)

All mutating tools validate inputs with Zod and are idempotent where they persist.
Pure tools take data as arguments so they're trivially testable. `TOOL_BUDGET =
{ maxToolCallsPerTurn: 5, maxIterations: 3 }`.

| Tool | Signature (abridged) | Purpose |
| --- | --- | --- |
| `buildDraftEntries(intent, personId)` | → `DraftEntries` | Build **unconfirmed** drafts (never persists) |
| `confirmEntry(entryId)` | → `{ ok, alreadyConfirmed }` | Idempotent persist |
| `queryHistory(logs, { personId?, type?, daysBack? })` | → `LogEntry[]` | Filter history |
| `getSummary(logs, period, medications?, refDate?)` | → summary | Day/week/month aggregation + adherence% |
| `detectPattern(pattern)` | → `Insight \| undefined` | Look up a precomputed insight |
| `runPatternDetection(logs, personId?)` | → `Insight \| null` | **Live** correlation; `null` when data is insufficient (honest) |
| `evaluateRedFlag(description)` | → `{ level, message }` | Symptom classifier (`ok/watch/urgent/emergency`) |
| `evaluateGlucoseRedFlag(value)` | → `{ level, message }` | `<60` emergency, `>300` urgent, `250–300` watch |
| `guardrailRedirect(reason, opts?)` | → `{ message, doctorNote? }` | Warm refusal + builds a doctor question |
| `anticipateRiskFromContext(state)` | → `{ message } \| null` | Gentle pre-spike heads-up ("te sugiero…") |
| `logMedication / upsertMedication` | → store | Adherence + med CRUD |
| `scheduleReminder(input)` | → stub | **Phase 2** (device notifications) |
| `addDoctorNote / getDoctorNotes` | → note(s) | Doctor-note CRUD/filter |
| `generateReport(state)` | → `DoctorReport` | Glucose summary, adherence %, patterns w/ honesty labels, doctor questions, disclaimer |
| `queryRag(query)` | → `{ content, source } \| null` | Retrieval over foods + MINSA/ADA knowledge base; **every** answer carries a `source` |

---

## 6. Business logic (`@/lib`)

- `evaluateOfflineRules(state, now?)` → `OfflineResponse | null` — deterministic, no AI.
  Priority: glucose `<70` (emergency, show emergency contact) → `>250` (urgent, show
  contact) → sleep `<5h` (warning) → medication overdue (info).
- `generatePrecomputedPackage(state, now?)` → `PrecomputedPackage` — greeting, contextual
  check-in, pattern-aware meal guidance, motivation, education snippet, red-flag reminders.
- `syncQueue`: `enqueue` · `flush` (chronological) · `mergeIntoLogs` (sort + dedupe by id).
- `evaluateAchievements(state, now?, { reportGenerated? })` → newly-earned `Achievement[]`,
  idempotent. **Celebration only — contains no streak / missed-day / consecutive-day logic
  by design** (a test asserts this).
- `prefs`: `recordInputMode · recordActiveHour · recordSuggestion · getPreferredSuggestionType`.
- `correlation` / `dateUtils`: explainable sleep↔glucose pairing (no ML); `detectSleepGlucoseCorrelation`
  returns confidence `clear` (≥3 pairs) / `possible` (2) / `null` (<2 — say so honestly).

---

## 7. Suggested UI wiring (quick start)

- **Chat** already works via `useChat()` → `agent`. Render `tool_call` `registerEntry`
  as a confirmation card; on confirm, persist `savedEntries` and call `provideToolResult`.
- **Offline banner / alerts:** call `evaluateOfflineRules(useAppStore.getState())` when
  `isOffline`; if it returns a response, show `message` and (when `showEmergencyContact`)
  surface `state.emergencyContact`.
- **Insights screen:** read `state.insights` (seeded) or call `runPatternDetection(state.logs)`;
  always display the confidence label and the disclaimer.
- **Achievements:** after a log/report, call `evaluateAchievements(state, undefined, { reportGenerated })`
  and `actions.addAchievement(...)` for each new one. Celebrate; never show streaks.
- **Doctor report:** `generateReport(state)` returns a ready-to-render `DoctorReport`.
- **Morning experience / offline cache:** `generatePrecomputedPackage(state)`.

---

## 8. Azure OpenAI ("Foundry") — WIRED (live-tested at the proxy level)

The agent can now run against a real Azure OpenAI deployment behind the SAME
`AgentProvider` seam — **no UI changes**. Architecture:

- **`src/agent/server/foundryProxyPlugin.ts`** — Vite dev-server middleware
  (`POST /api/foundry/chat`, SSE). Holds the API key, builds
  `new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment })` (from the `openai`
  pkg), streams `chat.completions` and relays text deltas + tool calls. **The key never
  reaches the browser bundle.**
- **`src/agent/FoundryAgentProvider.ts`** — browser orchestrator (thin SSE client).
  Runs the 15 tools CLIENT-SIDE via **`src/agent/clientToolRouter.ts`** (they need the
  Zustand store). `registerEntry` pauses for the confirmation card and resumes on
  `provideToolResult`; bounded by `TOOL_BUDGET.maxIterations`.
- **`src/agent/foundryConfig.ts`** — shared `KHUMPI_SYSTEM_PROMPT` (5 safety rules) +
  `FOUNDRY_TOOL_DEFINITIONS` (typed per-entry payload schemas: glucose→`moment`, meal→`context`, …).

### To run against Azure
1. Copy `.env.example` → `.env` (gitignored) and fill: `AZURE_OPENAI_ENDPOINT`,
   `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` (e.g. `gpt-4.1`), optional
   `AZURE_OPENAI_API_VERSION` (default `2024-12-01-preview`).
2. Set `VITE_AGENT_PROVIDER=foundry` (anything else → MockAgentProvider, the default).
3. Restart `npm run dev` — `.env` and the proxy load at server start.

This resource uses **API-key auth** (`*.cognitiveservices.azure.com`) — NO `az login` /
`@azure/identity` needed. `@azure/ai-projects` + `@azure/identity` were installed during
exploration but are now UNUSED (safe to `npm uninstall`).

### Remaining follow-ups
1. **Click-test the in-UI flow:** card confirm → continuation loop (verified at the proxy
   level; the browser-side confirm/resume needs a manual click-through).
2. **Persist guardrail doctor notes:** `guardrailRedirect` *builds* a `DoctorNote` for
   dose/diagnosis/stop refusals; the provider/UI should `actions.addDoctorNote(...)` it.
3. `scheduleReminder` is a stub — integrate real device notifications.
4. `queryRag` uses a hardcoded knowledge base — swap for Azure AI Search (interface already
   returns `{ content, source }`).
5. **Production:** the dev-only Vite proxy must become a real backend/API route (the key
   must stay server-side).
6. **Caregiver mode:** types/store + third-person parsing (`subject: 'father' | 'mother'`)
   exist; the person-switching UI is not built.

---

## 9. Ownership note

The technical core created/owns: `src/types`, `src/data`, `src/store/appStore.ts`,
`src/lib/*`, `src/agent/*` (parser, tools, providers, `server/foundryProxyPlugin.ts`,
`foundryConfig.ts`, `clientToolRouter.ts`), and `tests/*`. **Shared/additive changes**
(heads-up for the UI agent): `package.json` (deps + test scripts), `vite.config.ts`
(added a single `foundryProxyPlugin()` line to `plugins`), `.gitignore` (ignore `.env`),
and `.env.example`. It did **not** modify `src/components`, `src/screens`, `src/app`,
`src/styles`, `index.html`, or the UI stores (`useChatStore`, `useThemeStore`,
`useSessionStore`).
