/**
 * CheckinSheet — the morning check-in as three quick bottom-sheet steps:
 * sleep (4 bands), mood (5 emoji), stress (3 emoji). One tap each, no
 * confirmation card. Calls onComplete with the chosen values.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import type { MoodScore, StressLevel } from '@/types';

const SLEEP_HOURS = [4.5, 5.5, 7.5, 8.5];
const MOOD_EMOJI = ['😢', '😟', '😐', '🙂', '😄'];
const STRESS_EMOJI = ['😌', '😐', '😣'];

type Phase = 'sleep' | 'mood' | 'stress';

export function CheckinSheet({
  onComplete,
  onSkip,
}: {
  onComplete: (sleepHours: number, mood: MoodScore, stress: StressLevel) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('sleep');
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [mood, setMood] = useState<MoodScore | null>(null);

  const pickSleep = (h: number) => {
    setSleepHours(h);
    setPhase('mood');
  };
  const pickMood = (m: MoodScore) => {
    setMood(m);
    setPhase('stress');
  };
  const pickStress = (st: StressLevel) => {
    onComplete(sleepHours ?? 7, mood ?? 3, st);
  };

  const title =
    phase === 'sleep' ? es.checkin.sleepTitle : phase === 'mood' ? es.checkin.moodTitle : es.checkin.stressTitle;
  const stepIndex = phase === 'sleep' ? 0 : phase === 'mood' ? 1 : 2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-[#0b1a24]/45" />
      <motion.div
        key={phase}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full max-w-phone rounded-t-xl bg-bg-surface p-5 pb-7 shadow-soft-xl"
      >
        {/* progress dots */}
        <div className="mb-3 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === stepIndex ? 20 : 8, background: i <= stepIndex ? 'var(--cyan)' : 'var(--border)' }}
            />
          ))}
        </div>

        <h2 className="text-center font-serif text-xl font-bold text-text-primary">{title}</h2>

        {phase === 'sleep' && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {es.checkin.sleepBands.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => pickSleep(SLEEP_HOURS[i])}
                className="touch-target rounded-lg border border-border bg-bg-base py-4 text-[15px] font-bold text-text-primary transition-transform active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {phase === 'mood' && (
          <div className="mt-4 flex justify-between gap-1">
            {MOOD_EMOJI.map((e, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickMood((i + 1) as MoodScore)}
                aria-label={es.checkin.moodLabels[i]}
                className="touch-target flex flex-1 flex-col items-center gap-1 rounded-lg py-3 text-3xl transition-transform active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {phase === 'stress' && (
          <div className="mt-4 flex justify-center gap-3">
            {STRESS_EMOJI.map((e, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickStress((i + 1) as StressLevel)}
                className="touch-target flex flex-1 flex-col items-center gap-1.5 rounded-lg border border-border bg-bg-base py-4 text-3xl transition-transform active:scale-95"
              >
                {e}
                <span className="text-xs font-bold text-text-secondary">{es.checkin.stressLabels[i]}</span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onSkip}
          className="mt-4 w-full py-2 text-center text-sm font-semibold text-text-tertiary"
        >
          {es.checkin.skip}
        </button>
      </motion.div>
    </motion.div>
  );
}
