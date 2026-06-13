/**
 * Onboarding — Khumpi sets everything up just by talking. Reuses the chat UI
 * (as the real app does) with a warm scripted exchange.
 */

import { Stage } from '../lib/Stage';
import { ChatStage } from '../chat/ChatStage';
import { ONBOARDING_SCRIPT } from '../data/scripts';

export function Onboarding({ durationInFrames }: { durationInFrames: number }) {
  return (
    <Stage
      kicker="Onboarding"
      title="Empieza conversando, sin formularios"
      body="Nada obligatorio: Khumpi conoce a Carlos en una charla de segundos."
      durationInFrames={durationInFrames}
    >
      <ChatStage script={ONBOARDING_SCRIPT} />
    </Stage>
  );
}
