/**
 * HomeScreen — deliberately NOT a dashboard. A warm greeting, one gentle pill
 * reminder, a compassionate "your week" note (count of days you shared —
 * never missed days, never streaks), and a big invitation to talk to Khumpi.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { dateKey } from '@/lib/dateUtils';
import { useAppStore } from '@/store/appStore';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { GearIcon, PillIcon, CheckIcon, ChatBubbleIcon } from '@/components/ui/icons';
import type { SleepLog } from '@/types';

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

export function HomeScreen() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const logs = useAppStore((s) => s.logs);
  const medications = useAppStore((s) => s.medications);
  const actions = useAppStore((s) => s.actions);

  const med = medications[0];
  const today = dateKey(new Date().toISOString());

  const doses = useMemo(
    () =>
      med?.schedule.map((time) => {
        const rec = med.adherenceLog.find((r) => r.date === today && r.scheduledTime === time);
        return { time, taken: !!rec?.taken };
      }) ?? [],
    [med, today],
  );
  const nextPending = doses.find((d) => !d.taken);

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

  const confirmDose = () => {
    if (!med || !nextPending) return;
    actions.logMedicationTaken(med.id, { date: today, scheduledTime: nextPending.time, taken: true });
  };

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
        {/* pill reminder */}
        {med && (
          <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--cyan-tint)] text-cyan">
                <PillIcon size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  {es.home.pillTitle}
                </p>
                <p className="font-bold text-text-primary">
                  {med.name} {med.dose}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              {nextPending ? (
                <>
                  <span className="text-sm font-semibold text-text-secondary">
                    {es.home.nextTake(fmtTime(nextPending.time))}
                  </span>
                  <button
                    type="button"
                    onClick={confirmDose}
                    className="touch-target rounded-full bg-cyan px-4 py-2 text-sm font-bold text-[color:var(--text-on-brand)] shadow-cyan-glow transition-transform active:scale-95"
                  >
                    {es.home.markTaken}
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-bold text-cyan">
                  <CheckIcon size={17} /> {es.home.allDone}
                </span>
              )}
            </div>
          </section>
        )}

        {/* compassionate week */}
        <section className="rounded-lg border border-border bg-[color:var(--sky-tint)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-deep-blue">
            {es.home.weekTitle}
          </p>
          <p className="mt-1 text-[16px] font-semibold leading-relaxed text-text-primary">
            {weekDays > 0 ? es.home.weekCount(weekDays) : es.home.weekZero}
          </p>
        </section>

        {/* big CTA */}
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="touch-target mt-1 flex items-center justify-center gap-2 rounded-full bg-cyan py-4 text-[17px] font-bold text-[color:var(--text-on-brand)] shadow-cyan-glow transition-transform active:scale-95"
        >
          <ChatBubbleIcon size={22} /> {es.home.cta}
        </button>
      </div>
    </div>
  );
}
