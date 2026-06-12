/**
 * JournalScreen — the bitácora. A day navigator (relative labels + collapsible
 * mini-calendar) over a single chronological TIMELINE of the day: every entry
 * as a time-stamped node with a category chip (Glucosa, Comida, Pastilla,
 * Descanso, …). Glucose/meal nodes edit inline. Warm empty days; missed
 * medication is simply absent, never shamed.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { dateKey, isSameDay, relativeDayLabel } from '@/lib/dateUtils';
import { useAppStore } from '@/store/appStore';
import type { GlucoseLog, GlucoseMoment, LogEntry, MealContext, MealLog } from '@/types';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, EditIcon, ShareIcon } from '@/components/ui/icons';

const MOOD_EMOJI = ['😢', '😟', '😐', '🙂', '😄'];
const STRESS_EMOJI = ['😌', '😐', '😣'];

const fmtDate = (d: Date) => {
  const s = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'short' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
};
const tint = (color: string) => `color-mix(in srgb, ${color} 15%, var(--bg-surface))`;

const inputCls =
  'rounded-md border border-border bg-bg-base px-3 py-2 text-[16px] text-text-primary focus-visible:outline-cyan';

interface TimelineEvent {
  id: string;
  t: number;
  timeLabel: string;
  cat: string;
  emoji: string;
  color: string;
  main: React.ReactNode;
  sub?: string;
  edit?: 'glucose' | 'meal';
  glucose?: GlucoseLog;
  meal?: MealLog;
}

export function JournalScreen() {
  const navigate = useNavigate();
  const logs = useAppStore((s) => s.logs);
  const medications = useAppStore((s) => s.medications);
  const doctorNotes = useAppStore((s) => s.doctorNotes);
  const personId = useAppStore((s) => s.currentPersonId);
  const editLog = useAppStore((s) => s.actions.editLog);

  const [selected, setSelected] = useState(() => new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const today = new Date();
  const iso = selected.toISOString();
  const isToday = isSameDay(iso, today.toISOString());
  const dayKey = dateKey(iso);

  const dayLogsFor = (d: Date) =>
    logs.filter((l) => l.personId === personId && isSameDay(l.timestamp, d.toISOString()));

  // Build a single chronological timeline from every source for the day.
  const events = useMemo(() => {
    const T = (ts: string) => new Date(ts).getTime();
    const evs: TimelineEvent[] = [];

    dayLogsFor(selected).forEach((l) => {
      const base = { id: l.id, t: T(l.timestamp), timeLabel: fmtTime(l.timestamp) };
      switch (l.type) {
        case 'glucose': {
          const high = l.payload.value >= 180;
          evs.push({
            ...base,
            cat: es.journal.cat.glucose,
            emoji: '🩸',
            color: high ? 'var(--amber)' : 'var(--cyan)',
            main: (
              <span className="font-bold" style={{ color: high ? 'var(--amber)' : 'var(--text-primary)' }}>
                {l.payload.value} {es.confirmation.units.mgdl}
              </span>
            ),
            sub: es.enums.glucoseMoment[l.payload.moment],
            edit: 'glucose',
            glucose: l,
          });
          break;
        }
        case 'meal':
          evs.push({
            ...base,
            cat: es.journal.cat.meal,
            emoji: '🍽️',
            color: 'var(--cyan)',
            main: <span className="font-semibold text-text-primary">{l.payload.description}</span>,
            sub: es.enums.mealContext[l.payload.context],
            edit: 'meal',
            meal: l,
          });
          break;
        case 'sleep':
          evs.push({ ...base, cat: es.journal.cat.sleep, emoji: '😴', color: 'var(--deep-blue)', main: es.journal.sleepLabel(l.payload.hours) });
          break;
        case 'mood':
          evs.push({ ...base, cat: es.journal.cat.mood, emoji: MOOD_EMOJI[l.payload.score - 1], color: 'var(--sky)', main: es.journal.moodLabel });
          break;
        case 'stress':
          evs.push({ ...base, cat: es.journal.cat.stress, emoji: STRESS_EMOJI[l.payload.level - 1], color: 'var(--sky)', main: es.journal.stressLabel });
          break;
        case 'symptom':
          evs.push({ ...base, cat: es.journal.cat.symptom, emoji: '🩹', color: 'var(--amber)', main: <span className="text-text-primary">{l.payload.description}</span> });
          break;
      }
    });

    // Medication adherence (synthesize a time from the scheduled slot).
    medications
      .filter((m) => m.personId === personId)
      .forEach((m) =>
        m.adherenceLog
          .filter((r) => r.date === dayKey)
          .forEach((r) => {
            const tIso = `${dayKey}T${r.scheduledTime}:00`;
            evs.push({
              id: `${m.id}-${r.scheduledTime}`,
              t: new Date(tIso).getTime(),
              timeLabel: fmtTime(tIso),
              cat: es.journal.cat.medication,
              emoji: '💊',
              color: 'var(--deep-blue)',
              main: (
                <span className="text-text-primary">
                  {m.name}{' '}
                  <span className="font-bold" style={{ color: r.taken ? 'var(--cyan)' : 'var(--text-tertiary)' }}>
                    {r.taken ? `· ${es.journal.taken}` : `· ${es.journal.pending}`}
                  </span>
                </span>
              ),
            });
          }),
      );

    // Khumpi notes.
    doctorNotes
      .filter((n) => n.personId === personId && isSameDay(n.timestamp, iso))
      .forEach((n) =>
        evs.push({
          id: n.id,
          t: new Date(n.timestamp).getTime(),
          timeLabel: fmtTime(n.timestamp),
          cat: es.journal.cat.note,
          emoji: '📝',
          color: 'var(--cyan)',
          main: <span className="leading-relaxed text-text-primary">{n.text}</span>,
        }),
      );

    return evs.sort((a, b) => a.t - b.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, medications, doctorNotes, personId, selected, dayKey, iso]);

  // mini-calendar week
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selected), i)), [selected]);
  const dotFor = (d: Date): 'spike' | 'ok' | 'none' => {
    if (d.getTime() > today.getTime()) return 'none';
    const ls = dayLogsFor(d);
    if (!ls.length) return 'none';
    return ls.some((l) => l.type === 'glucose' && l.payload.value >= 180) ? 'spike' : 'ok';
  };

  const rel = relativeDayLabel(iso);
  const primaryLabel = rel === 'hoy' ? es.journal.today : rel === 'ayer' ? es.journal.yesterday : fmtDate(selected);

  return (
    <div className="flex h-full flex-col bg-bg-base">
      {/* title + report shortcut */}
      <div className="flex items-center justify-between border-b border-border bg-bg-surface px-4 pt-3">
        <h1 className="font-serif text-xl font-bold text-text-primary">{es.journal.title}</h1>
        <button
          type="button"
          onClick={() => navigate('/report')}
          className="touch-target flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-deep-blue transition-colors active:bg-bg-sunken"
        >
          <ShareIcon size={18} /> {es.report.open}
        </button>
      </div>

      {/* day navigator */}
      <header className="border-b border-border bg-bg-surface px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelected((d) => addDays(d, -1))}
            aria-label="Día anterior"
            className="touch-target grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
          >
            <ChevronLeftIcon size={22} />
          </button>

          <button type="button" onClick={() => setShowCalendar((v) => !v)} aria-expanded={showCalendar} className="flex flex-1 flex-col items-center">
            <span className="font-serif text-[18px] font-bold leading-tight text-text-primary">{primaryLabel}</span>
            {(rel === 'hoy' || rel === 'ayer') && <span className="text-xs text-text-tertiary">{fmtDate(selected)}</span>}
          </button>

          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            aria-label="Calendario"
            className="touch-target grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
          >
            <CalendarIcon size={21} />
          </button>

          <button
            type="button"
            onClick={() => setSelected((d) => addDays(d, 1))}
            disabled={isToday}
            aria-label="Día siguiente"
            className="touch-target grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken disabled:opacity-30"
          >
            <ChevronRightIcon size={22} />
          </button>
        </div>

        <AnimatePresence>
          {showCalendar && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-2 grid grid-cols-7 gap-1 pb-1">
                {es.journal.weekdayInitials.map((w, i) => (
                  <span key={i} className="text-center text-[11px] font-semibold text-text-tertiary">
                    {w}
                  </span>
                ))}
                {week.map((d) => {
                  const dot = dotFor(d);
                  const sel = isSameDay(d.toISOString(), iso);
                  const future = d.getTime() > today.getTime();
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      disabled={future}
                      onClick={() => setSelected(new Date(d))}
                      className="flex flex-col items-center gap-1 rounded-md py-1.5 transition-colors disabled:opacity-30"
                      style={{ background: sel ? 'var(--cyan-tint)' : 'transparent' }}
                    >
                      <span className="text-sm font-bold" style={{ color: sel ? 'var(--cyan)' : 'var(--text-secondary)' }}>
                        {d.getDate()}
                      </span>
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: dot === 'spike' ? 'var(--amber)' : dot === 'ok' ? 'var(--cyan)' : 'var(--border)' }}
                      />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* day timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-5 no-scrollbar">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 pt-12 text-center">
            <span className="text-4xl" aria-hidden>
              🌤️
            </span>
            <p className="max-w-[260px] text-[16px] leading-relaxed text-text-secondary">{es.journal.empty}</p>
          </div>
        ) : (
          <ul className="relative">
            {/* connector rail */}
            <span className="absolute bottom-3 top-2 w-px bg-border" style={{ left: '74px' }} aria-hidden />
            {events.map((ev, i) => (
              <motion.li
                key={ev.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.3) }}
                className="relative flex gap-3 pb-5 last:pb-1"
              >
                <span className="w-14 shrink-0 pt-1 text-right text-[11px] font-semibold leading-tight text-text-tertiary">
                  {ev.timeLabel}
                </span>
                <span
                  className="relative z-10 mt-1.5 h-4 w-4 shrink-0 rounded-full ring-4 ring-[color:var(--bg-base)]"
                  style={{ background: ev.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: tint(ev.color), color: ev.color }}
                    >
                      <span aria-hidden>{ev.emoji}</span> {ev.cat}
                    </span>
                    {ev.edit && editingId !== ev.id && (
                      <button
                        type="button"
                        onClick={() => setEditingId(ev.id)}
                        aria-label={es.journal.edit}
                        className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-tertiary transition-colors active:bg-bg-sunken"
                      >
                        <EditIcon size={16} />
                      </button>
                    )}
                  </div>

                  {editingId === ev.id && ev.glucose ? (
                    <div className="mt-2">
                      <GlucoseEditor
                        entry={ev.glucose}
                        onSave={(p) => {
                          editLog(ev.glucose!.id, { payload: p } as Partial<LogEntry>);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : editingId === ev.id && ev.meal ? (
                    <div className="mt-2">
                      <MealEditor
                        entry={ev.meal}
                        onSave={(p) => {
                          editLog(ev.meal!.id, { payload: p } as Partial<LogEntry>);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 text-[15px]">
                      {ev.main}
                      {ev.sub && <span className="mt-0.5 block text-xs text-text-secondary">{ev.sub}</span>}
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- inline editors -------------------------------------------------------

function EditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={onSave} className="press btn-primary rounded-full px-4 py-1.5 text-sm font-bold">
        {es.journal.save}
      </button>
      <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-1.5 text-sm font-bold text-text-secondary">
        {es.journal.cancel}
      </button>
    </div>
  );
}

function GlucoseEditor({ entry, onSave, onCancel }: { entry: GlucoseLog; onSave: (p: GlucoseLog['payload']) => void; onCancel: () => void }) {
  const [value, setValue] = useState(entry.payload.value);
  const [moment, setMoment] = useState<GlucoseMoment>(entry.payload.moment);
  return (
    <div className="flex flex-col gap-2 rounded-md bg-bg-sunken p-3">
      <input type="number" inputMode="numeric" className={inputCls} value={value} aria-label={es.confirmation.fieldGlucose} onChange={(e) => setValue(Number(e.target.value))} />
      <select className={inputCls} value={moment} aria-label={es.confirmation.fieldGlucoseMoment} onChange={(e) => setMoment(e.target.value as GlucoseMoment)}>
        {(Object.keys(es.enums.glucoseMoment) as GlucoseMoment[]).map((k) => (
          <option key={k} value={k}>
            {es.enums.glucoseMoment[k]}
          </option>
        ))}
      </select>
      <EditActions onSave={() => onSave({ value, moment })} onCancel={onCancel} />
    </div>
  );
}

function MealEditor({ entry, onSave, onCancel }: { entry: MealLog; onSave: (p: MealLog['payload']) => void; onCancel: () => void }) {
  const [description, setDescription] = useState(entry.payload.description);
  const [context, setContext] = useState<MealContext>(entry.payload.context);
  return (
    <div className="flex flex-col gap-2 rounded-md bg-bg-sunken p-3">
      <input className={inputCls} value={description} aria-label={es.confirmation.fieldMeal} onChange={(e) => setDescription(e.target.value)} />
      <select className={inputCls} value={context} aria-label={es.confirmation.fieldPlace} onChange={(e) => setContext(e.target.value as MealContext)}>
        {(Object.keys(es.enums.mealContext) as MealContext[]).map((k) => (
          <option key={k} value={k}>
            {es.enums.mealContext[k]}
          </option>
        ))}
      </select>
      <EditActions onSave={() => onSave({ description, context })} onCancel={onCancel} />
    </div>
  );
}
