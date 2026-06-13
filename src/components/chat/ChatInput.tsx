/**
 * Chat composer: a text field, a LARGE mic button (primary affordance for our
 * low-literacy-friendly audience), and a send button.
 *
 * Speech-to-text uses the browser Web Speech API (es-PE) via useSpeechToText,
 * streaming live into the field. On browsers without it, the mic falls back to
 * a simulated dictation. Either way it exposes a `listening` signal so the
 * header avatar can switch to its listening state.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { useSpeechToText } from '@/app/useSpeechToText';
import { MicIcon, SendIcon, PlusIcon } from '@/components/ui/icons';

const DICTATION_SAMPLE = 'hoy desayuné dos panes con palta y me salió 160';

export function ChatInput({
  onSend,
  onListeningChange,
  onAttach,
}: {
  onSend: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
  onAttach?: (file: File) => void;
}) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const timer = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Real STT (Web Speech API) drives `text` (live) and `listening` (lifecycle).
  const stt = useSpeechToText({
    onResult: (t) => setText(t),
    onListeningChange: setListening,
  });

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  useEffect(() => { onListeningChange?.(listening); }, [listening, onListeningChange]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  const toggleMic = () => {
    if (stt.supported) {
      if (listening) stt.stop();
      else stt.start();
      return;
    }
    // Fallback for browsers without the Web Speech API: simulate dictation.
    if (listening) {
      setListening(false);
      if (timer.current) window.clearTimeout(timer.current);
      return;
    }
    setListening(true);
    timer.current = window.setTimeout(() => {
      setText((prev) => (prev ? prev : DICTATION_SAMPLE));
      setListening(false);
    }, 1400);
  };

  const canSend = text.trim().length > 0;

  return (
    <div className="flex items-end gap-2 border-t border-border bg-bg-surface px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
      {onAttach && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAttach(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={es.chat.attachLabel}
            className="press touch-target grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border bg-bg-base text-text-secondary transition-colors active:bg-bg-sunken"
          >
            <PlusIcon size={22} />
          </button>
        </>
      )}
      <label className="flex flex-1 cursor-text items-center rounded-[22px] border border-border bg-bg-base px-4 shadow-[inset_0_1px_2px_rgba(15,36,41,0.04)] transition-colors focus-within:border-border-strong">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          placeholder={listening ? es.chat.statusListening : es.chat.inputPlaceholder}
          aria-label={es.chat.inputPlaceholder}
          className="min-h-[44px] w-full bg-transparent text-[16px] text-text-primary placeholder:text-text-tertiary outline-none focus:outline-none focus-visible:shadow-none"
        />
      </label>

      {listening ? (
        // Listening → a clear STOP button (stays put even as text streams in).
        <button
          type="button"
          onClick={toggleMic}
          aria-label={es.chat.micStop}
          aria-pressed
          className="press touch-target relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-[color:var(--text-on-brand)]"
          style={{ background: 'var(--deep-blue)', boxShadow: 'var(--shadow-cyan)' }}
        >
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: 'var(--cyan)' }}
            animate={{ scale: [1, 1.55], opacity: [0.45, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
          <span className="relative h-3.5 w-3.5 rounded-[3px] bg-current" />
        </button>
      ) : canSend ? (
        <button
          type="button"
          onClick={send}
          aria-label={es.chat.sendLabel}
          className="press btn-primary touch-target grid h-12 w-12 shrink-0 place-items-center rounded-full"
        >
          <SendIcon size={22} />
        </button>
      ) : (
        <button
          type="button"
          onClick={toggleMic}
          aria-label={es.chat.micLabel}
          className="press touch-target grid h-12 w-12 shrink-0 place-items-center rounded-full text-[color:var(--text-on-brand)]"
          style={{ background: 'var(--grad-cyan)', boxShadow: 'var(--shadow-cyan)' }}
        >
          <MicIcon size={24} />
        </button>
      )}
    </div>
  );
}
