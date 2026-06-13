import '@/styles/globals.css';
import './lib/fonts';
import './lib/serif-override.css';

import { Composition } from 'remotion';
import { KhumpaiDemo, DEMO_DURATION, DEMO_FPS } from './KhumpaiDemo';

export function RemotionRoot() {
  return (
    <Composition
      id="KhumpaiDemo"
      component={KhumpaiDemo}
      durationInFrames={DEMO_DURATION}
      fps={DEMO_FPS}
      width={1920}
      height={1080}
    />
  );
}
