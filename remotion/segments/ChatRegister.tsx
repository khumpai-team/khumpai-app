/**
 * Chat — conversational logging (offline). The user just talks; Khumpi turns it
 * into a structured ConfirmationCard (meal + glucose) that saves locally, with
 * the amber "pending sync" dot showing it works without internet.
 */

import { Stage } from '../lib/Stage';
import { ChatStage } from '../chat/ChatStage';
import { REGISTER_SCRIPT } from '../data/scripts';

export function ChatRegister({ durationInFrames }: { durationInFrames: number }) {
  return (
    <Stage
      kicker="Chat · sin internet"
      title="Una foto basta, aunque no haya señal"
      body="Khumpi reconoce la comida, la registra con tu glucosa y la guarda para sincronizar después."
      durationInFrames={durationInFrames}
    >
      <ChatStage script={REGISTER_SCRIPT} offline />
    </Stage>
  );
}
