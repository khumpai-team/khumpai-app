/**
 * HomeScreen — deliberately NOT a dashboard. A warm greeting, the visual
 * pastillero (pill organizer + reminders), a compassionate "your week" note
 * (days you shared — never missed days, never streaks), and a big invitation
 * to talk to Khumpi.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { dateKey } from '@/lib/dateUtils';
import { useAppStore } from '@/store/appStore';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { Pillbox } from '@/components/pillbox/Pillbox';
import { CaregiverPortfolio } from '@/screens/CaregiverPortfolio';
import { GearIcon, ChatBubbleIcon } from '@/components/ui/icons';
import { runPatternDetection } from '@/agent/tools';
import { Ring, Sparkline } from '@/components/report/viz';
import type { GlucoseLog, SleepLog } from '@/types';

/** Inicio routes to the patient home or the caregiver portfolio by front. */
export function HomeScreen() {
  const mode = useAppStore((s) => s.mode);
  return mode === 'caregiver' ? <CaregiverPortfolio /> : <PatientHome />;
}

/** "20:00" → "8:00 pm". */
function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const am = h < 12;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${am ? 'am' : 'pm'}`;
}

function greetByHour(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return es.home.greetMorning(name);
  if (h < 19) return es.home.greetAfternoon(name);
  return es.home.greetEvening(name);
}

function PatientHome() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const logs = useAppStore((s) => s.logs);
  const medications = useAppStore((s) => s.medications);
  const achievements = useAppStore((s) => s.achievements);
  const currentPersonId = useAppStore((s) => s.currentPersonId);

  const med = medications[0];
  const today = dateKey(new Date().toISOString());

  const nextPending = useMemo(() => {
    if (!med) return undefined;
    return med.schedule
      .map((time) => ({
        time,
        taken: !!med.adherenceLog.find((r) => r.date === today && r.scheduledTime === time)?.taken,
      }))
      .find((d) => !d.taken);
  }, [med, today]);

  const lastSleep = useMemo(() => {
    const sleeps = logs.filter((l): l is SleepLog => l.type === 'sleep');
    return sleeps.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  }, [logs]);

  const weekDays = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const days = new Set(
      logs.filter((l) => new Date(l.timestamp).getTime() >= cutoff).map((l) => dateKey(l.timestamp)),
    );
    return days.size;
  }, [logs]);

  // A pattern from the user's OWN data (honest about sample size; null when sparse).
  const insight = useMemo(
    () => runPatternDetection(logs, currentPersonId),
    [logs, currentPersonId],
  );

  // At-a-glance glucose for the last 7 days (null when there are no readings).
  const glu = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const gs = logs
      .filter((l): l is GlucoseLog => l.type === 'glucose' && new Date(l.timestamp).getTime() >= cutoff)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (!gs.length) return null;
    const vals = gs.map((g) => g.payload.value);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const pctIn = Math.round((vals.filter((v) => v >= 70 && v <= 180).length / vals.length) * 100);
    return { avg, pctIn, latest: gs[gs.length - 1].payload.value, points: vals };
  }, [logs]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-base no-scrollbar">
      {/* greeting */}
      <header className="relative px-5 pb-2 pt-6">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label={es.settings.title}
          className="touch-target absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
        >
          <GearIcon size={23} />
        </button>

        <div className="flex items-center gap-3 pr-12">
          <KhumpiAvatar state="happy" size={64} />
          <div className="min-w-0">
            <h1 className="font-serif text-[22px] font-bold leading-tight text-text-primary">
              {greetByHour(user.name)}
            </h1>
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          {med && nextPending && <>{es.home.nextDoseLine(med.name, fmtTime(nextPending.time))} </>}
          {lastSleep && (lastSleep.payload.hours < 6 ? es.home.sleptLittle : es.home.restedWell)}
        </p>
      </header>

      <div className="flex flex-col gap-4 px-5 pb-6 pt-3">
        {/* at-a-glance glucose metrics */}
        {glu && (
          <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="eyebrow">{es.home.metrics.title}</p>
              <span className="text-xs font-semibold text-text-tertiary">{es.home.metrics.subtitle}</span>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <Ring pct={glu.pctIn} color={glu.pctIn >= 70 ? 'var(--cyan)' : 'var(--amber)'} size={88} sublabel={es.home.metrics.inRange} />
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-baseline justify-between border-b border-border pb-2">
                  <span className="text-sm font-semibold text-text-secondary">{es.home.metrics.latest}</span>
                  <span className="text-lg font-extrabold text-text-primary">
                    {glu.latest} <span className="text-xs font-bold text-text-tertiary">mg/dL</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-text-secondary">{es.home.metrics.avg}</span>
                  <span className="text-lg font-extrabold text-text-primary">
                    {glu.avg} <span className="text-xs font-bold text-text-tertiary">mg/dL</span>
                  </span>
                </div>
              </div>
            </div>
            {/* minimal historic trend */}
            <div className="mt-3">
              <Sparkline values={glu.points} color={glu.pctIn >= 70 ? 'var(--cyan)' : 'var(--amber)'} />
            </div>
          </section>
        )}

        {/* pastillero */}
        <Pillbox />

        {/* compassionate week */}
        <section className="rounded-lg border border-border bg-[color:var(--sky-tint)] p-4">
          <p className="eyebrow text-deep-blue">{es.home.weekTitle}</p>
          <p className="mt-1 text-[16px] font-semibold leading-relaxed text-text-primary">
            {weekDays > 0 ? es.home.weekCount(weekDays) : es.home.weekZero}
          </p>
        </section>

        {/* what Khumpi is noticing — minimal note; full chart lives in the report */}
        {insight && (
          <button
            type="button"
            onClick={() => navigate('/report')}
            className="press rounded-lg border border-border bg-bg-surface p-4 text-left shadow-soft"
          >
            <p className="eyebrow text-deep-blue">🔍 {es.home.insightsTitle}</p>
            <p className="mt-1 text-[15px] leading-relaxed text-text-primary">{insight.text}</p>
            <span className="mt-1.5 inline-block text-xs font-bold text-deep-blue">{es.report.open} →</span>
          </button>
        )}

        {/* celebration-only achievements (never streaks / missed days) */}
        {achievements.length > 0 && (
          <section className="rounded-lg border border-border bg-bg-surface p-4">
            <p className="eyebrow text-text-secondary">{es.home.achievementsTitle}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {achievements.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-bg-sunken px-3 py-1.5 text-[13px] font-semibold text-text-primary"
                >
                  <span aria-hidden>🏅</span> {a.title}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* big CTA */}
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="press btn-primary touch-target mt-1 flex items-center justify-center gap-2 rounded-full py-4 text-[17px] font-bold"
        >
          <ChatBubbleIcon size={22} /> {es.home.cta}
        </button>
      </div>
    </div>
  );
}
