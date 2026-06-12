/**
 * A single chat bubble. Khumpi speaks on the left (white) with a small avatar;
 * the user replies on the right (sky). Body text is ≥16px for readability.
 */

import { motion } from 'framer-motion';
import type { ChatRole } from '@/agent/AgentProvider';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';

export function MessageBubble({
  role,
  text,
  streaming,
  pending,
}: {
  role: ChatRole;
  text: string;
  streaming?: boolean;
  /** Captured offline, waiting to sync — shows an amber dot. */
  pending?: boolean;
}) {
  const isKhumpi = role === 'khumpi';

  if (isKhumpi) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-end gap-2"
      >
        <span className="mb-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--cyan-tint)]">
          <KhumpiAvatar state="happy" size={26} idle={false} />
        </span>
        <div className="max-w-[80%] rounded-lg rounded-bl-sm bg-[color:var(--bubble-khumpi)] px-4 py-2.5 text-[16px] leading-relaxed text-text-primary shadow-soft">
          {text}
          {streaming && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-cyan align-middle" aria-hidden />}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-end justify-end gap-1.5"
    >
      {pending && (
        <span
          className="mb-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: 'var(--amber)' }}
          title="Pendiente de sincronizar"
          aria-label="Pendiente de sincronizar"
        />
      )}
      <div className="max-w-[80%] rounded-lg rounded-br-sm bg-[color:var(--bubble-user)] px-4 py-2.5 text-[16px] leading-relaxed text-[color:var(--bubble-user-text)] shadow-soft">
        {text}
      </div>
    </motion.div>
  );
}
