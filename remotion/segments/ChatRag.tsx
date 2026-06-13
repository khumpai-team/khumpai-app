/**
 * Chat — RAG recommendation (online). Khumpi answers a real question with a
 * grounded reply and cited sources.
 */

import { Stage } from '../lib/Stage';
import { ChatStage } from '../chat/ChatStage';
import { RAG_SCRIPT, RAG_LISTEN_UNTIL } from '../data/scripts';

export function ChatRag({ durationInFrames }: { durationInFrames: number }) {
  return (
    <Stage
      kicker="Chat · en línea"
      title="Pregunta por voz, con respuestas confiables"
      body="Khumpi escucha, responde con guías médicas y cita de dónde viene cada consejo."
      durationInFrames={durationInFrames}
    >
      <ChatStage script={RAG_SCRIPT} listenUntil={RAG_LISTEN_UNTIL} />
    </Stage>
  );
}
