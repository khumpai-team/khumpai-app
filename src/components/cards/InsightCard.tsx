/**
 * InsightCard — "the why". Shows a detected pattern from the user's OWN data
 * with a hand-built SVG mini-chart (no chart library), sequential dot reveal,
 * and an always-visible HONESTY LABEL ("patrón claro · N coincidencias · no es
 * un diagnóstico"). Deep-blue "informed" accent for medical trust.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import type { Insight } from '@/types';

const W = 300;
const H = 116;
const PAD_X = 20;
const PAD_TOP = 22;
const PAD_BOTTOM = 18;

export function InsightCard({ insight }: { insight: Insight }) {
  const reduce = useReducedMotion();
  const data = insight.chartData;

  const values = data.map((d) => d.value);
  const lo = Math.min(...values, 90) - 8;
  const hi = Math.max(...values, 140) + 8;
  const span = Math.max(1, hi - lo);

  const x = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD_TOP + (1 - (v - lo) / span) * (H - PAD_TOP - PAD_BOTTOM);
  const isSpike = (cat?: string) => !!cat && /high/.test(cat);

  // "Good range" band (roughly fasting target 80–130 mg/dL).
  const bandTop = y(130);
  const bandBottom = y(80);

  const honesty =
    insight.confidence === 'clear' ? es.arc.honestyClear : es.arc.honestyPossible;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
      className="ml-10 w-[88%] max-w-[340px] overflow-hidden rounded-lg border border-border bg-bg-surface shadow-soft-lg"
    >
      <div className="border-b border-border bg-[color:var(--deep-blue-tint)] px-4 py-3">
        <p className="font-serif text-[15px] font-bold leading-tight text-deep-blue">
          {es.arc.insightHeader}
        </p>
      </div>

      <div className="px-4 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={insight.text}>
          {/* good-range band */}
          <rect
            x={PAD_X - 8}
            y={bandTop}
            width={W - 2 * (PAD_X - 8)}
            height={Math.max(0, bandBottom - bandTop)}
            fill="var(--sky)"
            opacity="0.16"
            rx="6"
          />
          {/* connecting line */}
          <polyline
            points={data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')}
            fill="none"
            stroke="var(--border)"
            strokeWidth="2"
          />
          {/* dots, revealed sequentially */}
          {data.map((d, i) => {
            const spike = isSpike(d.category);
            const color = spike ? 'var(--amber)' : 'var(--cyan)';
            const delay = reduce ? 0 : 0.12 + i * 0.12;
            return (
              <motion.g
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay, type: 'spring', stiffness: 460, damping: 18 }}
                style={{ transformOrigin: `${x(i)}px ${y(d.value)}px` }}
              >
                {spike && <circle cx={x(i)} cy={y(d.value)} r="10" fill={color} opacity="0.22" />}
                <circle cx={x(i)} cy={y(d.value)} r={spike ? 6.5 : 5.5} fill={color} />
                <text
                  x={x(i)}
                  y={y(d.value) - 11}
                  textAnchor="middle"
                  className="font-sans"
                  fontSize="10.5"
                  fontWeight="700"
                  fill={spike ? 'var(--amber)' : 'var(--text-secondary)'}
                >
                  {d.value}
                </text>
              </motion.g>
            );
          })}
        </svg>

        {/* legend */}
        <div className="mt-1 flex items-center justify-center gap-4 text-[11px] font-semibold text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--amber)' }} />
            Dormiste poco
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--cyan)' }} />
            Descansaste bien
          </span>
        </div>
      </div>

      <p className="px-4 pt-3 text-[15px] leading-relaxed text-text-primary">{insight.text}</p>

      {/* honesty label — ALWAYS visible */}
      <div className="m-4 mt-3 flex items-start gap-2 rounded-md bg-bg-sunken px-3 py-2 text-xs font-semibold text-text-secondary">
        <span aria-hidden>🔍</span>
        <span>
          {honesty} {es.arc.honestyTail(insight.basedOnCount)}
        </span>
      </div>
    </motion.div>
  );
}
