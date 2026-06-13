/**
 * ChatStage — a deterministic chat screen for the demo. It renders the REAL
 * chat components (KhumpiAvatar, MessageBubble, TypingIndicator, OfflineBanner,
 * ConfirmationCard) and reveals a hard-coded script beat by beat, driven by the
 * current Remotion frame. No useChat, no live agent — every frame is reproducible.
 *
 * When listenUntil > current frame, the composer shows a voice/listening state
 * (animated waveform) so the demo can show an audio interaction.
 */

import { useCurrentFrame } from 'remotion';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ConfirmationCard } from '@/components/cards/ConfirmationCard';
import { MicIcon } from '@/components/ui/icons';
import type { ChatBeat } from '../data/scripts';

function Header({ offline }: { offline: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-bg-surface px-4 pb-3 pt-3">
      <KhumpiAvatar state="happy" size={40} head />
      <div className="min-w-0 flex-1">
        <p className="font-serif text-[16px] font-bold leading-tight text-text-primary">Khumpi</p>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: offline ? 'var(--amber)' : 'var(--cyan)' }}
          />
          {offline ? 'Sin conexión' : 'En línea'}
        </span>
      </div>
    </div>
  );
}

function Waveform({ frame }: { frame: number }) {
  const bars = 22;
  return (
    <div className="flex flex-1 items-center gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => {
        // Deterministic, lively heights from the frame + bar index.
        const phase = i * 0.7 + frame * 0.45;
        const h = 5 + (Math.sin(phase) * 0.5 + 0.5) * 18 * (0.5 + 0.5 * Math.sin(i * 1.3 + 1));
        return (
          <span
            key={i}
            style={{
              width: 3,
              height: Math.max(4, h),
              borderRadius: 3,
              background: 'var(--cyan)',
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
}

function Composer({ listening, frame }: { listening: boolean; frame: number }) {
  if (listening) {
    return (
      <div className="border-t border-border bg-bg-surface px-3 py-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white"
            style={{ background: 'var(--danger)' }}
          >
            <span className="h-3 w-3 rounded-[3px] bg-white" />
          </span>
          <div className="flex h-11 flex-1 items-center gap-2 rounded-full bg-bg-base px-4">
            <Waveform frame={frame} />
            <span className="shrink-0 text-[13px] font-bold text-text-secondary">Escuchando…</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="border-t border-border bg-bg-surface px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-11 flex-1 items-center rounded-full border border-border bg-bg-base px-4 text-[15px] text-text-tertiary">
          Escribe o habla…
        </div>
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-on-brand)]"
          style={{ background: 'linear-gradient(135deg, var(--cyan), var(--cyan-strong))' }}
        >
          <MicIcon size={20} />
        </span>
      </div>
    </div>
  );
}

export function ChatStage({
  script,
  offline = false,
  listenUntil = 0,
}: {
  script: ChatBeat[];
  offline?: boolean;
  /** While the frame is below this, the composer shows the listening state. */
  listenUntil?: number;
}) {
  const frame = useCurrentFrame();
  const listening = frame < listenUntil;

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <Header offline={offline} />
      {offline && <OfflineBanner offline reconnectCount={null} />}

      <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden px-3 pb-2 pt-4">
        {script.map((beat, i) => {
          if (beat.t === 'user' && frame >= beat.at) {
            return (
              <MessageBubble key={i} role="user" text={beat.text} pending={beat.pending} imageUrl={beat.imageUrl} />
            );
          }
          if (beat.t === 'khumpi' && frame >= beat.at) {
            return <MessageBubble key={i} role="khumpi" text={beat.text} sources={beat.sources} />;
          }
          if (beat.t === 'typing' && frame >= beat.from && frame < beat.to) {
            return <TypingIndicator key={i} />;
          }
          if (beat.t === 'card' && frame >= beat.at) {
            return (
              <ConfirmationCard
                key={i}
                entry={beat.entry}
                secondaryEntry={beat.secondaryEntry}
                state={frame >= beat.savedAt ? 'saved' : 'pending'}
                onConfirm={() => undefined}
                onDismiss={() => undefined}
              />
            );
          }
          return null;
        })}
      </div>

      <Composer listening={listening} frame={frame} />
    </div>
  );
}
