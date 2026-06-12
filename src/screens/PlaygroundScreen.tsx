/**
 * PlaygroundScreen — a component gallery / tuning surface. Renders every
 * component in its key states plus the design tokens (color, shadow, radius,
 * type) so the whole system can be reviewed and tuned in one place. Dev-facing,
 * so labels are in English (component names). Toggle theme from the header to
 * check light/dark.
 */

import { useState, type ReactNode } from 'react';
import { es } from '@/data/i18n/es';
import { AGENT_ES } from '@/data/i18n/agent-es';
import { SEED_INSIGHTS } from '@/data/seed';
import type { LogEntry } from '@/types';
import { useThemeStore } from '@/store/useThemeStore';
import { KhumpiAvatar, type KhumpiState } from '@/components/khumpi/KhumpiAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { ChatInput } from '@/components/chat/ChatInput';
import { ConfirmationCard } from '@/components/cards/ConfirmationCard';
import { InsightCard } from '@/components/cards/InsightCard';
import { ActionCard } from '@/components/cards/ActionCard';
import { SafetyCard } from '@/components/cards/SafetyCard';
import { Pillbox } from '@/components/pillbox/Pillbox';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { CheckinSheet } from '@/components/sheets/CheckinSheet';
import { PanicButton } from '@/components/ui/PanicButton';
import {
  SunIcon,
  MoonToggleIcon,
  DropIcon,
  MealIcon,
  MoonIcon,
  PillIcon,
  SymptomIcon,
  CheckIcon,
  SendIcon,
  MicIcon,
  EditIcon,
  PhoneIcon,
  ChatBubbleIcon,
  PinIcon,
  AlertIcon,
  GearIcon,
  PlusIcon,
  ShareIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ReportIcon,
  SlidersIcon,
} from '@/components/ui/icons';

// --- sample data ----------------------------------------------------------

const now = new Date().toISOString();
const base = {
  personId: 'carlos',
  timestamp: now,
  createdAt: now,
  source: 'conversation' as const,
  confirmed: false,
  isOfflineCapture: false,
};
const mealDraft: LogEntry = { ...base, id: 'pg-m', type: 'meal', payload: { description: 'Dos panes con palta', context: 'casa' } };
const glucoseDraft: LogEntry = { ...base, id: 'pg-g', type: 'glucose', payload: { value: 160, moment: 'post-desayuno' } };
const sleepDraft: LogEntry = { ...base, id: 'pg-s', type: 'sleep', payload: { hours: 5 } };
const medDraft: LogEntry = { ...base, id: 'pg-md', type: 'medication', payload: { name: 'Metformina', taken: true } };
const symptomDraft: LogEntry = { ...base, id: 'pg-sy', type: 'symptom', payload: { description: 'Me duele la cabeza', redFlag: false, level: 'watch' } };

const insight = SEED_INSIGHTS[0];

const TOKENS: { name: string; var: string }[] = [
  { name: 'cyan', var: '--cyan' },
  { name: 'cyan-strong', var: '--cyan-strong' },
  { name: 'sky', var: '--sky' },
  { name: 'deep-blue', var: '--deep-blue' },
  { name: 'amber', var: '--amber' },
  { name: 'coral-soft', var: '--coral-soft' },
  { name: 'danger', var: '--danger' },
  { name: 'bg-base', var: '--bg-base' },
  { name: 'bg-surface', var: '--bg-surface' },
  { name: 'bg-sunken', var: '--bg-sunken' },
];

const ICONS: { name: string; el: ReactNode }[] = [
  { name: 'Drop', el: <DropIcon /> },
  { name: 'Meal', el: <MealIcon /> },
  { name: 'Moon', el: <MoonIcon /> },
  { name: 'Pill', el: <PillIcon /> },
  { name: 'Symptom', el: <SymptomIcon /> },
  { name: 'Check', el: <CheckIcon /> },
  { name: 'Send', el: <SendIcon /> },
  { name: 'Mic', el: <MicIcon /> },
  { name: 'Edit', el: <EditIcon /> },
  { name: 'Phone', el: <PhoneIcon /> },
  { name: 'Chat', el: <ChatBubbleIcon /> },
  { name: 'Pin', el: <PinIcon /> },
  { name: 'Alert', el: <AlertIcon /> },
  { name: 'Gear', el: <GearIcon /> },
  { name: 'Plus', el: <PlusIcon /> },
  { name: 'Share', el: <ShareIcon /> },
  { name: 'Calendar', el: <CalendarIcon /> },
  { name: 'ChevL', el: <ChevronLeftIcon /> },
  { name: 'ChevR', el: <ChevronRightIcon /> },
  { name: 'Report', el: <ReportIcon /> },
  { name: 'Sliders', el: <SlidersIcon /> },
  { name: 'Sun', el: <SunIcon /> },
  { name: 'MoonT', el: <MoonToggleIcon /> },
];

const AVATAR_STATES: KhumpiState[] = ['happy', 'calm', 'informed', 'listening', 'thinking'];

// --- layout helpers -------------------------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-lg font-bold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-3 shadow-soft">
      <p className="eyebrow mb-2">{label}</p>
      {children}
    </div>
  );
}

const noop = () => {};

// --- screen ---------------------------------------------------------------

export function PlaygroundScreen() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [showCheckin, setShowCheckin] = useState(false);

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <header className="flex items-center justify-between border-b border-border bg-bg-surface px-5 py-3.5">
        <div>
          <h1 className="font-serif text-xl font-bold text-text-primary">Playground</h1>
          <p className="text-xs text-text-secondary">Todos los componentes, en un solo lugar</p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={es.common.themeToggle}
          className="press touch-target grid h-11 w-11 place-items-center rounded-full border border-border text-text-secondary"
        >
          {theme === 'dark' ? <SunIcon size={20} /> : <MoonToggleIcon size={20} />}
        </button>
      </header>

      <div className="flex flex-col gap-7 overflow-y-auto px-4 py-5 pb-10 no-scrollbar">
        {/* TOKENS */}
        <Section title="Color tokens">
          <div className="grid grid-cols-5 gap-2">
            {TOKENS.map((t) => (
              <div key={t.var} className="flex flex-col items-center gap-1">
                <span
                  className="h-12 w-full rounded-md border border-border"
                  style={{ background: `var(${t.var})` }}
                />
                <span className="text-[10px] font-semibold text-text-tertiary">{t.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Elevation & radius">
          <div className="grid grid-cols-4 gap-3">
            {[
              { c: 'shadow-soft', l: 'soft' },
              { c: 'shadow-soft-md', l: 'md' },
              { c: 'shadow-soft-lg', l: 'lg' },
              { c: 'shadow-cyan-glow', l: 'glow' },
            ].map((s) => (
              <div key={s.l} className="flex flex-col items-center gap-1">
                <span className={`h-12 w-full rounded-lg bg-bg-surface ${s.c}`} />
                <span className="text-[10px] font-semibold text-text-tertiary">{s.l}</span>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-3">
            {([
              ['sm', 'rounded-sm'],
              ['md', 'rounded-md'],
              ['lg', 'rounded-lg'],
              ['xl', 'rounded-xl'],
              ['full', 'rounded-full'],
            ] as const).map(([r, cls]) => (
              <div key={r} className="flex flex-col items-center gap-1">
                <span className={`h-12 w-12 bg-cyan-soft ${cls}`} />
                <span className="text-[10px] font-semibold text-text-tertiary">{r}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <Cell label="Serif display">
            <p className="font-serif text-3xl font-bold text-text-primary">Khumpai</p>
            <p className="font-serif text-xl font-bold text-text-primary">Tu pastillero</p>
          </Cell>
          <Cell label="Body (Nunito)">
            <p className="text-[16px] text-text-primary">Cuéntame cómo amaneciste hoy.</p>
            <p className="text-[16px] font-bold text-text-primary">Negrita para énfasis.</p>
            <p className="eyebrow mt-1">Eyebrow label</p>
          </Cell>
        </Section>

        <Section title="Buttons & chips">
          <div className="flex flex-wrap items-center gap-2">
            <button className="press btn-primary rounded-full px-5 py-3 text-[15px] font-bold">Primario</button>
            <button className="press rounded-full border border-border bg-bg-base px-5 py-3 text-[15px] font-bold text-deep-blue">
              Secundario
            </button>
            <button className="press rounded-full px-4 py-2 text-sm font-bold text-text-tertiary">Texto</button>
          </div>
          <SuggestionChips onPick={noop} />
        </Section>

        {/* AVATAR */}
        <Section title="KhumpiAvatar — 5 states">
          <div className="grid grid-cols-5 gap-2 rounded-lg border border-border bg-bg-surface p-3 shadow-soft">
            {AVATAR_STATES.map((st) => (
              <div key={st} className="flex flex-col items-center gap-1">
                <KhumpiAvatar state={st} size={48} idle={false} />
                <span className="text-[10px] font-semibold text-text-tertiary">{st}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ICONS */}
        <Section title="Icons">
          <div className="grid grid-cols-6 gap-3 rounded-lg border border-border bg-bg-surface p-3 text-text-secondary shadow-soft">
            {ICONS.map((ic) => (
              <div key={ic.name} className="flex flex-col items-center gap-1">
                {ic.el}
                <span className="text-[9px] font-semibold text-text-tertiary">{ic.name}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* CHAT */}
        <Section title="Chat messages">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-base p-3">
            <MessageBubble role="khumpi" text="¡Hola, Carlos! ¿Cómo amaneciste hoy?" />
            <MessageBubble role="khumpi" text="Estoy escribiendo en vivo" streaming />
            <MessageBubble role="user" text="Dormí cinco horas, me siento cansado" />
            <MessageBubble role="user" text="Me salió 228 en la mañana" pending />
            <TypingIndicator />
          </div>
        </Section>

        <Section title="ChatInput (interactivo)">
          <div className="overflow-hidden rounded-lg border border-border">
            <ChatInput onSend={noop} />
          </div>
        </Section>

        {/* CARDS */}
        <Section title="ConfirmationCard">
          <div className="flex flex-col gap-3">
            <ConfirmationCard entry={mealDraft} secondaryEntry={glucoseDraft} state="pending" onConfirm={noop} onDismiss={noop} />
            <ConfirmationCard entry={sleepDraft} state="pending" onConfirm={noop} onDismiss={noop} />
            <ConfirmationCard entry={medDraft} state="pending" onConfirm={noop} onDismiss={noop} />
            <ConfirmationCard entry={symptomDraft} state="pending" onConfirm={noop} onDismiss={noop} />
            <ConfirmationCard entry={glucoseDraft} state="saved" onConfirm={noop} onDismiss={noop} />
          </div>
        </Section>

        <Section title="InsightCard">
          {insight && <InsightCard insight={insight} />}
        </Section>

        <Section title="ActionCard">
          <div className="flex flex-col gap-3">
            <ActionCard text={es.arc.actionActivity} acceptLabel={es.arc.acceptActivity} state="pending" onAccept={noop} onDecline={noop} />
            <ActionCard text={es.arc.actionFood} acceptLabel={es.arc.acceptFood} state="accepted" onAccept={noop} onDecline={noop} />
            <ActionCard text={es.arc.actionActivity} acceptLabel={es.arc.acceptActivity} state="declined" onAccept={noop} onDecline={noop} />
          </div>
        </Section>

        <Section title="SafetyCard">
          <div className="flex flex-col gap-3">
            <SafetyCard id="pg-safe-1" level="urgent" message={AGENT_ES.redFlags.urgent('una herida en el pie que no cierra')} />
            <SafetyCard id="pg-safe-2" level="emergency" message={AGENT_ES.redFlags.emergency('Dolor fuerte en el pecho.')} />
          </div>
        </Section>

        {/* PILLBOX */}
        <Section title="Pillbox">
          <Pillbox />
        </Section>

        {/* SYSTEM / OVERLAYS */}
        <Section title="OfflineBanner">
          <div className="overflow-hidden rounded-lg border border-border">
            <OfflineBanner offline reconnectCount={null} />
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <OfflineBanner offline={false} reconnectCount={3} />
          </div>
        </Section>

        <Section title="Overlays">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCheckin(true)}
              className="press btn-primary rounded-full px-5 py-3 text-[15px] font-bold"
            >
              Abrir check-in
            </button>
          </div>
          <Cell label="PanicButton (anclado a esta caja)">
            <div className="relative h-32 rounded-md bg-bg-sunken">
              <PanicButton />
            </div>
          </Cell>
        </Section>
      </div>

      {showCheckin && (
        <CheckinSheet onComplete={() => setShowCheckin(false)} onSkip={() => setShowCheckin(false)} />
      )}
    </div>
  );
}
