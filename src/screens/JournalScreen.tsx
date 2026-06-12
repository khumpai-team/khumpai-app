/**
 * JournalScreen — the bitácora. A day navigator (with relative labels and a
 * collapsible mini-calendar), then the day's entries grouped into calm cards.
 * Entries edit inline (no modal). Empty days are warm, never guilt-inducing,
 * and missed medication days are simply not shown.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { dateKey, isSameDay, relativeDayLabel } from '@/lib/dateUtils';
import { useAppStore } from '@/store/appStore';
import type {
  GlucoseLog,
  GlucoseMoment,
  LogEntry,
  MealContext,
  MealLog,
  MoodLog,
  SleepLog,
  StressLog,
} from '@/types';
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  MoonIcon,
  ShareIcon,
} from '@/components/ui/icons';

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

const inputCls =
  'rounded-md border border-border bg-bg-base px-3 py-2 text-[16px] text-text-primary focus-visible:outline-cyan';

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-2 text-deep-blue">
        <span className="text-base" aria-hidden>
          {icon}
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function JournalScreen() {
  const navigate = useNavigate();
  const logs = useAppStore((s) => s.logs);
  const medications = useAppStore((s) => s.medications);
  const doctorNotes = useAppStore((s) => s.doctorNotes);
  const editLog = useAppStore((s) => s.actions.editLog);

  const [selected, setSelected] = useState(() => new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const today = new Date();
  const iso = selected.toISOString();
  const isToday = isSameDay(iso, today.toISOString());

  const dayLogsFor = (d: Date) => logs.filter((l) => isSameDay(l.timestamp, d.toISOString()));

  const dayLogs = useMemo(() => dayLogsFor(selected), [logs, selected]);
  const byTime = (a: LogEntry, b: LogEntry) => a.timestamp.localeCompare(b.timestamp);

  const sleeps = dayLogs.filter((l): l is SleepLog => l.type === 'sleep');
  const moods = dayLogs.filter((l): l is MoodLog => l.type === 'mood');
  const stresses = dayLogs.filter((l): l is StressLog => l.type === 'stress');
  const glucoses = dayLogs.filter((l): l is GlucoseLog => l.type === 'glucose').sort(byTime);
  const meals = dayLogs.filter((l): l is MealLog => l.type === 'meal').sort(byTime);

  const dayKey = dateKey(iso);
  const adherence = useMemo(
    () =>
      medications
        .flatMap((m) => m.adherenceLog.filter((r) => r.date === dayKey).map((r) => ({ med: m.name, ...r })))
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [medications, dayKey],
  );
  const dayNotes = doctorNotes.filter((n) => isSameDay(n.timestamp, iso)).sort((a, b) => byTime(a as never, b as never));

  const hasMorning = sleeps.length || moods.length || stresses.length;
  const isEmpty = !hasMorning && !glucoses.length && !meals.length && !adherence.length && !dayNotes.length;

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

  const startEdit = (id: string) => setEditingId((cur) => (cur === id ? null : id));

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

          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            aria-expanded={showCalendar}
            className="flex flex-1 flex-col items-center"
          >
            <span className="font-serif text-[18px] font-bold leading-tight text-text-primary">{primaryLabel}</span>
            {(rel === 'hoy' || rel === 'ayer') && (
              <span className="text-xs text-text-tertiary">{fmtDate(selected)}</span>
            )}
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
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
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
                      <span
                        className="text-sm font-bold"
                        style={{ color: sel ? 'var(--cyan)' : 'var(--text-secondary)' }}
                      >
                        {d.getDate()}
                      </span>
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background:
                            dot === 'spike' ? 'var(--amber)' : dot === 'ok' ? 'var(--cyan)' : 'var(--border)',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* day content */}
      <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4 no-scrollbar">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pt-12 text-center">
            <span className="text-4xl" aria-hidden>
              🌤️
            </span>
            <p className="max-w-[260px] text-[16px] leading-relaxed text-text-secondary">{es.journal.empty}</p>
          </div>
        ) : (
          <>
            {!!hasMorning && (
              <SectionCard icon="🌅" title={es.journal.sections.morning}>
                {sleeps.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-[15px] text-text-primary">
                    <MoonIcon size={18} className="text-deep-blue" />
                    {es.journal.sleepLabel(s.payload.hours)}
                  </div>
                ))}
                {moods.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-[15px] text-text-primary">
                    <span className="text-lg">{MOOD_EMOJI[m.payload.score - 1]}</span>
                    {es.journal.moodLabel}
                  </div>
                ))}
                {stresses.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-[15px] text-text-primary">
                    <span className="text-lg">{STRESS_EMOJI[s.payload.level - 1]}</span>
                    {es.journal.stressLabel}
                  </div>
                ))}
              </SectionCard>
            )}

            {!!glucoses.length && (
              <SectionCard icon="🩸" title={es.journal.sections.glucose}>
                {glucoses.map((g) =>
                  editingId === g.id ? (
                    <GlucoseEditor key={g.id} entry={g} onSave={(p) => { editLog(g.id, { payload: p } as Partial<LogEntry>); setEditingId(null); }} onCancel={() => setEditingId(null)} />
                  ) : (
                    <EntryRow
                      key={g.id}
                      onEdit={() => startEdit(g.id)}
                      main={
                        <span className="font-bold" style={{ color: g.payload.value >= 180 ? 'var(--amber)' : 'var(--text-primary)' }}>
                          {g.payload.value} {es.confirmation.units.mgdl}
                        </span>
                      }
                      sub={`${es.enums.glucoseMoment[g.payload.moment]} · ${fmtTime(g.timestamp)}`}
                    />
                  ),
                )}
              </SectionCard>
            )}

            {!!meals.length && (
              <SectionCard icon="🍽️" title={es.journal.sections.meals}>
                {meals.map((m) =>
                  editingId === m.id ? (
                    <MealEditor key={m.id} entry={m} onSave={(p) => { editLog(m.id, { payload: p } as Partial<LogEntry>); setEditingId(null); }} onCancel={() => setEditingId(null)} />
                  ) : (
                    <EntryRow
                      key={m.id}
                      onEdit={() => startEdit(m.id)}
                      main={<span className="font-semibold text-text-primary">{m.payload.description}</span>}
                      sub={`${es.enums.mealContext[m.payload.context]} · ${fmtTime(m.timestamp)}`}
                    />
                  ),
                )}
              </SectionCard>
            )}

            {!!adherence.length && (
              <SectionCard icon="💊" title={es.journal.sections.medication}>
                {adherence.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-[15px]">
                    <span className="text-text-primary">
                      {r.med} · {r.scheduledTime}
                    </span>
                    {r.taken ? (
                      <span className="flex items-center gap-1 text-sm font-bold text-cyan">
                        <CheckIcon size={16} /> {es.journal.taken}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-text-tertiary">{es.journal.pending}</span>
                    )}
                  </div>
                ))}
              </SectionCard>
            )}

            {!!dayNotes.length && (
              <SectionCard icon="📝" title={es.journal.sections.notes}>
                {dayNotes.map((n) => (
                  <div key={n.id} className="text-[15px] leading-relaxed text-text-primary">
                    <span className="mr-2 text-xs font-semibold text-text-tertiary">{fmtTime(n.timestamp)}</span>
                    {n.text}
                  </div>
                ))}
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- small pieces ---------------------------------------------------------

function EntryRow({ main, sub, onEdit }: { main: React.ReactNode; sub: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate text-[15px]">{main}</div>
        <div className="text-xs text-text-secondary">{sub}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={es.journal.edit}
        className="touch-target grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-tertiary transition-colors active:bg-bg-sunken"
      >
        <EditIcon size={18} />
      </button>
    </div>
  );
}

function EditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={onSave} className="rounded-full bg-cyan px-4 py-1.5 text-sm font-bold text-[color:var(--text-on-brand)]">
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
