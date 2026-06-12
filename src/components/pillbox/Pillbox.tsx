/**
 * Pillbox — the visual pill organizer on Inicio. Each medication shows a
 * two-tone capsule, its frequency, today's dose compartments (tap a pending
 * one to mark it taken — which also decrements stock), and a stock meter with a
 * low-stock nudge + "Reponer". Reminder-first, warm, never punitive.
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { dateKey } from '@/lib/dateUtils';
import { useAppStore } from '@/store/appStore';
import { usePillboxStore } from '@/store/usePillboxStore';
import { CheckIcon } from '@/components/ui/icons';

/** "20:00" → "8:00 pm". */
function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const am = h < 12;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${am ? 'am' : 'pm'}`;
}

const CAPSULE_COLORS = ['var(--cyan)', 'var(--deep-blue)', 'var(--sky)'];

function Capsule({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 28 28" width="30" height="30" aria-hidden>
      <g transform="rotate(40 14 14)">
        <rect
          x="5"
          y="10.5"
          width="18"
          height="7"
          rx="3.5"
          fill={color}
          opacity="0.22"
        />
        <path d="M5 14a3.5 3.5 0 0 1 3.5-3.5H14V17.5H8.5A3.5 3.5 0 0 1 5 14Z" fill={color} />
        <rect x="7" y="11.4" width="4.5" height="1.8" rx="0.9" fill="#fff" opacity="0.55" />
      </g>
    </svg>
  );
}

function DoseChip({
  time,
  taken,
  isNext,
  onTake,
}: {
  time: string;
  taken: boolean;
  isNext: boolean;
  onTake: () => void;
}) {
  if (taken) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-[14px] px-3 py-2 text-[13px] font-bold text-[color:var(--text-on-brand)]"
        style={{ background: 'var(--grad-cyan)' }}
      >
        <CheckIcon size={15} /> {fmtTime(time)}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onTake}
      aria-label={`${es.pillbox.take} ${fmtTime(time)}`}
      className="press inline-flex items-center gap-1.5 rounded-[14px] border-2 bg-bg-base px-3 py-2 text-[13px] font-bold transition-colors"
      style={{
        borderColor: isNext ? 'var(--cyan)' : 'var(--border)',
        color: isNext ? 'var(--cyan)' : 'var(--text-secondary)',
      }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: isNext ? 'var(--cyan)' : 'transparent', border: isNext ? 'none' : '2px solid var(--border-strong)' }}
      />
      {fmtTime(time)}
    </button>
  );
}

export function Pillbox() {
  const medications = useAppStore((s) => s.medications);
  const logMedicationTaken = useAppStore((s) => s.actions.logMedicationTaken);
  const stockMap = usePillboxStore((s) => s.stock);
  const capMap = usePillboxStore((s) => s.capacity);
  const decrement = usePillboxStore((s) => s.decrement);
  const refill = usePillboxStore((s) => s.refill);
  const [toast, setToast] = useState(false);

  const today = dateKey(new Date().toISOString());

  const items = useMemo(
    () =>
      medications.map((med) => {
        const slots = med.schedule.map((time) => {
          const rec = med.adherenceLog.find((r) => r.date === today && r.scheduledTime === time);
          return { time, taken: !!rec?.taken };
        });
        const nextIdx = slots.findIndex((s) => !s.taken);
        return { med, slots, nextIdx };
      }),
    [medications, today],
  );

  const take = (medId: string, time: string, alreadyTaken: boolean) => {
    if (alreadyTaken) return;
    logMedicationTaken(medId, { date: today, scheduledTime: time, taken: true });
    decrement(medId);
  };

  const doRefill = (medId: string) => {
    refill(medId);
    setToast(true);
    window.setTimeout(() => setToast(false), 1900);
  };

  return (
    <section className="relative rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{es.pillbox.title}</p>
          <p className="text-sm text-text-secondary">{es.pillbox.subtitle}</p>
        </div>
        <span className="text-2xl" aria-hidden>💊</span>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{es.pillbox.empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-[color:var(--border)]">
          {items.map(({ med, slots, nextIdx }, i) => {
            const stock = stockMap[med.id] ?? capMap[med.id] ?? 30;
            const capacity = capMap[med.id] ?? 30;
            const pct = Math.max(0, Math.min(100, (stock / capacity) * 100));
            const low = stock <= Math.max(6, capacity * 0.2);
            const out = stock === 0;
            const allTaken = nextIdx === -1;
            const color = CAPSULE_COLORS[i % CAPSULE_COLORS.length];

            return (
              <li key={med.id} className="flex flex-col gap-3 py-3.5 first:pt-1">
                {/* identity */}
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                    style={{ background: `color-mix(in srgb, ${color} 14%, var(--bg-surface))` }}
                  >
                    <Capsule color={color} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight text-text-primary">
                      {med.name} <span className="font-semibold text-text-secondary">{med.dose}</span>
                    </p>
                    <p className="text-[13px] text-text-tertiary">{med.frequency}</p>
                  </div>
                  {allTaken && (
                    <span className="rounded-full bg-[color:var(--cyan-tint)] px-2.5 py-1 text-[11px] font-bold text-cyan">
                      {es.pillbox.allTaken}
                    </span>
                  )}
                </div>

                {/* today's compartments */}
                <div className="flex flex-wrap items-center gap-2 pl-[56px]">
                  <span className="eyebrow mr-0.5">{es.pillbox.today}</span>
                  {slots.map((s, idx) => (
                    <DoseChip
                      key={s.time}
                      time={s.time}
                      taken={s.taken}
                      isNext={idx === nextIdx}
                      onTake={() => take(med.id, s.time, s.taken)}
                    />
                  ))}
                </div>

                {/* stock meter */}
                <div className="pl-[56px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-text-secondary">
                      {es.pillbox.stockOf(stock, capacity)}
                    </span>
                    {low && (
                      <button
                        type="button"
                        onClick={() => doRefill(med.id)}
                        className="press rounded-full border border-border bg-bg-base px-3 py-1 text-[12px] font-bold text-deep-blue"
                      >
                        {es.pillbox.refill}
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-sunken">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: low ? 'var(--amber)' : 'var(--grad-cyan)' }}
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 28 }}
                    />
                  </div>
                  {low && (
                    <p className="mt-1 text-[12px] font-semibold" style={{ color: 'var(--amber)' }}>
                      {out ? es.pillbox.out : es.pillbox.low}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-text-primary px-4 py-2 text-sm font-bold text-bg-surface shadow-soft-lg"
          >
            {es.pillbox.refilled}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
