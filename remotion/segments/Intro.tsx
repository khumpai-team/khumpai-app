/**
 * Intro — Khumpi greets, the wordmark settles in. Sets the brand before the
 * product tour begins.
 */

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { StageBackground } from '../lib/Stage';
import { LiveKhumpi } from '../lib/LiveKhumpi';
import { FONT_SERIF } from '../lib/fonts';

export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleY = interpolate(
    spring({ frame: frame - 16, fps, config: { damping: 18 }, durationInFrames: 26 }),
    [0, 1],
    [30, 0],
  );
  const titleOpacity = interpolate(frame, [18, 34], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <StageBackground>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <LiveKhumpi size={270} />
        <div style={{ transform: `translateY(${titleY}px)`, opacity: titleOpacity, textAlign: 'center', marginTop: 8 }}>
          <h1
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 700,
              fontSize: 104,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              margin: 0,
            }}
          >
            Khumpai
          </h1>
          <p
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 600,
              fontSize: 30,
              color: 'rgba(214,234,232,0.85)',
              marginTop: 14,
            }}
          >
            Tu compañero diario con la diabetes
          </p>
        </div>
      </AbsoluteFill>
    </StageBackground>
  );
}
