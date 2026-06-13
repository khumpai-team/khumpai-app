/**
 * LiveKhumpi — the mascot, genuinely alive, driven entirely by the Remotion
 * frame (the avatar's own framer-motion idle loop is frozen per-frame in a
 * render, so we neutralize it with MotionConfig reducedMotion and animate the
 * wrapper ourselves): a springy entrance overshoot, a continuous hop with
 * squash & stretch, a gentle sway, a breathing ground shadow, twinkling
 * sparkles, and a little expression change for personality.
 */

import { MotionConfig } from 'framer-motion';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KhumpiAvatar, type KhumpiState } from '@/components/khumpi/KhumpiAvatar';

const SPARKS = [
  { x: -0.62, y: -0.34, r: 7, phase: 0 },
  { x: 0.6, y: -0.46, r: 9, phase: 1.1 },
  { x: 0.72, y: 0.18, r: 6, phase: 2.2 },
  { x: -0.74, y: 0.1, r: 8, phase: 3.0 },
  { x: 0.34, y: -0.66, r: 5, phase: 1.7 },
  { x: -0.3, y: -0.62, r: 6, phase: 0.6 },
];

export function LiveKhumpi({ size = 260, startFrame = 0 }: { size?: number; startFrame?: number }) {
  const frame = useCurrentFrame() - startFrame;
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Springy entrance with overshoot.
  const enter = spring({ frame, fps, config: { damping: 9, stiffness: 130, mass: 0.85 }, durationInFrames: 34 });
  const enterScale = interpolate(enter, [0, 1], [0.2, 1]);
  const dropIn = interpolate(enter, [0, 1], [-size * 0.22, 0]);

  // Continuous hop (0 at floor, 1 at apex) + squash/stretch.
  const hop = Math.abs(Math.sin(t * Math.PI * 0.85));
  const hopY = -hop * size * 0.11;
  const stretchY = 1 + (hop - 0.5) * 0.12;
  const stretchX = 1 - (hop - 0.5) * 0.12;
  const sway = Math.sin(t * 1.7) * 4.5;

  // Expression personality: starts happy, then winks to "informed" now and then.
  const cycle = Math.floor(frame / 26) % 4;
  const state: KhumpiState = frame < 30 ? 'happy' : cycle === 2 ? 'informed' : cycle === 3 ? 'calm' : 'happy';

  const shadowScale = interpolate(hop, [0, 1], [1, 0.72]);
  const shadowOpacity = interpolate(hop, [0, 1], [0.42, 0.22]);

  return (
    <div style={{ position: 'relative', width: size, height: size * 1.18 }}>
      {/* sparkles */}
      {SPARKS.map((s, i) => {
        const tw = Math.sin(t * 3 + s.phase) * 0.5 + 0.5;
        const appear = interpolate(frame, [18 + i * 3, 34 + i * 3], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: size / 2 + s.x * size * 0.62 - s.r / 2,
              top: size / 2 + s.y * size * 0.62 - s.r / 2 + hopY * 0.4,
              width: s.r,
              height: s.r,
              borderRadius: 999,
              background: 'var(--cyan-soft)',
              opacity: appear * (0.3 + tw * 0.7),
              transform: `scale(${0.6 + tw * 0.7})`,
              boxShadow: '0 0 10px rgba(111,198,189,0.7)',
            }}
          />
        );
      })}

      {/* ground shadow */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: size * 0.02,
          width: size * 0.5,
          height: size * 0.1,
          borderRadius: '50%',
          background: 'rgba(8,22,25,0.5)',
          filter: 'blur(5px)',
          transform: `translateX(-50%) scaleX(${shadowScale})`,
          opacity: shadowOpacity * enter,
        }}
      />

      {/* mascot */}
      <div
        style={{
          transform: `translateY(${dropIn + hopY}px) rotate(${sway}deg) scale(${enterScale}) scaleX(${stretchX}) scaleY(${stretchY})`,
          transformOrigin: 'center bottom',
        }}
      >
        <MotionConfig reducedMotion="always">
          <KhumpiAvatar state={state} size={size} idle={false} />
        </MotionConfig>
      </div>
    </div>
  );
}
