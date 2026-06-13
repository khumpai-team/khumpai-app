/**
 * A single chat bubble. Khumpi speaks on the left in a soft white card with a
 * hairline border and a small tail; the user replies on the right in a solid
 * teal-gradient bubble. Body text is ≥16px. While streaming, a thin teal caret
 * trails the text.
 */

import { motion } from 'framer-motion';
import type { ChatRole } from '@/agent/AgentProvider';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';

const reveal = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

export function MessageBubble({
  role,
  text,
  streaming,
  pending,
  imageUrl,
}: {
  role: ChatRole;
  text: string;
  streaming?: boolean;
  /** Captured offline, waiting to sync — shows an amber dot. */
  pending?: boolean;
  /** Attached photo thumbnail (user messages). */
  imageUrl?: string;
}) {
  const isKhumpi = role === 'khumpi';

  if (isKhumpi) {
    return (
      <motion.div {...reveal} className="flex items-end gap-2.5">
        <span className="mb-0.5 grid h-12 w-12 shrink-0 place-items-center">
          <KhumpiAvatar state="happy" size={48} head />
        </span>
        <div className="max-w-[80%] rounded-[20px] rounded-bl-[7px] border border-border bg-[color:var(--bubble-khumpi)] px-4 py-2.5 text-[16px] leading-relaxed text-text-primary shadow-soft">
          {text}
          {streaming && (
            <motion.span
              aria-hidden
              className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] rounded-full align-middle"
              style={{ background: 'var(--cyan)' }}
              animate={{ opacity: [1, 0.15, 1] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...reveal} className="flex items-end justify-end gap-1.5">
      {pending && (
        <span
          className="mb-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: 'var(--amber)' }}
          title="Pendiente de sincronizar"
          aria-label="Pendiente de sincronizar"
        />
      )}
      <div
        className="max-w-[80%] overflow-hidden rounded-[20px] rounded-br-[7px] text-[16px] font-medium leading-relaxed text-[color:var(--bubble-user-text)] shadow-soft"
        style={{ background: 'linear-gradient(135deg, var(--bubble-user-from), var(--bubble-user-to))' }}
      >
        {imageUrl && (
          <img src={imageUrl} alt="" className="block max-h-52 w-full max-w-[230px] object-cover" />
        )}
        {text && <div className={imageUrl ? 'px-4 py-2' : 'px-4 py-2.5'}>{text}</div>}
      </div>
    </motion.div>
  );
}
