/**
 * CaregiverDashboard — the per-patient DETAIL view. Reached by tapping a card in
 * CaregiverPortfolio (which sets currentPersonId). Shows one patient at a time:
 * status banner, vitals at a glance, recent activity, and quick ways in
 * (journal / report / chat — all scoped to currentPersonId). A back affordance
 * returns to the portfolio. Accent is deep-blue (see tokens).
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { caregiverPatientStatus, type CaregiverSeverity } from '@/lib/notifications/caregiver';
import { useAppStore } from '@/store/appStore';
import { usePillboxStore } from '@/store/usePillboxStore';
import type { GlucoseLog, LogEntry, MoodLog, SleepLog } from '@/types';
import {
  GearIcon,
  ChatBubbleIcon,
  ReportIcon,
  DropIcon,
  AlertIcon,
  ChevronLeftIcon,
} from '@/components/ui/icons';

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

const SEVERITY_COLOR: Record<CaregiverSeverity, string> = {
  calm: 'var(--border)',
  warn: 'var(--amber)',
  urgent: 'var(--danger)',
};

export function CaregiverDashboard({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  const persons = useAppStore((s) => s.persons);
  const currentPersonId = useAppStore((s) => s.currentPersonId);
  const logs = useAppStore((s) => s.logs);
  const medications = useAppStore((s) => s.medications);
  const stockMap = usePillboxStore((s) => s.stock);
  const capMap = usePillboxStore((s) => s.capacity);

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

    const lastSleep = pLogs.filter((l): l is SleepLog => l.type === 'sleep').sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const lastMood = pLogs.filter((l): l is MoodLog => l.type === 'mood').sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const recent = [...pLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);

    return { latest, avg, inRange, weekCount: vals.length, adherence, lastSleep, lastMood, recent, hasData: pLogs.length > 0 };
  }, [patient, logs, medications]);

  const status = useMemo(
    () =>
      caregiverPatientStatus(logs, medications, patient?.id ?? '', new Date(), {
        stock: stockMap,
        capacity: capMap,
        lastCheckinDate: null,
      }),
    [logs, medications, patient, stockMap, capMap],
  );

  if (!patient) return null;

  const bannerColor = SEVERITY_COLOR[status.severity];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-base no-scrollbar">
      {/* header */}
      <header className="relative border-b border-border bg-bg-surface px-5 pb-4 pt-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={es.caregiver.back}
            className="touch-target absolute left-2 top-4 grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
          >
            <ChevronLeftIcon size={24} />
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label={es.settings.title}
          className="touch-target absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
        >
          <GearIcon size={23} />
        </button>

        <div className={`flex items-center gap-3 ${onBack ? 'pl-10' : ''} pr-12`}>
          <Avatar name={patient.name} color={patient.color} size={52} />
          <div className="min-w-0">
            <p className="eyebrow">{es.caregiver.relationLabel(patient.relation)}</p>
            <h1 className="font-serif text-2xl font-bold leading-tight text-text-primary">{patient.name}</h1>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 pb-6 pt-4">
        {!data.hasData ? (
          <p className="rounded-lg border border-border bg-bg-surface p-5 text-center text-[15px] leading-relaxed text-text-secondary shadow-soft">
            {es.caregiver.noData}
          </p>
        ) : (
          <>
            {/* status banner */}
            <section
              className="rounded-lg border p-4 shadow-soft"
              style={{
                borderColor: bannerColor,
                background: status.severity === 'calm' ? 'var(--bg-surface)' : 'var(--amber-tint)',
              }}
            >
              <p className="eyebrow flex items-center gap-1.5" style={{ color: status.severity === 'calm' ? undefined : bannerColor }}>
                <AlertIcon size={14} /> {es.caregiver.alertsTitle}
              </p>
              {status.alerts.length ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {status.alerts.map((a, i) => (
                    <li key={i} className="text-[15px] font-semibold text-text-primary">
                      {a.text}
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

        {/* quick links — scoped to currentPersonId, so each patient's reports open */}
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
