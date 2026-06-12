/**
 * Typing indicator shown while Khumpi is "thinking" — reuses the thinking
 * avatar state plus three bouncing dots in a bubble.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { es } from '@/data/i18n/es';

export function TypingIndicator() {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-end gap-2" role="status" aria-label={es.chat.statusThinking}>
      <span className="mb-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--cyan-tint)]">
        <KhumpiAvatar state="thinking" size={26} idle={false} />
      </span>
      <div className="flex items-center gap-1.5 rounded-lg rounded-bl-sm bg-[color:var(--bubble-khumpi)] px-4 py-3 shadow-soft">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-cyan"
            animate={reduce ? undefined : { y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}
