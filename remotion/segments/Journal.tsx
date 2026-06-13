/**
 * Bitácora — the real JournalScreen over Carlos's seeded day. Everything logged
 * (by chat or quick action) lands here as a timeline.
 */

import { Stage } from '../lib/Stage';
import { ScreenHost } from '../lib/ScreenHost';
import { JournalScreen } from '@/screens/JournalScreen';
import { JOURNAL_PATCH } from '../data/demoLogs';

export function Journal({ durationInFrames }: { durationInFrames: number }) {
  return (
    <Stage
      route="/journal"
      kicker="Bitácora"
      title="Todo queda registrado, sin esfuerzo"
      body="Glucosa, comidas y pastillas en una sola línea de tiempo del día."
      durationInFrames={durationInFrames}
    >
      <ScreenHost patch={JOURNAL_PATCH} pan={150} panDelay={36} panOver={130}>
        <JournalScreen />
      </ScreenHost>
    </Stage>
  );
}
