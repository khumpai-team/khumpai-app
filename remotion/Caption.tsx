/**
 * Caption — the right-hand explainer for a segment. A small kicker (step label),
 * a serif headline and a body line, sliding up with a soft spring as the segment
 * opens and easing out before it ends.
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_SERIF } from './lib/fonts';

export function Caption({
  kicker,
  title,
  body,
  durationInFrames,
}: {
  kicker: string;
  title: string;
  body?: string;
  /** Length of the parent segment, used to fade out near the end. */
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 110 }, durationInFrames: 24 });
  const y = interpolate(enter, [0, 1], [26, 0]);
  const outFade = interpolate(frame, [durationInFrames - 16, durationInFrames - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(enter, outFade);

  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, maxWidth: 620 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 22,
          padding: '8px 16px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.16)',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--cyan-soft)' }} />
        <span
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(233,247,245,0.92)',
          }}
        >
          {kicker}
        </span>
      </div>

      <h2
        style={{
          fontFamily: FONT_SERIF,
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1.04,
          letterSpacing: '-0.02em',
          color: '#ffffff',
          margin: 0,
        }}
      >
        {title}
      </h2>

      {body && (
        <p
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 500,
            fontSize: 27,
            lineHeight: 1.42,
            color: 'rgba(214,234,232,0.82)',
            marginTop: 24,
          }}
        >
          {body}
        </p>
      )}
    </div>
  );
}
