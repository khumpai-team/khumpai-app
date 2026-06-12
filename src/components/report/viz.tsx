/**
 * Report data-viz primitives — hand-built SVG (no chart library), theme-aware
 * via CSS vars, animated on reveal, and reduced-motion friendly. Designed for a
 * clinical "time-in-range" report: a progress Ring, a stacked RangeBar, a
 * glucose TrendChart with the target band, and per-moment MomentBars.
 */

import { motion, useReducedMotion } from 'framer-motion';

// --- Ring: circular progress (e.g. % in range, adherence) -----------------

export function Ring({
  pct,
  color = 'var(--cyan)',
  size = 96,
  label,
  sublabel,
}: {
  pct: number;
  color?: string;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const reduce = useReducedMotion();
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth="10" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - clamped / 100) : c }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-xl font-extrabold text-text-primary">{label ?? `${Math.round(clamped)}%`}</span>
        {sublabel && <span className="mt-0.5 text-[10px] font-semibold text-text-tertiary">{sublabel}</span>}
      </div>
    </div>
  );
}

// --- RangeBar: stacked low / in-range / high -------------------------------

export function RangeBar({ low, inRange, high }: { low: number; inRange: number; high: number }) {
  const reduce = useReducedMotion();
  const segs = [
    { pct: low, color: 'var(--deep-blue)' },
    { pct: inRange, color: 'var(--cyan)' },
    { pct: high, color: 'var(--amber)' },
  ];
  return (
    <div className="flex h-4 w-full overflow-hidden rounded-full bg-bg-sunken">
      {segs.map((s, i) => (
        <motion.div
          key={i}
          initial={{ width: reduce ? `${s.pct}%` : 0 }}
          animate={{ width: `${s.pct}%` }}
          transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: s.color }}
        />
      ))}
    </div>
  );
}

// --- TrendChart: glucose over the period, with the target band -------------

const W = 320;
const H = 150;
const PAD = { l: 8, r: 28, t: 14, b: 8 };

export function TrendChart({ points }: { points: { v: number; spike: boolean }[] }) {
  const reduce = useReducedMotion();
  if (points.length === 0) return null;

  const values = points.map((p) => p.v);
  const lo = Math.min(60, Math.min(...values) - 10);
  const hi = Math.max(220, Math.max(...values) + 10);
  const span = Math.max(1, hi - lo);

  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, points.length - 1);
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);

  const linePts = points.map((p, i) => `${x(i)},${y(p.v)}`).join(' ');
  const areaPts = `${PAD.l},${y(lo)} ${linePts} ${x(points.length - 1)},${y(lo)}`;
  const bandTop = y(180);
  const bandBottom = y(70);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Tendencia de tu azúcar">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* target band 70–180 */}
      <rect x="0" y={bandTop} width={W} height={Math.max(0, bandBottom - bandTop)} fill="var(--sky)" opacity="0.16" />
      <line x1="0" y1={bandTop} x2={W} y2={bandTop} stroke="var(--sky)" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
      <line x1="0" y1={bandBottom} x2={W} y2={bandBottom} stroke="var(--sky)" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
      <text x={W - PAD.r + 4} y={bandTop + 3} fontSize="9" fontWeight="700" fill="var(--text-tertiary)">180</text>
      <text x={W - PAD.r + 4} y={bandBottom + 3} fontSize="9" fontWeight="700" fill="var(--text-tertiary)">70</text>

      {points.length > 1 && (
        <>
          <motion.polygon
            points={areaPts}
            fill="url(#trend-fill)"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
          <motion.polyline
            points={linePts}
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
        </>
      )}

      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={x(i)}
          cy={y(p.v)}
          r={p.spike ? 4.5 : 3}
          fill={p.spike ? 'var(--amber)' : 'var(--cyan)'}
          stroke="var(--bg-surface)"
          strokeWidth="1.5"
          initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: reduce ? 0 : 0.3 + i * 0.04, type: 'spring', stiffness: 500, damping: 20 }}
        />
      ))}
    </svg>
  );
}

// --- MomentBars: average by time-of-day ------------------------------------

export function MomentBars({
  rows,
}: {
  rows: { key: string; label: string; avg: number | null; status: 'low' | 'in' | 'high' }[];
}) {
  const reduce = useReducedMotion();
  const colorFor = (s: 'low' | 'in' | 'high') =>
    s === 'high' ? 'var(--amber)' : s === 'low' ? 'var(--deep-blue)' : 'var(--cyan)';
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <div key={r.key} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-[13px] font-semibold text-text-secondary">{r.label}</span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-bg-sunken">
            {r.avg != null && (
              <motion.div
                className="h-full rounded-md"
                initial={{ width: reduce ? `${Math.min(100, (r.avg / 260) * 100)}%` : 0 }}
                animate={{ width: `${Math.min(100, (r.avg / 260) * 100)}%` }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: colorFor(r.status) }}
              />
            )}
          </div>
          <span
            className="w-12 shrink-0 text-right text-[14px] font-extrabold"
            style={{ color: r.avg == null ? 'var(--text-tertiary)' : colorFor(r.status) }}
          >
            {r.avg != null ? r.avg : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
