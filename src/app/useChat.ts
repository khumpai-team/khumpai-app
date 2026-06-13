/**
 * useChat — orchestrates a turn between the UI, the AgentProvider, and the
 * stores. This is the ONLY place that consumes the agent's event stream, so the
 * screens stay declarative. It also drives the scripted "arc" branches (spike →
 * calm → why → action) and triage, which are product flows rather than plain
 * model replies — keeping the MockAgentProvider focused on parsing/logging.
 */

import { useCallback, useRef } from 'react';
import { agent } from '@/agent';
import type { AgentEvent, AgentInput, RegisterEntryArgs } from '@/agent/AgentProvider';
import { parseMessage, type ParsedIntent } from '@/agent/parse';
import {
  anticipateRiskFromContext,
  buildDraftEntries,
  detectPattern,
  evaluateRedFlag,
  guardrailRedirect,
  type DraftEntries,
} from '@/agent/tools';
import { recordSuggestion } from '@/lib/prefs';
import { readAttachment } from '@/lib/image';
import { evaluateOfflineRules } from '@/lib/offlineRules';
import { evaluateAchievements } from '@/lib/achievements';
import { uid } from '@/lib/id';
import { es } from '@/data/i18n/es';
import { AGENT_ES } from '@/data/i18n/agent-es';
import type { GlucoseMoment, LogEntry, MoodScore, Person, RedFlagLevel, StressLevel } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';

const DATA_KINDS = ['meal', 'glucose', 'sleep', 'medication', 'symptom'] as const;
type DataIntent = Extract<ParsedIntent, { kind: (typeof DATA_KINDS)[number] }>;
const isDataIntent = (i: ParsedIntent): i is DataIntent =>
  (DATA_KINDS as readonly string[]).includes(i.kind);

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Range-aware glucose acknowledgement. */
function glucoseMsg(v: number): string {
  if (v < 70) return AGENT_ES.glucose.low(v);
  if (v < 180) return AGENT_ES.glucose.ok(v);
  if (v < 250) return AGENT_ES.glucose.high(v);
  return AGENT_ES.glucose.veryHigh(v);
}

/** Warm acknowledgement for a confirmed draft (local, no agent). */
function localAck(draft: DraftEntries): string {
  const e = draft.primary;
  switch (e.type) {
    case 'glucose':
      return glucoseMsg(e.payload.value);
    case 'meal':
      return draft.secondary?.type === 'glucose'
        ? glucoseMsg(draft.secondary.payload.value)
        : AGENT_ES.confirmations.savedMeal;
    case 'sleep':
      return e.payload.hours < 6 ? AGENT_ES.offline.sleepShort(e.payload.hours) : AGENT_ES.confirmations.savedSleep;
    case 'medication':
      return AGENT_ES.confirmations.savedMedication;
    case 'symptom':
      return evaluateRedFlag(e.payload.description).message;
    default:
      return AGENT_ES.confirmations.saved;
  }
}

/** Resolve which patient a caregiver entry is for (by name, relation, or default). */
function resolveTargetPerson(intent: DataIntent, text: string, persons: Person[]): Person | undefined {
  const words = new Set(norm(text).split(/[^a-zñ0-9]+/).filter(Boolean));
  for (const p of persons) {
    const first = norm(p.name).split(/\s+/)[0];
    if (first.length >= 3 && words.has(first)) return p; // whole-word match only
  }
  if (intent.subject === 'father') {
    const p = persons.find((x) => x.relation === 'father');
    if (p) return p;
  }
  if (intent.subject === 'mother') {
    const p = persons.find((x) => x.relation === 'mother');
    if (p) return p;
  }
  return persons.length === 1 ? persons[0] : undefined;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useChat() {
  const items = useChatStore((s) => s.items);
  const thinking = useChatStore((s) => s.thinking);
  const calm = useChatStore((s) => s.calm);

  // Caregiver flow: a pending entry awaiting a person pick, and per-card acks
  // for cards we build locally (so confirm streams the right reply).
  const pendingPickRef = useRef<{ intent: DataIntent } | null>(null);
  const localAckRef = useRef<Map<string, string>>(new Map());

  const drive = useCallback(async (stream: AsyncIterable<AgentEvent>) => {
    const chat = useChatStore.getState();
    for await (const ev of stream) {
      switch (ev.type) {
        case 'text_start':
          chat.setThinking(false);
          chat.addMessage({ id: ev.messageId, kind: 'message', role: 'khumpi', text: '', streaming: true });
          break;
        case 'text_delta':
          chat.appendDelta(ev.messageId, ev.delta);
          break;
        case 'text_end':
          chat.endMessage(ev.messageId);
          break;
        case 'tool_call':
          chat.setThinking(false);
          if (ev.call.name === 'registerEntry') {
            chat.addCard({ id: ev.call.id, kind: 'card', args: ev.call.args, state: 'pending' });
          }
          break;
        case 'done':
          chat.setThinking(false);
          break;
      }
    }
  }, []);

  /** Stream a Khumpi message locally (for scripted arc/triage dialogue). */
  const streamSay = useCallback(async (text: string, wordMs = 30) => {
    const chat = useChatStore.getState();
    const id = uid('msg');
    chat.setThinking(false);
    chat.addMessage({ id, kind: 'message', role: 'khumpi', text: '', streaming: true });
    for (const w of text.split(/(\s+)/)) {
      chat.appendDelta(id, w);
      if (w.trim()) await sleep(wordMs);
    }
    chat.endMessage(id);
  }, []);

  /** Evaluate milestone achievements and celebrate any newly unlocked ones. */
  const celebrate = useCallback(async () => {
    const app = useAppStore.getState();
    const fresh = evaluateAchievements(app);
    fresh.forEach((a) => app.actions.addAchievement(a));
    for (const a of fresh) {
      await sleep(400);
      await streamSay(es.achievements.unlocked(a.title, a.description));
    }
  }, [streamSay]);

  // --- The emotional arc: spike → calm → why → one action ----------------

  const showAction = useCallback(async () => {
    const app = useAppStore.getState();
    const chat = useChatStore.getState();
    const prefs = app.prefs;
    // Personalize: if the user has net-rejected activity nudges, lean food.
    const accAct = prefs.acceptedSuggestionTypes['activity_suggestion'] ?? 0;
    const rejAct = prefs.rejectedSuggestionTypes['activity_suggestion'] ?? 0;
    const preferFood = rejAct - accAct > 0;
    const suggestionType = preferFood ? 'food_suggestion' : 'activity_suggestion';

    chat.setThinking(true);
    await sleep(550);
    chat.setThinking(false);
    chat.addItem({
      id: uid('act'),
      kind: 'action',
      suggestionType,
      text: preferFood ? es.arc.actionFood : es.arc.actionActivity,
      acceptLabel: preferFood ? es.arc.acceptFood : es.arc.acceptActivity,
      state: 'pending',
    });
  }, []);

  const showWhy = useCallback(async () => {
    const chat = useChatStore.getState();
    chat.setThinking(true);
    await sleep(650);
    const insight = detectPattern('sleep_glucose');
    chat.setThinking(false);
    if (insight) chat.addItem({ id: uid('ins'), kind: 'insight', insight });
    await sleep(800);
    await showAction();
  }, [showAction]);

  const runSpikeArc = useCallback(
    async (value: number, moment: GlucoseMoment) => {
      const app = useAppStore.getState();
      const chat = useChatStore.getState();
      const at = new Date().toISOString();

      // Log the high reading immediately (no confirmation card in this branch).
      app.actions.addLog({
        id: uid('log'),
        personId: app.currentPersonId,
        timestamp: at,
        createdAt: at,
        source: 'conversation',
        confirmed: true,
        isOfflineCapture: false,
        type: 'glucose',
        payload: { value, moment },
      });

      chat.setCalm(true);
      chat.setThinking(true);
      await sleep(750);
      await streamSay(es.arc.calm(app.user.name), 44); // slower, calmer pacing
      await sleep(150);
      chat.addItem({
        id: uid('choice'),
        kind: 'choice',
        options: [
          { label: es.arc.chipWhy, value: 'why' },
          { label: es.arc.chipWhat, value: 'what' },
        ],
      });
    },
    [streamSay],
  );

  const closeArc = useCallback(async () => {
    const app = useAppStore.getState();
    await sleep(450);
    await streamSay(es.arc.close);
    app.actions.addDoctorNote({
      id: uid('dn'),
      personId: app.currentPersonId,
      text: es.arc.doctorNote,
      timestamp: new Date().toISOString(),
      source: 'pattern',
      forQuestion: false,
    });
    useChatStore.getState().setCalm(false);
  }, [streamSay]);

  const answerArcChoice = useCallback(
    async (choiceId: string, value: string) => {
      const chat = useChatStore.getState();
      chat.answerChoice(choiceId);
      chat.addMessage({
        id: uid('msg'),
        kind: 'message',
        role: 'user',
        text: value === 'why' ? es.arc.chipWhy : es.arc.chipWhat,
      });
      if (value === 'why') await showWhy();
      else await showAction();
    },
    [showWhy, showAction],
  );

  const resolveAction = useCallback(
    async (actionId: string, suggestionType: string, accepted: boolean) => {
      const app = useAppStore.getState();
      const chat = useChatStore.getState();
      app.actions.updatePrefs(recordSuggestion(app.prefs, suggestionType, accepted));
      chat.setActionState(actionId, accepted ? 'accepted' : 'declined');
      if (accepted && suggestionType === 'food_suggestion') {
        await sleep(500);
        await streamSay(es.arc.foodIdea);
      }
      await closeArc();
    },
    [streamSay, closeArc],
  );

  // --- Triage: red-flag symptom → SafetyCard -----------------------------

  const runSafety = useCallback(
    async (level: RedFlagLevel, description: string, message: string) => {
      const app = useAppStore.getState();
      const chat = useChatStore.getState();
      const at = new Date().toISOString();

      app.actions.addLog({
        id: uid('log'),
        personId: app.currentPersonId,
        timestamp: at,
        createdAt: at,
        source: 'conversation',
        confirmed: true,
        isOfflineCapture: false,
        type: 'symptom',
        payload: { description, redFlag: true, level },
      });
      // A priority note for the doctor.
      app.actions.addDoctorNote({
        id: uid('dn'),
        personId: app.currentPersonId,
        text: `⚠️ ${description}`,
        timestamp: at,
        source: 'khumpi',
        forQuestion: false,
      });

      chat.setThinking(true);
      await sleep(650);
      chat.setThinking(false);
      chat.addItem({ id: uid('safety'), kind: 'safety', level, description, message });
    },
    [],
  );

  // --- Morning check-in + anticipation -----------------------------------

  const runAnticipation = useCallback(async () => {
    const res = anticipateRiskFromContext(useAppStore.getState());
    if (res) {
      await sleep(700);
      await streamSay(res.message);
    }
  }, [streamSay]);

  const saveCheckin = useCallback(
    async (sleepHours: number, mood: MoodScore, stress: StressLevel) => {
      const app = useAppStore.getState();
      const at = new Date().toISOString();
      const base = {
        personId: app.currentPersonId,
        timestamp: at,
        createdAt: at,
        source: 'quick_action' as const,
        confirmed: true,
        isOfflineCapture: false,
      };
      app.actions.addLog({ id: uid('log'), ...base, type: 'sleep', payload: { hours: sleepHours } });
      app.actions.addLog({ id: uid('log'), ...base, type: 'mood', payload: { score: mood } });
      app.actions.addLog({ id: uid('log'), ...base, type: 'stress', payload: { level: stress } });
      await sleep(300);
      await streamSay(es.checkin.thanks);
      await runAnticipation();
      await celebrate();
    },
    [streamSay, runAnticipation, celebrate],
  );

  // --- Caregiver: register an entry for a chosen patient -----------------

  // Build a confirmation card locally (no agent) and remember its ack so
  // confirm streams the right reply. Shared by caregiver logging + attachments.
  const presentLocalCard = useCallback((draft: DraftEntries) => {
    const ack = localAck(draft);
    const callId = uid('call');
    localAckRef.current.set(callId, ack);
    const args: RegisterEntryArgs = { entry: draft.primary, secondaryEntry: draft.secondary, ack };
    const chat = useChatStore.getState();
    chat.setThinking(false);
    chat.addCard({ id: callId, kind: 'card', args, state: 'pending' });
  }, []);

  const registerForPerson = useCallback(
    (intent: DataIntent, person: Person) => presentLocalCard(buildDraftEntries(intent, person.id)),
    [presentLocalCard],
  );

  const pickPerson = useCallback(
    async (itemId: string, person: { id: string; name: string; color: string }) => {
      const pending = pendingPickRef.current;
      pendingPickRef.current = null;
      const chat = useChatStore.getState();
      chat.answerPersonPick(itemId, person.name);
      if (!pending) return;
      const full = useAppStore.getState().persons.find((p) => p.id === person.id);
      if (!full) return;
      chat.setThinking(true);
      await sleep(450);
      chat.setThinking(false);
      registerForPerson(pending.intent, full);
    },
    [registerForPerson],
  );

  // --- Attachments: photo (mock OCR / vision) + files --------------------

  const sendAttachment = useCallback(
    async (file: File) => {
      const chat = useChatStore.getState();
      const app = useAppStore.getState();
      const { url, isImage, name } = await readAttachment(file);

      if (!isImage) {
        chat.addMessage({ id: uid('msg'), kind: 'message', role: 'user', text: `📎 ${name}` });
        chat.setThinking(true);
        await sleep(700);
        await streamSay(es.chat.attachFile(name));
        return;
      }

      chat.addMessage({ id: uid('msg'), kind: 'message', role: 'user', text: '', imageUrl: url ?? undefined });
      chat.setThinking(true);
      await sleep(1200); // "reading" the photo

      // Mock OCR / vision. Deterministic & demo-controllable: the file name
      // steers it (e.g. "comida.jpg" → meal), defaulting to a glucose reading.
      const isMeal = /(comida|food|plato|almuerzo|desayuno|cena|meal)/.test(norm(name));
      if (isMeal) {
        await streamSay(es.chat.attachMealReading);
        presentLocalCard(
          buildDraftEntries({ kind: 'meal', context: 'casa', description: es.chat.attachMealDesc }, app.currentPersonId),
        );
        return;
      }
      const value = 95 + Math.floor(Math.random() * 110);
      const moment: GlucoseMoment = new Date().getHours() < 11 ? 'ayunas' : 'post-almuerzo';
      await streamSay(es.chat.attachImageReading(value));
      presentLocalCard(buildDraftEntries({ kind: 'glucose', value, moment }, app.currentPersonId));
    },
    [streamSay, presentLocalCard],
  );

  // --- Main entry --------------------------------------------------------

  const sendUserMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const chat = useChatStore.getState();
      const app = useAppStore.getState();
      const offline = app.isOffline;

      chat.setCalm(false);
      chat.addMessage({ id: uid('msg'), kind: 'message', role: 'user', text: trimmed, pending: offline });

      const intent = parseMessage(trimmed);

      // Offline: queue the entry for later sync and reply from deterministic
      // local rules, evaluated as if the just-spoken entries were already logged
      // (they're queued, not yet in `logs`).
      if (offline) {
        const drafts: LogEntry[] = [];
        if (isDataIntent(intent)) {
          const draft = buildDraftEntries(intent, app.currentPersonId);
          drafts.push(draft.primary);
          if (draft.secondary) drafts.push(draft.secondary);
          drafts.forEach((d) => app.actions.enqueueOffline(d));
        }
        chat.setThinking(true);
        await sleep(550);
        const snapshot = { ...app, logs: [...app.logs, ...drafts] };
        const rule = evaluateOfflineRules(snapshot);
        await streamSay(rule?.message ?? AGENT_ES.offline.noConnection);
        if (rule?.showEmergencyContact && app.emergencyContact) {
          await sleep(200);
          await streamSay(
            es.offline.emergencyLine(app.emergencyContact.name, app.emergencyContact.phone),
          );
        }
        return;
      }

      // Caregiver front: route diary entries to a patient. Resolve by name or
      // relation; if it's ambiguous, ask with a clickable person picker.
      if (app.mode === 'caregiver' && isDataIntent(intent)) {
        const target = resolveTargetPerson(intent, trimmed, app.persons);
        if (!target) {
          pendingPickRef.current = { intent };
          chat.setThinking(true);
          await streamSay(es.caregiver.whichPerson);
          chat.addItem({
            id: uid('pick'),
            kind: 'personPick',
            options: app.persons.map((p) => ({ id: p.id, name: p.name, color: p.color })),
          });
          return;
        }
        chat.setThinking(true);
        await sleep(500);
        chat.setThinking(false);
        registerForPerson(intent, target);
        return;
      }

      // Spike arc: a high reading opens the calm → why → action flow.
      if (intent.kind === 'glucose' && intent.value > 180) {
        await runSpikeArc(intent.value, intent.moment);
        return;
      }

      // Triage: an urgent/emergency symptom opens the SafetyCard.
      if (intent.kind === 'symptom') {
        let { level, message } = evaluateRedFlag(intent.description);
        // Safety net: a wound that won't close/heal is urgent even when phrased
        // loosely (e.g. "una herida en el pie que no cierra"). Err toward help.
        const woundNotHealing =
          /herida|llaga|[uú]lcera/i.test(intent.description) &&
          /no\s+(cierra|sana|cicatriz|mejora)/i.test(intent.description);
        if (woundNotHealing && level !== 'emergency') {
          level = 'urgent';
          message = AGENT_ES.redFlags.urgent(intent.description);
        }
        if (level === 'urgent' || level === 'emergency') {
          await runSafety(level, intent.description, message);
          return;
        }
      }

      chat.setThinking(true);

      // Guardrails: refuse dose/diagnosis safely and leave a doctor question.
      // Also catch dose questions the parser missed (e.g. "doble metformina").
      const doseSafetyNet =
        intent.kind === 'unknown' &&
        /(doble|m[aá]s|otra|aument|subir|baj|cambi|cu[aá]nt|puedo|debo)/i.test(trimmed) &&
        /(metformina|pastilla|dosis|insulina|medic)/i.test(trimmed);
      if (intent.kind === 'guardrail' || doseSafetyNet) {
        const reason = intent.kind === 'guardrail' ? intent.reason : 'dose';
        await sleep(500);
        const { message, doctorNote } = guardrailRedirect(reason, app.currentPersonId);
        if (doctorNote) app.actions.addDoctorNote(doctorNote);
        await streamSay(message);
        return;
      }

      const history: AgentInput['history'] = useChatStore
        .getState()
        .items.filter((it): it is Extract<typeof it, { kind: 'message' }> => it.kind === 'message')
        .map((m) => ({ role: m.role, text: m.text }));

      await drive(agent.sendMessage({ text: trimmed, history }));
    },
    [drive, runSpikeArc, runSafety, registerForPerson, streamSay],
  );

  const confirmCard = useCallback(
    async (callId: string, savedEntries: LogEntry[]) => {
      const chat = useChatStore.getState();
      const { actions } = useAppStore.getState();
      savedEntries.forEach((e) => actions.addLog({ ...e, confirmed: true }));
      chat.setCardState(callId, 'saved');
      chat.setThinking(true);
      // Locally-built (caregiver) cards stream their stored ack; agent cards resume.
      const localText = localAckRef.current.get(callId);
      if (localText) {
        localAckRef.current.delete(callId);
        await sleep(280);
        await streamSay(localText);
        chat.setThinking(false);
        await celebrate();
        return;
      }
      await drive(agent.provideToolResult({ callId, name: 'registerEntry', ok: true, savedEntries }));
      await celebrate();
    },
    [drive, streamSay, celebrate],
  );

  const dismissCard = useCallback(
    async (callId: string) => {
      const chat = useChatStore.getState();
      chat.setCardState(callId, 'dismissed');
      if (localAckRef.current.has(callId)) {
        localAckRef.current.delete(callId);
        chat.setThinking(true);
        await streamSay('Sin problema, lo dejamos así. 🙂');
        chat.setThinking(false);
        return;
      }
      chat.setThinking(true);
      await drive(agent.provideToolResult({ callId, name: 'registerEntry', ok: false }));
    },
    [drive, streamSay],
  );

  return {
    items,
    thinking,
    calm,
    sendUserMessage,
    confirmCard,
    dismissCard,
    answerArcChoice,
    resolveAction,
    saveCheckin,
    pickPerson,
    sendAttachment,
  };
}
