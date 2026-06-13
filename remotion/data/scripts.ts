/**
 * Hard-coded chat scripts for the demo's chat beats. Pacing is snappy (short
 * typing windows) so a lot of story fits in each 7s segment.
 *
 *  0. Onboarding            — warm scripted setup.
 *  1. RAG recommendation    — asked by VOICE, answered with cited sources.
 *  2. Conversational logging — a FOOD PHOTO is uploaded and registered as a
 *                              meal + glucose, saved offline (amber pending).
 *
 * Timestamps are fixed strings (not new Date()) so renders are deterministic.
 */

import type { GlucoseLog, LogEntry, MealLog } from '@/types';
import type { SourceRef } from '@/store/useChatStore';
import { FOOD_DATA_URI } from './foodImage';

export type ChatBeat =
  | { t: 'user'; at: number; text: string; pending?: boolean; imageUrl?: string }
  | { t: 'typing'; from: number; to: number }
  | { t: 'khumpi'; at: number; text: string; sources?: SourceRef[] }
  | { t: 'card'; at: number; savedAt: number; entry: LogEntry; secondaryEntry?: LogEntry };

// --- 0. Onboarding (the chat, reused as a warm scripted setup) --------------

export const ONBOARDING_SCRIPT: ChatBeat[] = [
  { t: 'khumpi', at: 0, text: '¡Hola! Soy Khumpi, te acompaño a cuidar tu azúcar. ¿Cómo te llamas?' },
  { t: 'user', at: 22, text: 'Carlos' },
  { t: 'typing', from: 32, to: 56 },
  { t: 'khumpi', at: 56, text: 'Mucho gusto, Carlos 💚 ¿Tomas alguna pastilla para la diabetes?' },
  { t: 'user', at: 92, text: 'Metformina, en la mañana y en la noche' },
  { t: 'typing', from: 102, to: 126 },
  {
    t: 'khumpi',
    at: 126,
    text: 'Perfecto, ya quedó configurado. Cuando quieras cuéntame cómo te sientes y yo anoto todo.',
  },
];

// --- 1. RAG recommendation — asked by voice --------------------------------

export const RAG_SOURCES: SourceRef[] = [{ source: 'Guía ALAD' }, { source: 'MINSA' }];

/** While frame < this, the composer shows the listening/voice state. */
export const RAG_LISTEN_UNTIL = 34;

export const RAG_SCRIPT: ChatBeat[] = [
  { t: 'user', at: 34, text: '¿Puedo comer mango en la noche?' },
  { t: 'typing', from: 46, to: 78 },
  {
    t: 'khumpi',
    at: 78,
    text: 'El mango es dulce, así que en la noche conviene una porción pequeña —una rebanada— y acompañarla con algo de proteína para que tu azúcar suba más despacio. 🥭',
    sources: RAG_SOURCES,
  },
];

// --- 2. Conversational logging (offline) — a food PHOTO is registered ------

const DRAFT_MEAL: MealLog = {
  id: 'demo-meal-1',
  personId: 'carlos',
  type: 'meal',
  timestamp: '2026-06-13T13:30:00',
  createdAt: '2026-06-13T13:31:00',
  source: 'conversation',
  confirmed: false,
  isOfflineCapture: true,
  payload: { description: 'Lomo saltado con arroz', context: 'fuera' },
};

const DRAFT_GLUCOSE: GlucoseLog = {
  id: 'demo-glu-1',
  personId: 'carlos',
  type: 'glucose',
  timestamp: '2026-06-13T15:00:00',
  createdAt: '2026-06-13T15:01:00',
  source: 'conversation',
  confirmed: false,
  isOfflineCapture: true,
  payload: { value: 142, moment: 'post-almuerzo' },
};

export const REGISTER_SCRIPT: ChatBeat[] = [
  { t: 'user', at: 8, text: 'Esto almorcé hoy 🍽️', pending: true, imageUrl: FOOD_DATA_URI },
  { t: 'typing', from: 26, to: 56 },
  {
    t: 'khumpi',
    at: 56,
    text: '¡Se ve rico! Lo reconocí como lomo saltado. Lo anoto como tu almuerzo 👇',
  },
  { t: 'card', at: 74, savedAt: 150, entry: DRAFT_MEAL, secondaryEntry: DRAFT_GLUCOSE },
];
