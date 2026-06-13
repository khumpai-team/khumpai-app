/**
 * Outro — the wordmark returns with the closing line.
 */

import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { StageBackground } from '../lib/Stage';
import { FONT_SERIF } from '../lib/fonts';

export function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 110 }, durationInFrames: 26 });
  const scale = interpolate(pop, [0, 1], [0.6, 1]);
  const lineOpacity = interpolate(frame, [16, 34], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <StageBackground>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${scale})`, display: 'flex', alignItems: 'center', gap: 24 }}>
          <KhumpiAvatar state="happy" size={120} idle={false} />
          <h1
            style={{
              fontFamily: FONT_SERIF,
              fontWeight: 700,
              fontSize: 96,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              margin: 0,
            }}
          >
            Khumpai
          </h1>
        </div>
        <p
          style={{
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 600,
            fontSize: 34,
            color: 'rgba(214,234,232,0.9)',
            marginTop: 28,
            opacity: lineOpacity,
          }}
        >
          Cuidar es más fácil acompañado
        </p>
      </AbsoluteFill>
    </StageBackground>
  );
}
