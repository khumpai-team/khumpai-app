/**
 * CaregiverDashboard — the caregiver front. Monitors ONE patient at a time
 * (currentPersonId): vitals at a glance, gentle alerts, recent activity, and
 * quick ways in. A patient switcher (avatars) changes who you're watching, and
 * you can add another person to care for. Accent is deep-blue (see tokens).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { uid } from '@/lib/id';
import { caregiverAlertConditions } from '@/lib/notifications/caregiver';
import { useAppStore } from '@/store/appStore';
import { usePillboxStore } from '@/store/usePillboxStore';
import type { GlucoseLog, LogEntry, MoodLog, SleepLog } from '@/types';
import {
  GearIcon,
  PlusIcon,
  ChatBubbleIcon,
  ReportIcon,
  DropIcon,
  AlertIcon,
  CheckIcon,
} from '@/components/ui/icons';

const PALETTE = ['#1F6699', '#2E7D6B', '#8A5CC0', '#C06A3A'];

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
}

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-extrabold text-white"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="rounded-md bg-bg-sunken px-3 py-3">
      <p className="text-2xl font-extrabold leading-none" style={{ color: accent ?? 'var(--text-primary)' }}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-bold text-text-tertiary">{unit}</span>}
      </p>
      <p className="mt-1 text-xs font-semibold text-text-secondary">{label}</p>
    </div>
  );
}

function recentLabel(l: LogEntry): string {
  switch (l.type) {
    case 'glucose':
      return `🩸 Azúcar ${l.payload.value} mg/dL · ${fmtTime(l.timestamp)}`;
    case 'meal':
      return `🍽️ ${l.payload.description} · ${fmtTime(l.timestamp)}`;
    case 'sleep':
      return `😴 Durmió ${l.payload.hours} h`;
    case 'medication':
      return `💊 ${l.payload.name} ${l.payload.taken ? '✓' : '—'}`;
    case 'symptom':
      return `🩹 ${l.payload.description}`;
    case 'mood':
      return `🙂 Ánimo registrado`;
    case 'stress':
      return `😌 Estrés registrado`;
    default:
      return '•';
  }
}

export function CaregiverDashboard() {
  const navigate = useNavigate();
  const persons = useAppStore((s) => s.persons);
  const currentPersonId = useAppStore((s) => s.currentPersonId);
  const logs = useAppStore((s) => s.logs);
  const medications = useAppStore((s) => s.medications);
  const stockMap = usePillboxStore((s) => s.stock);
  const capMap = usePillboxStore((s) => s.capacity);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const patient = persons.find((p) => p.id === currentPersonId) ?? persons[0];

  const data = useMemo(() => {
    const pid = patient?.id;
    const pLogs = logs.filter((l) => l.personId === pid);
    const glucose = pLogs.filter((l): l is GlucoseLog => l.type === 'glucose').sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const latest = glucose[0];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const week = glucose.filter((g) => new Date(g.timestamp).getTime() >= cutoff);
    const vals = week.map((g) => g.payload.value);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const inRange = vals.filter((v) => v >= 70 && v <= 180).length;

    const meds = medications.filter((m) => m.personId === pid);
    const recs = meds.flatMap((m) => m.adherenceLog).filter((r) => new Date(`${r.date}T12:00:00`).getTime() >= cutoff);
    const adherence = recs.length ? Math.round((recs.filter((r) => r.taken).length / recs.length) * 100) : null;

    const stock = meds.length ? stockMap[meds[0].id] ?? capMap[meds[0].id] ?? 30 : null;

    const lastSleep = pLogs.filter((l): l is SleepLog => l.type === 'sleep').sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const lastMood = pLogs.filter((l): l is MoodLog => l.type === 'mood').sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const recent = [...pLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);

    return { latest, avg, inRange, weekCount: vals.length, adherence, stock, lastSleep, lastMood, recent, hasData: pLogs.length > 0 };
  }, [patient, logs, medications, stockMap, capMap]);

  const medId = medications.find((m) => m.personId === patient?.id)?.id;
  const { highToday, stockLow } = caregiverAlertConditions(logs, patient?.id ?? '', new Date(), {
    remaining: data.stock,
    capacity: (medId ? capMap[medId] : undefined) ?? 30,
  });
  const alerts: string[] = [];
  if (highToday) alerts.push(es.caregiver.alertHigh(highToday));
  if (stockLow) alerts.push(es.caregiver.alertStock);

  const addPatient = () => {
    const name = newName.trim();
    if (!name) return;
    const id = uid('person');
    const color = PALETTE[persons.length % PALETTE.length];
    useAppStore.setState((s) => ({
      persons: [...s.persons, { id, name, relation: 'mother', color }],
      currentPersonId: id,
    }));
    setNewName('');
    setAdding(false);
  };

  if (!patient) return null;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-base no-scrollbar">
      {/* header */}
      <header className="relative border-b border-border bg-bg-surface px-5 pb-3 pt-6">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label={es.settings.title}
          className="touch-target absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
        >
          <GearIcon size={23} />
        </button>

        <div className="flex items-center gap-3 pr-12">
          <Avatar name={patient.name} color={patient.color} size={52} />
          <div className="min-w-0">
            <p className="eyebrow">{es.caregiver.caringFor('').trim()}</p>
            <h1 className="font-serif text-2xl font-bold leading-tight text-text-primary">{patient.name}</h1>
          </div>
        </div>

        {/* patient switcher */}
        {(persons.length > 1 || true) && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {persons.map((p) => {
              const active = p.id === patient.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => useAppStore.setState({ currentPersonId: p.id })}
                  className="press flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm font-bold"
                  style={{ borderColor: active ? 'var(--cyan)' : 'var(--border)', opacity: active ? 1 : 0.6 }}
                >
                  <Avatar name={p.name} color={p.color} size={26} />
                  {p.name}
                </button>
              );
            })}
            {adding ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPatient()}
                  placeholder={es.caregiver.addPatientName}
                  className="w-36 rounded-full border border-border bg-bg-base px-3 py-1.5 text-sm focus-visible:outline-none"
                />
                <button type="button" onClick={addPatient} className="btn-primary press grid h-8 w-8 place-items-center rounded-full">
                  <CheckIcon size={16} />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                aria-label={es.caregiver.addPatient}
                className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-border-strong text-text-secondary"
              >
                <PlusIcon size={18} />
              </button>
            )}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-4 px-5 pb-6 pt-4">
        {!data.hasData ? (
          <p className="rounded-lg border border-border bg-bg-surface p-5 text-center text-[15px] leading-relaxed text-text-secondary shadow-soft">
            {es.caregiver.noData}
          </p>
        ) : (
          <>
            {/* alerts */}
            <section
              className="rounded-lg border p-4 shadow-soft"
              style={{
                borderColor: alerts.length ? 'var(--amber)' : 'var(--border)',
                background: alerts.length ? 'var(--amber-tint)' : 'var(--bg-surface)',
              }}
            >
              <p className="eyebrow flex items-center gap-1.5" style={{ color: alerts.length ? 'var(--amber)' : undefined }}>
                <AlertIcon size={14} /> {es.caregiver.alertsTitle}
              </p>
              {alerts.length ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {alerts.map((a, i) => (
                    <li key={i} className="text-[15px] font-semibold text-text-primary">
                      {a}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[15px] font-semibold text-text-primary">{es.caregiver.allCalm}</p>
              )}
            </section>

            {/* vitals */}
            <section className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
              <Stat
                label={es.caregiver.latestGlucose}
                value={data.latest ? `${data.latest.payload.value}` : '—'}
                unit={data.latest ? 'mg/dL' : undefined}
                accent={data.latest && data.latest.payload.value >= 180 ? 'var(--amber)' : 'var(--cyan)'}
              />
              <Stat label={es.caregiver.weekAvg} value={data.avg != null ? `${data.avg}` : '—'} unit={data.avg != null ? 'mg/dL' : undefined} />
              <Stat label={es.caregiver.inRange} value={`${data.inRange}/${data.weekCount}`} />
              <Stat label={es.caregiver.adherence} value={data.adherence != null ? `${data.adherence}%` : '—'} accent="var(--deep-blue)" />
            </section>

            {/* recent */}
            <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
              <p className="eyebrow mb-2">{es.caregiver.recent}</p>
              <ul className="flex flex-col gap-2">
                {data.recent.length ? (
                  data.recent.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-[15px] text-text-primary">
                      <DropIcon size={4} className="opacity-0" />
                      {recentLabel(l)}
                    </li>
                  ))
                ) : (
                  <li className="text-[15px] text-text-secondary">{es.caregiver.noRecent}</li>
                )}
              </ul>
            </section>
          </>
        )}

        {/* quick links */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/journal')}
            className="press flex items-center justify-center gap-2 rounded-full border border-border bg-bg-surface py-3 text-sm font-bold text-deep-blue shadow-soft"
          >
            <ReportIcon size={18} /> {es.caregiver.viewJournal}
          </button>
          <button
            type="button"
            onClick={() => navigate('/report')}
            className="press flex items-center justify-center gap-2 rounded-full border border-border bg-bg-surface py-3 text-sm font-bold text-deep-blue shadow-soft"
          >
            <ReportIcon size={18} /> {es.caregiver.viewReport}
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="press btn-primary touch-target flex items-center justify-center gap-2 rounded-full py-4 text-[16px] font-bold"
        >
          <ChatBubbleIcon size={20} /> {es.caregiver.talk}
        </button>
      </div>
    </div>
  );
}
