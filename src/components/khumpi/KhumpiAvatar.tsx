/**
 * KhumpiAvatar — the app's robot companion, drawn as a single inline SVG so it
 * scales crisply from a 40px header chip to a hero on the welcome screen.
 *
 * Five states change the accent color and the face/props:
 *   happy     — cyan accents, bright open eyes
 *   calm      — sky accents, relaxed closed eyes
 *   informed  — deep-blue accents, holding a tiny report
 *   listening — sound waves pulsing beside the head
 *   thinking  — bouncing dots above the head
 *
 * An idle "breathing" animation (scale 1 → 1.02, 3s) gives it a soft pulse,
 * disabled when the user prefers reduced motion.
 */

import { motion, useReducedMotion } from 'framer-motion';

export type KhumpiState = 'happy' | 'calm' | 'informed' | 'listening' | 'thinking';

const ACCENTS: Record<KhumpiState, string> = {
  happy: '#45B0A8',
  calm: '#8DCDED',
  informed: '#1F6699',
  listening: '#45B0A8',
  thinking: '#45B0A8',
};

interface Props {
  state?: KhumpiState;
  size?: number;
  /** Disable breathing (e.g. tiny header avatar). */
  idle?: boolean;
  className?: string;
  title?: string;
}

export function KhumpiAvatar({
  state = 'happy',
  size = 96,
  idle = true,
  className,
  title = 'Khumpi',
}: Props) {
  const reduce = useReducedMotion();
  const accent = ACCENTS[state];
  const eyesClosed = state === 'calm';
  const lookUp = state === 'thinking' ? -2 : 0;

  return (
    <motion.svg
      role="img"
      aria-label={title}
      width={size}
      height={size * 1.1}
      viewBox="0 0 200 220"
      className={className}
      animate={idle && !reduce ? { scale: [1, 1.02, 1] } : undefined}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      style={{ transformOrigin: 'center', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="khumpi-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E4EFF8" />
        </linearGradient>
        <linearGradient id="khumpi-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E9F2F9" />
        </linearGradient>
        <radialGradient id="khumpi-shine" cx="38%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id="khumpi-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#1F6699" floodOpacity="0.16" />
        </filter>
      </defs>

      {/* soft accent aura */}
      <ellipse cx="100" cy="120" rx="92" ry="96" fill={accent} opacity="0.08" />

      {/* antenna */}
      <line x1="100" y1="30" x2="100" y2="14" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      <motion.circle
        cx="100"
        cy="11"
        r="6"
        fill={accent}
        animate={!reduce ? { opacity: [0.6, 1, 0.6] } : undefined}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <g filter="url(#khumpi-soft)">
        {/* body */}
        <rect x="48" y="96" width="104" height="108" rx="40" fill="url(#khumpi-body)" />
        {/* body panel lines */}
        <line x1="100" y1="150" x2="100" y2="190" stroke={accent} strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" />
        <line x1="70" y1="186" x2="86" y2="186" stroke="#1F6699" strokeOpacity="0.12" strokeWidth="3" strokeLinecap="round" />
        <line x1="114" y1="186" x2="130" y2="186" stroke="#1F6699" strokeOpacity="0.12" strokeWidth="3" strokeLinecap="round" />

        {/* chest emblem: water drop in a circle */}
        <circle cx="100" cy="148" r="22" fill="#FFFFFF" stroke={accent} strokeWidth="3.5" />
        <path
          d="M100 136 C107 145 110 150 110 155 a10 10 0 1 1 -20 0 c0 -5 3 -10 10 -19 Z"
          fill={accent}
        />
        <circle cx="96" cy="153" r="3" fill="#FFFFFF" opacity="0.75" />

        {/* side ear panels */}
        <rect x="40" y="56" width="14" height="34" rx="7" fill={accent} opacity="0.9" />
        <rect x="146" y="56" width="14" height="34" rx="7" fill={accent} opacity="0.9" />

        {/* head */}
        <rect x="54" y="28" width="92" height="80" rx="40" fill="url(#khumpi-head)" />
        <rect x="54" y="28" width="92" height="80" rx="40" fill="url(#khumpi-shine)" />

        {/* face */}
        <g transform={`translate(0 ${lookUp})`}>
          {eyesClosed ? (
            <>
              {/* relaxed closed eyes */}
              <path d="M74 66 Q84 74 94 66" stroke="#1A2E32" strokeWidth="4" fill="none" strokeLinecap="round" />
              <path d="M106 66 Q116 74 126 66" stroke="#1A2E32" strokeWidth="4" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* open eyes: white sclera, cyan iris, dark pupil, highlight */}
              {[84, 116].map((cx) => (
                <g key={cx}>
                  <ellipse cx={cx} cy="64" rx="13" ry="16" fill="#FFFFFF" stroke="#D4E4F0" strokeWidth="1" />
                  <circle cx={cx} cy="65" r="10" fill="#45B0A8" />
                  <circle cx={cx} cy="65" r="6.5" fill="#16323A" />
                  <circle cx={cx - 3} cy="61" r="2.6" fill="#FFFFFF" />
                  <circle cx={cx + 2.5} cy="68" r="1.3" fill="#FFFFFF" opacity="0.8" />
                </g>
              ))}
            </>
          )}

          {/* smile */}
          <path
            d="M86 90 Q100 100 114 90"
            stroke="#1A2E32"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* state-specific extras */}
      {state === 'thinking' && !reduce && (
        <g>
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={150 + i * 14}
              cy={36}
              r="4.5"
              fill={accent}
              animate={{ y: [0, -7, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </g>
      )}
      {state === 'thinking' && reduce && (
        <g>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={150 + i * 14} cy={36} r="4.5" fill={accent} opacity="0.8" />
          ))}
        </g>
      )}

      {state === 'listening' &&
        [0, 1].map((i) =>
          [-1, 1].map((dir) => (
            <motion.path
              key={`${i}-${dir}`}
              d={
                dir === -1
                  ? `M${44 - i * 12} ${52} q-10 ${16} 0 ${32}`
                  : `M${156 + i * 12} ${52} q10 ${16} 0 ${32}`
              }
              stroke={accent}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              animate={!reduce ? { opacity: [0.2, 0.9, 0.2] } : { opacity: 0.6 }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
            />
          )),
        )}

      {state === 'informed' && (
        <g transform="translate(120 150) rotate(8)" filter="url(#khumpi-soft)">
          {/* tiny report Khumpi holds */}
          <rect x="0" y="0" width="44" height="54" rx="6" fill="#FFFFFF" stroke={accent} strokeWidth="2.5" />
          <line x1="8" y1="12" x2="36" y2="12" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <line x1="8" y1="22" x2="30" y2="22" stroke="#1F6699" strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="8" y1="30" x2="34" y2="30" stroke="#1F6699" strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="8" y1="38" x2="26" y2="38" stroke="#1F6699" strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
    </motion.svg>
  );
}
