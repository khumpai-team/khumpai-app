/**
 * Typing indicator shown while Khumpi is "thinking" — the thinking avatar plus
 * three dots with a gentle, staggered breathing rhythm, in a bubble that
 * matches Khumpi's message style.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { es } from '@/data/i18n/es';

export function TypingIndicator() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-end gap-2.5"
      role="status"
      aria-label={es.chat.statusThinking}
    >
      <span className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--cyan-tint)] ring-1 ring-[color:var(--border)]">
        <KhumpiAvatar state="thinking" size={28} idle={false} />
      </span>
      <div className="flex items-center gap-1.5 rounded-[20px] rounded-bl-[7px] border border-border bg-[color:var(--bubble-khumpi)] px-4 py-3.5 shadow-soft">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ background: 'var(--cyan)' }}
            animate={reduce ? { opacity: 0.5 } : { y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </motion.div>
  );
}
