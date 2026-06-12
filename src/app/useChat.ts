/**
 * useChat — orchestrates a turn between the UI, the AgentProvider, and the
 * stores. This is the ONLY place that consumes the agent's event stream, so the
 * screens stay declarative. It also drives the scripted "arc" branches (spike →
 * calm → why → action) and triage, which are product flows rather than plain
 * model replies — keeping the MockAgentProvider focused on parsing/logging.
 */

import { useCallback } from 'react';
import { agent } from '@/agent';
import type { AgentEvent, AgentInput } from '@/agent/AgentProvider';
import { parseMessage } from '@/agent/parse';
import { detectPattern, evaluateRedFlag, guardrailRedirect } from '@/agent/tools';
import { recordSuggestion } from '@/lib/prefs';
import { uid } from '@/lib/id';
import { es } from '@/data/i18n/es';
import type { GlucoseMoment, LogEntry, RedFlagLevel } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useChat() {
  const items = useChatStore((s) => s.items);
  const thinking = useChatStore((s) => s.thinking);
  const calm = useChatStore((s) => s.calm);

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

  // --- Main entry --------------------------------------------------------

  const sendUserMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const chat = useChatStore.getState();
      const app = useAppStore.getState();

      chat.setCalm(false);
      chat.addMessage({ id: uid('msg'), kind: 'message', role: 'user', text: trimmed });

      const intent = parseMessage(trimmed);

      // Spike arc: a high reading opens the calm → why → action flow.
      if (intent.kind === 'glucose' && intent.value > 180) {
        await runSpikeArc(intent.value, intent.moment);
        return;
      }

      // Triage: an urgent/emergency symptom opens the SafetyCard.
      if (intent.kind === 'symptom') {
        const { level, message } = evaluateRedFlag(intent.description);
        if (level === 'urgent' || level === 'emergency') {
          await runSafety(level, intent.description, message);
          return;
        }
      }

      chat.setThinking(true);

      // Guardrail questions also leave a note/question for the doctor.
      if (intent.kind === 'guardrail' && intent.reason !== 'injection') {
        const { doctorNote } = guardrailRedirect(intent.reason, app.currentPersonId);
        if (doctorNote) app.actions.addDoctorNote(doctorNote);
      }

      const history: AgentInput['history'] = useChatStore
        .getState()
        .items.filter((it): it is Extract<typeof it, { kind: 'message' }> => it.kind === 'message')
        .map((m) => ({ role: m.role, text: m.text }));

      await drive(agent.sendMessage({ text: trimmed, history }));
    },
    [drive, runSpikeArc, runSafety],
  );

  const confirmCard = useCallback(
    async (callId: string, savedEntries: LogEntry[]) => {
      const chat = useChatStore.getState();
      const { actions } = useAppStore.getState();
      savedEntries.forEach((e) => actions.addLog({ ...e, confirmed: true }));
      chat.setCardState(callId, 'saved');
      chat.setThinking(true);
      await drive(agent.provideToolResult({ callId, name: 'registerEntry', ok: true, savedEntries }));
    },
    [drive],
  );

  const dismissCard = useCallback(
    async (callId: string) => {
      const chat = useChatStore.getState();
      chat.setCardState(callId, 'dismissed');
      chat.setThinking(true);
      await drive(agent.provideToolResult({ callId, name: 'registerEntry', ok: false }));
    },
    [drive],
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
  };
}
