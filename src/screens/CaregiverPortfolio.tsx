/**
 * CaregiverPortfolio — the caregiver Inicio. A warm, scannable overview of
 * EVERY person the carer follows: one card each with a traffic-light status
 * chip (derived from caregiverPatientStatus), two mini-vitals, and alert badges
 * for anything that needs attention (high sugar, forgotten pill, low stock,
 * concerning symptom). Tapping a card selects that patient (currentPersonId)
 * and opens the per-patient detail (CaregiverDashboard) — from which each
 * patient's journal and report are reachable.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { uid } from '@/lib/id';
import {
  caregiverPatientStatus,
  type CaregiverAlertKind,
  type CaregiverSeverity,
} from '@/lib/notifications/caregiver';
import { useAppStore } from '@/store/appStore';
import { usePillboxStore } from '@/store/usePillboxStore';
import type { GlucoseLog, LogEntry, Medication, Person } from '@/types';
import { GearIcon, PlusIcon, CheckIcon, ChevronRightIcon, AlertIcon } from '@/components/ui/icons';
import { CaregiverDashboard } from '@/screens/CaregiverDashboard';

const PALETTE = ['#1F6699', '#2E7D6B', '#8A5CC0', '#C06A3A'];

const SEVERITY_STYLE: Record<CaregiverSeverity, { label: string; fg: string; bg: string }> = {
  calm: { label: es.caregiver.statusCalm, fg: 'var(--cyan)', bg: 'var(--bg-sunken)' },
  warn: { label: es.caregiver.statusWarn, fg: 'var(--amber)', bg: 'var(--amber-tint)' },
  urgent: { label: es.caregiver.statusUrgent, fg: 'var(--danger)', bg: 'var(--amber-tint)' },
};

const BADGE_LABEL: Record<CaregiverAlertKind, string> = {
  redFlag: es.caregiver.badgeRedFlag,
  high: es.caregiver.badgeHigh,
  forgotPill: es.caregiver.badgeForgotPill,
  stock: es.caregiver.badgeStock,
};

function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
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

function patientVitals(logs: LogEntry[], medications: Medication[], personId: string) {
  const latest = logs
    .filter((l): l is GlucoseLog => l.type === 'glucose' && l.personId === personId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recs = medications
    .filter((m) => m.personId === personId)
    .flatMap((m) => m.adherenceLog)
    .filter((r) => new Date(`${r.date}T12:00:00`).getTime() >= cutoff);
  const adherence = recs.length ? Math.round((recs.filter((r) => r.taken).length / recs.length) * 100) : null;

  return { latestGlucose: latest?.payload.value ?? null, adherence };
}

export function CaregiverPortfolio() {
  const navigate = useNavigate();
  const persons = useAppStore((s) => s.persons);
  const logs = useAppStore((s) => s.logs);
  const medications = useAppStore((s) => s.medications);
  const stockMap = usePillboxStore((s) => s.stock);
  const capMap = usePillboxStore((s) => s.capacity);

  const [viewing, setViewing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const cards = useMemo(() => {
    const now = new Date();
    const ctx = { stock: stockMap, capacity: capMap, lastCheckinDate: null };
    return persons.map((p) => ({
      person: p,
      status: caregiverPatientStatus(logs, medications, p.id, now, ctx),
      vitals: patientVitals(logs, medications, p.id),
    }));
  }, [persons, logs, medications, stockMap, capMap]);

  const attentionCount = cards.filter((c) => c.status.severity !== 'calm').length;

  const openPatient = (p: Person) => {
    useAppStore.setState({ currentPersonId: p.id });
    setViewing(true);
  };

  const addPatient = () => {
    const name = newName.trim();
    if (!name) return;
    const id = uid('person');
    const color = PALETTE[persons.length % PALETTE.length];
    useAppStore.setState((s) => ({ persons: [...s.persons, { id, name, relation: 'mother', color }] }));
    setNewName('');
    setAdding(false);
  };

  if (viewing) return <CaregiverDashboard onBack={() => setViewing(false)} />;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-base no-scrollbar">
      {/* header */}
      <header className="relative border-b border-border bg-bg-surface px-5 pb-4 pt-6">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label={es.settings.title}
          className="touch-target absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
        >
          <GearIcon size={23} />
        </button>

        <p className="eyebrow">{es.caregiver.portfolioTitle}</p>
        <h1 className="font-serif text-2xl font-bold leading-tight text-text-primary">
          {es.caregiver.portfolioCount(persons.length)}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: attentionCount ? 'var(--amber)' : 'var(--text-secondary)' }}>
          {attentionCount ? (
            <>
              <AlertIcon size={15} /> {es.caregiver.needsAttention(attentionCount)}
            </>
          ) : (
            es.caregiver.portfolioAllCalm
          )}
        </p>
      </header>

      <div className="flex flex-col gap-3 px-5 pb-6 pt-4">
        {cards.map(({ person, status, vitals }) => {
          const sev = SEVERITY_STYLE[status.severity];
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => openPatient(person)}
              aria-label={es.caregiver.openPatient(person.name)}
              className="press flex flex-col gap-3 rounded-lg border bg-bg-surface p-4 text-left shadow-soft"
              style={{ borderColor: status.severity === 'calm' ? 'var(--border)' : sev.fg }}
            >
              <div className="flex items-center gap-3">
                <Avatar name={person.name} color={person.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-bold leading-tight text-text-primary">{person.name}</p>
                  <p className="text-xs font-semibold text-text-secondary">{es.caregiver.relationLabel(person.relation)}</p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ color: sev.fg, background: sev.bg }}
                >
                  {sev.label}
                </span>
                <ChevronRightIcon size={18} className="text-text-tertiary" />
              </div>

              {/* mini vitals */}
              <div className="flex gap-2">
                <span className="flex-1 rounded-md bg-bg-sunken px-3 py-2">
                  <span className="block text-lg font-extrabold leading-none text-text-primary">
                    {vitals.latestGlucose != null ? vitals.latestGlucose : '—'}
                    {vitals.latestGlucose != null && <span className="ml-0.5 text-[10px] font-bold text-text-tertiary">mg/dL</span>}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-text-secondary">{es.caregiver.latestGlucose}</span>
                </span>
                <span className="flex-1 rounded-md bg-bg-sunken px-3 py-2">
                  <span className="block text-lg font-extrabold leading-none text-text-primary">
                    {vitals.adherence != null ? `${vitals.adherence}%` : '—'}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-text-secondary">{es.caregiver.adherence}</span>
                </span>
              </div>

              {/* alert badges */}
              {status.alerts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {status.alerts.map((a, i) => (
                    <span
                      key={i}
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        color: a.kind === 'redFlag' ? 'var(--danger)' : 'var(--amber)',
                        background: 'var(--amber-tint)',
                      }}
                    >
                      {BADGE_LABEL[a.kind]}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}

        {/* add patient */}
        {adding ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong bg-bg-surface p-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPatient()}
              placeholder={es.caregiver.addPatientName}
              className="flex-1 rounded-full border border-border bg-bg-base px-4 py-2 text-sm focus-visible:outline-none"
            />
            <button type="button" onClick={addPatient} aria-label={es.caregiver.add} className="btn-primary press grid h-10 w-10 place-items-center rounded-full">
              <CheckIcon size={18} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="press flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-bg-surface py-3.5 text-sm font-bold text-deep-blue"
          >
            <PlusIcon size={18} /> {es.caregiver.addPatient}
          </button>
        )}
      </div>
    </div>
  );
}
