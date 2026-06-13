/**
 * ScreenHost — mounts a real, store-driven app screen inside the phone and gives
 * it a slow vertical auto-pan so a static screen reads as a live scroll. An
 * optional store patch is applied synchronously (in a useState initializer, so
 * it lands before children first render) for segments that need a different
 * person/mode than the default seed.
 */

import { useState, type ReactNode } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { useAppStore } from '@/store/appStore';
import type { AppState } from '@/types';

export function ScreenHost({
  children,
  patch,
  pan = 0,
  panDelay = 24,
  panOver = 150,
  startY = 0,
}: {
  children: ReactNode;
  /** Applied to appStore before first paint (e.g. caregiver person/mode). */
  patch?: Partial<AppState>;
  /** Total pixels to scroll up over the segment (0 = no pan). */
  pan?: number;
  panDelay?: number;
  panOver?: number;
  /** Initial scroll offset in px (negative = already scrolled down). */
  startY?: number;
}) {
  useState(() => {
    if (patch) useAppStore.setState(patch);
    return null;
  });

  const frame = useCurrentFrame();
  const y = pan
    ? interpolate(frame, [panDelay, panDelay + panOver], [startY, startY - pan], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : startY;

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <div style={{ transform: `translateY(${y}px)`, height: '100%' }}>{children}</div>
    </div>
  );
}
