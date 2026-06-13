/**
 * Registro médico — the real ReportScreen "Para mi médico" tab: Time-in-Range,
 * the glucose trend and adherence, ready to share with a doctor.
 */

import { Stage } from '../lib/Stage';
import { ScreenHost } from '../lib/ScreenHost';
import { ReportScreen } from '@/screens/ReportScreen';

export function Report({ durationInFrames }: { durationInFrames: number }) {
  return (
    <Stage
      route="/report"
      kicker="Registro médico"
      title="Un resumen listo para tu médico"
      body="Promedios, patrones detectados y las preguntas correctas — todo para la próxima cita."
      durationInFrames={durationInFrames}
    >
      <ScreenHost startY={-12} pan={150} panDelay={34} panOver={120}>
        <ReportScreen />
      </ScreenHost>
    </Stage>
  );
}
