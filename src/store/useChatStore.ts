/**
 * Chat transcript state. Items are plain messages, an inline ConfirmationCard,
 * or one of the richer "arc" items (choice chips, InsightCard, ActionCard,
 * SafetyCard). Persisted to sessionStorage so the conversation survives nav.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChatRole, RegisterEntryArgs } from '@/agent/AgentProvider';
import type { Insight, RedFlagLevel } from '@/types';

export type CardState = 'pending' | 'saved' | 'dismissed';

/** A cited knowledge-base source backing a grounded (RAG) answer. */
export interface SourceRef {
  source: string;
  sourceUrl?: string;
}

export interface MessageItem {
  id: string;
  kind: 'message';
  role: ChatRole;
  text: string;
  /** True while tokens are still streaming in. */
  streaming?: boolean;
  /** True when captured offline and waiting to sync (amber pending dot). */
  pending?: boolean;
  /** Thumbnail data URL when the user attached a photo. */
  imageUrl?: string;
  /** Citations rendered as chips below a grounded knowledge-base answer. */
  sources?: SourceRef[];
}

export interface CardItem {
  id: string; // == tool call id
  kind: 'card';
  args: RegisterEntryArgs;
  state: CardState;
}

/** Tappable choice chips inline in the transcript (e.g. the calm step). */
export interface ChoiceItem {
  id: string;
  kind: 'choice';
  options: { label: string; value: string }[];
  answered?: boolean;
}

export interface InsightItem {
  id: string;
  kind: 'insight';
  insight: Insight;
}

export type ActionState = 'pending' | 'accepted' | 'declined';
export interface ActionItem {
  id: string;
  kind: 'action';
  suggestionType: string; // e.g. 'activity_suggestion' | 'food_suggestion'
  text: string;
  acceptLabel: string;
  state: ActionState;
}

export interface SafetyItem {
  id: string;
  kind: 'safety';
  level: RedFlagLevel; // 'urgent' | 'emergency'
  description: string;
  message: string;
  notified?: boolean;
}

/** Clickable person chooser (caregiver: "¿para quién es esto?"). */
export interface PersonPickItem {
  id: string;
  kind: 'personPick';
  options: { id: string; name: string; color: string }[];
  answeredName?: string;
}

export type ChatItem =
  | MessageItem
  | CardItem
  | ChoiceItem
  | InsightItem
  | ActionItem
  | SafetyItem
  | PersonPickItem;

interface ChatState {
  items: ChatItem[];
  /** True while the agent is "thinking" before its first token. */
  thinking: boolean;
  /** Calm atmosphere wash (the spike→calm arc). */
  calm: boolean;
  /** Set once the opening greeting has been seeded (idempotent across mounts). */
  seeded: boolean;

  addMessage: (item: MessageItem) => void;
  markSeeded: () => void;
  appendDelta: (id: string, delta: string) => void;
  endMessage: (id: string) => void;
  /** Attach citation chips to a message and end its streaming state. */
  attachSources: (id: string, sources: SourceRef[]) => void;
  addCard: (item: CardItem) => void;
  setCardState: (id: string, state: CardState) => void;
  addItem: (item: ChatItem) => void;
  answerChoice: (id: string) => void;
  setActionState: (id: string, state: ActionState) => void;
  answerPersonPick: (id: string, name: string) => void;
  markSafetyNotified: (id: string) => void;
  clearPending: () => void;
  setThinking: (v: boolean) => void;
  setCalm: (v: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      items: [],
      thinking: false,
      calm: false,
      seeded: false,

      addMessage: (item) => set((s) => ({ items: [...s.items, item] })),
      markSeeded: () => set({ seeded: true }),
      appendDelta: (id, delta) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.kind === 'message' && it.id === id ? { ...it, text: it.text + delta } : it,
          ),
        })),
      endMessage: (id) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.kind === 'message' && it.id === id ? { ...it, streaming: false } : it,
          ),
        })),
      attachSources: (id, sources) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.kind === 'message' && it.id === id ? { ...it, sources, streaming: false } : it,
          ),
        })),
      addCard: (item) => set((s) => ({ items: [...s.items, item] })),
      setCardState: (id, state) =>
        set((s) => ({
          items: s.items.map((it) => (it.kind === 'card' && it.id === id ? { ...it, state } : it)),
        })),
      addItem: (item) => set((s) => ({ items: [...s.items, item] })),
      answerChoice: (id) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.kind === 'choice' && it.id === id ? { ...it, answered: true } : it,
          ),
        })),
      setActionState: (id, state) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.kind === 'action' && it.id === id ? { ...it, state } : it,
          ),
        })),
      answerPersonPick: (id, name) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.kind === 'personPick' && it.id === id ? { ...it, answeredName: name } : it,
          ),
        })),
      markSafetyNotified: (id) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.kind === 'safety' && it.id === id ? { ...it, notified: true } : it,
          ),
        })),
      clearPending: () =>
        set((s) => ({
          items: s.items.map((it) =>
            it.kind === 'message' && it.pending ? { ...it, pending: false } : it,
          ),
        })),
      setThinking: (v) => set({ thinking: v }),
      setCalm: (v) => set({ calm: v }),
      clear: () => set({ items: [], thinking: false, calm: false, seeded: false }),
    }),
    {
      name: 'khumpai-chat',
      storage: createJSONStorage(() => sessionStorage),
      // Only the transcript is durable. thinking/calm/seeded are transient UI
      // state — persisting them could restore a stuck "typing…" on reload.
      partialize: (s) => ({ items: s.items }),
    },
  ),
);
