# Khumpai — Model-driven Diary Builder (Spec 2)

**Date:** 2026-06-12
**Status:** Approved (design sign-off given; build fast)
**Depends on:** Spec 1 (backend + persistence) — done & merged to `main`.
**Verified pre-condition:** the server proxy → `gpt-5.4-mini` already returns correct
`registerEntry` tool calls live (non-strict). Spec 2 hardens that path.

---

## 1. Goal & scope

Replace the **regex parser as the diary *generator*** with **model-driven extraction**:
for a normal logging turn, `gpt-5.4-mini` extracts a structured `LogEntry` draft via a
**strict `registerEntry` tool**; the human confirms via the existing card; on confirm it
persists through Spec 1's API. Done with the good practices: **strict structured output,
cache-friendly prompt, server-built patient context, bounded history.**

**In scope:** entry generation for normal logging turns.
**Out of scope (stay deterministic — future specs):** warm replies/acks wording, the
spike→calm→why→action arc, symptom triage, guardrails/red-flags, offline rules,
caregiver routing, insights, RAG education. `parse.ts` is retained for those gates + offline.

## 2. Decisions

- **Model:** `gpt-5.4-mini` (deployment in `server/.env`). Cheaper, fast, first-class
  strict structured outputs; code is deployment-name-agnostic.
- **Strict tool:** `registerEntry.parameters` becomes a strict JSON schema —
  `entry` is an **`anyOf` of 5 typed variants** (glucose/meal/sleep/medication/symptom),
  every object `additionalProperties:false` with all keys `required` (optionals nullable).
  This guarantees the per-type payload shape (kills the `context`-vs-`moment` bug class).
- **Fallback:** if Azure rejects strict/`anyOf` on this model+API-version (HTTP 400), the
  proxy retries **non-strict** (today's working path) — so we never regress.
- **Where the work lives:** mostly **server-side** (`server/src/http/agent.route.ts` +
  the shared `src/agent/foundryConfig.ts`). The browser orchestrator already relays
  `tool_calls` → card and normalizes the draft.

## 3. Architecture / data flow

```
useChat (unchanged routing): offline → caregiver → spike-arc → triage → guardrail
   └── ELSE (normal logging/chat) → FoundryAgentProvider → POST /api/agent/chat
         server assembles messages:                                  (Azure gpt-5.4-mini)
           [ system prompt + strict tools + few-shots ]  ← STABLE, cacheable prefix (≥1024 tok)
           [ patient-context block (built from DB) + current datetime ]  ← dynamic
           [ last ~6 chat turns + the user message ]                     ← dynamic
         model → registerEntry (strict) → SSE tool_calls → card → confirm → API persist
```

- **Cache-friendly:** the stable prefix is byte-identical every turn → hits Azure
  automatic prompt cache (cached input ~$0.08/1M). All dynamic content goes **after** it.
- **Server-built context:** the patient-context block (today, current person, last 1–2
  glucose readings, med schedule) is built from Postgres in the route — keeps the client
  thin and the prefix stable.
- **History window:** client sends only the last ~6 turns (not the full transcript).

## 4. The strict `registerEntry` schema (the crux)

`entry` = `anyOf` of five objects, each `{ type (const enum), timestamp, payload }` with a
type-specific strict `payload`:
- glucose: `{ value:number, moment: enum }`
- meal: `{ description:string, context: "casa"|"fuera" }`
- sleep: `{ hours:number }`
- medication: `{ name:string, taken:boolean }`
- symptom: `{ description:string }`

`secondaryEntry`: `anyOf[ …same variants…, {type:"null"} ]` (nullable, required under strict).
`ack`: `string`. Root + every object: `additionalProperties:false`, all keys in `required`.
(Full JSON in the implementation plan.)

## 5. Testing

- **Server unit:** message-assembly test — the cacheable prefix is byte-stable across two
  different user inputs; the patient-context block + datetime appear only in the suffix.
- **Schema unit:** `FOUNDRY_TOOL_DEFINITIONS.registerEntry` is strict-well-formed
  (`strict:true`, `additionalProperties:false`, `required` lists complete, 5 variants).
- **Client unit:** `FoundryAgentProvider` normalizes each typed `entry` variant into a
  complete `LogEntry` (fills id/personId/source/confirmed/createdAt).
- **Keep green:** front-end 155, server 9.
- **Manual (needs key):** live curl + browser chat→card→confirm→reload-survives.

## 6. Risks

- **Strict/`anyOf` API-version support** on `gpt-5.4-mini` — mitigated by the non-strict
  fallback (already proven working today).
- **Timestamp for relative phrases** ("esta mañana") — the live test stamped "now";
  the few-shots + an explicit datetime+rule in the suffix steer it. Client may also clamp
  obviously-wrong years to "now".

## 7. Non-goals (explicit)

Model-driven replies, arc, triage, guardrails, insights, RAG, offline — all remain
deterministic. This spec is **step 1** of incremental mock removal.
