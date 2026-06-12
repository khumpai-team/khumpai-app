/**
 * OfflineBanner — amber while offline ("guardo todo aquí…"), and a brief green
 * confirmation while reconnecting/synced. Amber is our warning color; this is
 * reassuring, never alarming.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';

export function OfflineBanner({
  offline,
  reconnectCount,
}: {
  offline: boolean;
  /** When set (>=0), shows the green "synced N" banner instead. */
  reconnectCount: number | null;
}) {
  const show = offline || reconnectCount !== null;
  const isReconnect = reconnectCount !== null;
  const bg = isReconnect ? 'var(--cyan)' : 'var(--amber)';
  const text = isReconnect
    ? reconnectCount && reconnectCount > 0
      ? es.offline.reconnecting(reconnectCount)
      : es.offline.reconnected
    : es.offline.banner;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
          role="status"
        >
          <div
            className="px-4 py-2 text-center text-[13px] font-semibold text-[color:var(--text-on-brand)]"
            style={{ background: bg }}
          >
            {text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
