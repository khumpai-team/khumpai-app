/**
 * Vista cuidador — the real CaregiverPortfolio: every person the carer follows,
 * each with a traffic-light status. Carlos stays calm; Rosa needs attention
 * (high sugar + a forgotten pill), so the family knows when to step in.
 */

import { Stage } from '../lib/Stage';
import { ScreenHost } from '../lib/ScreenHost';
import { CaregiverPortfolio } from '@/screens/CaregiverPortfolio';

export function Caregiver({ durationInFrames }: { durationInFrames: number }) {
  return (
    <Stage
      kicker="Vista cuidador"
      title="La familia acompaña, a distancia"
      body="Un vistazo muestra quién está bien y quién necesita atención hoy."
      durationInFrames={durationInFrames}
    >
      <ScreenHost pan={70} panDelay={40} panOver={120}>
        <CaregiverPortfolio />
      </ScreenHost>
    </Stage>
  );
}
