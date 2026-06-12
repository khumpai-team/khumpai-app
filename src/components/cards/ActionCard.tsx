/**
 * ActionCard — "one action". A single, gentle suggestion with one tap to accept
 * and one to decline. Declining is warm and guilt-free. Which suggestion shows
 * is personalized upstream (activity vs. food) from learned preferences.
 */

import { motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import type { ActionState } from '@/store/useChatStore';
import { CheckIcon } from '@/components/ui/icons';

export function ActionCard({
  text,
  acceptLabel,
  state,
  onAccept,
  onDecline,
}: {
  text: string;
  acceptLabel: string;
  state: ActionState;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const resolved = state !== 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      className="ml-10 w-[88%] max-w-[340px] overflow-hidden rounded-lg border border-border bg-bg-surface shadow-soft-lg"
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--cyan-tint)] text-cyan text-xl">
          💡
        </span>
        <p className="pt-0.5 text-[15px] leading-relaxed text-text-primary">{text}</p>
      </div>

      {state === 'pending' ? (
        <div className="flex gap-2 p-4 pt-3">
          <button
            type="button"
            onClick={onAccept}
            className="touch-target flex-1 rounded-full btn-primary px-4 text-[15px] font-bold text-[color:var(--text-on-brand)] transition-transform active:scale-95"
          >
            {acceptLabel}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="touch-target rounded-full border border-border bg-bg-base px-5 text-[15px] font-bold text-text-secondary transition-colors active:bg-bg-sunken"
          >
            {es.arc.decline}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 pb-4 pt-1 text-sm font-bold text-cyan">
          {state === 'accepted' ? (
            <>
              <CheckIcon size={16} /> {es.arc.acceptedReply}
            </>
          ) : (
            <span className="text-text-secondary">{es.arc.declinedReply}</span>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {resolved ? (state === 'accepted' ? es.arc.acceptedReply : es.arc.declinedReply) : ''}
      </span>
    </motion.div>
  );
}
