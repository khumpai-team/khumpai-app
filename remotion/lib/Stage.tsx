/**
 * Stage — the shared frame for every product segment: a branded background, the
 * phone on the left (real app inside), and the explainer Caption on the right.
 * The phone drifts up subtly as the segment opens.
 */

import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneFrame } from '../PhoneFrame';
import { Caption } from '../Caption';

export function StageBackground({ children }: { children?: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(1200px 800px at 18% 30%, #1b4750 0%, #123238 38%, #0c1d21 100%)',
      }}
    >
      {/* soft brand glow */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(640px 640px at 30% 75%, rgba(111,198,189,0.16), transparent 70%)',
        }}
      />
      {children}
    </AbsoluteFill>
  );
}

export function Stage({
  children,
  route = '/',
  kicker,
  title,
  body,
  durationInFrames,
  phoneScale = 1.16,
}: {
  children: ReactNode;
  route?: string;
  kicker: string;
  title: string;
  body?: string;
  durationInFrames: number;
  phoneScale?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 90 }, durationInFrames: 30 });
  const phoneY = interpolate(enter, [0, 1], [40, 0]);
  const phoneOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <StageBackground>
      <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* phone column */}
        <div
          style={{
            width: '49%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              transform: `translateY(${phoneY}px) scale(${phoneScale})`,
              transformOrigin: 'center',
              opacity: phoneOpacity,
            }}
          >
            <PhoneFrame route={route}>{children}</PhoneFrame>
          </div>
        </div>

        {/* caption column */}
        <div style={{ width: '51%', height: '100%', display: 'flex', alignItems: 'center', paddingRight: 96, paddingLeft: 24 }}>
          <Caption kicker={kicker} title={title} body={body} durationInFrames={durationInFrames} />
        </div>
      </AbsoluteFill>
    </StageBackground>
  );
}
