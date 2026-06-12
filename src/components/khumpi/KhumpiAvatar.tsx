/**
 * KhumpiAvatar — the official mascot, alive.
 *
 * Renders the transparent mascot PNGs (one per expression) and brings him to
 * life with framer-motion: a gentle float + breathing + sway, a ground shadow
 * that squashes as he rises, and per-state touches (thinking dots, listening
 * pulse). When `idle` is false (tiny repeated avatars) or the user prefers
 * reduced motion, he holds still — only a soft entrance.
 *
 * Mascot cutouts are generated from /assets by scripts/cutout.mjs.
 */

import { motion, useReducedMotion } from 'framer-motion';
import khumpiHappy from '@/assets/khumpi/khumpi-1.png';
import khumpiCalm from '@/assets/khumpi/khumpi-2.png';
import khumpiThinking from '@/assets/khumpi/khumpi-3.png';
import khumpiListening from '@/assets/khumpi/khumpi-4.png';
import khumpiInformed from '@/assets/khumpi/khumpi-5.png';

export type KhumpiState = 'happy' | 'calm' | 'informed' | 'listening' | 'thinking';

const SRC: Record<KhumpiState, string> = {
  happy: khumpiHappy,
  calm: khumpiCalm,
  informed: khumpiInformed,
  listening: khumpiListening,
  thinking: khumpiThinking,
};

interface Props {
  state?: KhumpiState;
  size?: number;
  /** Disable the living idle loop (e.g. tiny header/nav/bubble avatars). */
  idle?: boolean;
  /** Crop to a head-and-shoulders portrait (for chat bubble avatars). */
  head?: boolean;
  className?: string;
  title?: string;
}

export function KhumpiAvatar({ state = 'happy', size = 96, idle = true, head = false, className, title = 'Khumpi' }: Props) {
  const reduce = useReducedMotion();
  const live = idle && !reduce && !head;

  // Head-and-shoulders crop: zoom in and clip to a circle. `maxWidth:none` is
  // required to defeat Tailwind preflight's `img{max-width:100%}`, which would
  // otherwise clamp the zoom and show the whole body. A gentle breathing keeps
  // him alive without drifting out of the clip.
  if (head) {
    const breathe = idle && !reduce;
    return (
      <div
        className={className}
        style={{ position: 'relative', width: size, height: size, overflow: 'hidden', borderRadius: '9999px' }}
      >
        <motion.img
          src={SRC[state]}
          alt={title}
          draggable={false}
          style={{ position: 'absolute', width: size * 2.4, maxWidth: 'none', height: 'auto', left: '50%', top: size * -0.08, transformOrigin: 'center' }}
          initial={{ x: '-50%' }}
          animate={breathe ? { x: '-50%', scale: [1, 1.045, 1] } : { x: '-50%' }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    );
  }

  // Pacing & amplitude vary by mood — happy is bouncier, calm is slow.
  const dur = state === 'happy' ? 2.7 : state === 'calm' ? 4 : 3.3;
  const floatY = Math.max(2, size * 0.04);
  const sway = state === 'calm' ? 0.8 : 1.6;

  return (
    <div className={className} style={{ position: 'relative', width: size, height: size }}>
      {/* ground shadow — shrinks/fades as he floats up */}
      <motion.span
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: size * 0.015,
          width: size * 0.52,
          height: size * 0.09,
          borderRadius: '50%',
          background: 'rgba(15,36,41,0.18)',
          filter: 'blur(3px)',
          translateX: '-50%',
        }}
        animate={live ? { scaleX: [1, 0.82, 1], opacity: [0.5, 0.3, 0.5] } : undefined}
        transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.img
        src={SRC[state]}
        alt={title}
        width={size}
        height={size}
        draggable={false}
        style={{ position: 'relative', display: 'block', width: size, height: size, objectFit: 'contain' }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86 }}
        animate={
          live
            ? { opacity: 1, scale: 1, y: [0, -floatY, 0], rotate: [-sway, sway, -sway] }
            : { opacity: 1, scale: 1, y: 0, rotate: 0 }
        }
        transition={
          live
            ? {
                opacity: { duration: 0.3 },
                scale: { type: 'spring', stiffness: 260, damping: 18 },
                y: { duration: dur, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: dur * 1.7, repeat: Infinity, ease: 'easeInOut' },
              }
            : { duration: 0.3, ease: 'easeOut' }
        }
      />

      {/* thinking: little bouncing dots */}
      {state === 'thinking' && (
        <div className="absolute" style={{ top: size * 0.02, right: -size * 0.04, display: 'flex', gap: size * 0.05 }}>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              style={{ width: size * 0.08, height: size * 0.08, borderRadius: '50%', background: 'var(--cyan)' }}
              animate={reduce ? { opacity: 0.7 } : { y: [0, -size * 0.06, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}

      {/* listening: soft pulse rings */}
      {state === 'listening' &&
        !reduce &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid var(--cyan)' }}
            initial={{ opacity: 0.5, scale: 0.9 }}
            animate={{ opacity: 0, scale: 1.25 }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ))}
    </div>
  );
}
