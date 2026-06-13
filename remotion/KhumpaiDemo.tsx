/**
 * KhumpaiDemo — the 45s pitch. One linear journey through the real app:
 * Intro → Onboarding → Chat (RAG recommendation, then conversational logging
 * offline) → Bitácora → Registro médico → Vista cuidador → Outro.
 *
 * Every product segment renders the actual app components inside a phone frame;
 * motion (message reveal, scroll, captions) is driven by Remotion.
 */

import { Series } from 'remotion';
import { Intro } from './segments/Intro';
import { Onboarding } from './segments/Onboarding';
import { ChatRag } from './segments/ChatRag';
import { ChatRegister } from './segments/ChatRegister';
import { Journal } from './segments/Journal';
import { Report } from './segments/Report';
import { Caregiver } from './segments/Caregiver';
import { Outro } from './segments/Outro';

export const DEMO_FPS = 30;

// Segment lengths in frames (30fps). Sum = 1350 = 45s.
export const SEG = {
  intro: 90,
  onboarding: 210,
  chatRag: 210,
  chatRegister: 210,
  journal: 180,
  report: 180,
  caregiver: 180,
  outro: 90,
} as const;

export const DEMO_DURATION = Object.values(SEG).reduce((a, b) => a + b, 0);

export function KhumpaiDemo() {
  return (
    <Series>
      <Series.Sequence durationInFrames={SEG.intro}>
        <Intro />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SEG.onboarding}>
        <Onboarding durationInFrames={SEG.onboarding} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SEG.chatRag}>
        <ChatRag durationInFrames={SEG.chatRag} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SEG.chatRegister}>
        <ChatRegister durationInFrames={SEG.chatRegister} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SEG.journal}>
        <Journal durationInFrames={SEG.journal} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SEG.report}>
        <Report durationInFrames={SEG.report} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SEG.caregiver}>
        <Caregiver durationInFrames={SEG.caregiver} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SEG.outro}>
        <Outro />
      </Series.Sequence>
    </Series>
  );
}
