/**
 * PhoneFrame — a device shell whose screen clips the real app.
 *
 * Children render inside a 390×844 viewport (the app's native phone width) under
 * a MemoryRouter (so screens calling useNavigate don't crash) and a
 * MotionConfig with reducedMotion="always" — that makes the app's own
 * framer-motion entrances jump straight to their final state, so every frame is
 * deterministic and the MOTION is driven by Remotion, not by the app's timers.
 */

import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

export const DEVICE_W = 390;
export const DEVICE_H = 844;

const BEZEL = 14;
const SCREEN_RADIUS = 46;
const SAFE_TOP = 44;

export function PhoneFrame({
  children,
  route = '/',
}: {
  children: ReactNode;
  /** Initial router entry, e.g. "/journal". */
  route?: string;
}) {
  return (
    <div
      style={{
        width: DEVICE_W + BEZEL * 2,
        height: DEVICE_H + BEZEL * 2,
        background: 'linear-gradient(160deg, #16343a, #0c1d21)',
        borderRadius: SCREEN_RADIUS + BEZEL,
        padding: BEZEL,
        boxShadow:
          '0 50px 90px -25px rgba(8, 22, 25, 0.65), 0 0 0 2px rgba(255,255,255,0.04) inset',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: DEVICE_W,
          height: DEVICE_H,
          overflow: 'hidden',
          borderRadius: SCREEN_RADIUS,
          background: 'var(--bg-base)',
        }}
      >
        {/* status-bar safe area — keeps screen headers clear of the notch */}
        <div style={{ position: 'absolute', inset: '0 0 auto 0', height: SAFE_TOP, background: 'var(--bg-surface)', zIndex: 40 }} />
        <div style={{ position: 'absolute', inset: 0, paddingTop: SAFE_TOP }}>
          <MemoryRouter initialEntries={[route]}>
            <MotionConfig reducedMotion="always">{children}</MotionConfig>
          </MemoryRouter>
        </div>

        {/* notch */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 124,
            height: 30,
            background: '#0c1d21',
            borderRadius: 999,
            zIndex: 50,
          }}
        />
      </div>
    </div>
  );
}
