/**
 * Chat composer: a text field, a LARGE mic button (primary affordance for our
 * low-literacy-friendly audience), and a send button.
 *
 * Real speech-to-text arrives later; for now the mic simulates dictation by
 * dropping in an example phrase, while exposing a `listening` signal so the
 * header avatar can switch to its listening state.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { MicIcon, SendIcon } from '@/components/ui/icons';

const DICTATION_SAMPLE = 'hoy desayuné dos panes con palta y me salió 160';

export function ChatInput({
  onSend,
  onListeningChange,
}: {
  onSend: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  useEffect(() => { onListeningChange?.(listening); }, [listening, onListeningChange]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  const toggleMic = () => {
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
    <div className="flex items-end gap-2 border-t border-border bg-bg-surface px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
      <div className="flex flex-1 items-center rounded-full border border-border bg-bg-base px-4 py-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          placeholder={listening ? es.chat.statusListening : es.chat.inputPlaceholder}
          aria-label={es.chat.inputPlaceholder}
          className="min-h-[40px] w-full bg-transparent text-[16px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      </div>

      {canSend ? (
        <button
          type="button"
          onClick={send}
          aria-label={es.chat.sendLabel}
          className="touch-target grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cyan text-[color:var(--text-on-brand)] shadow-cyan-glow transition-transform active:scale-95"
        >
          <SendIcon size={22} />
        </button>
      ) : (
        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? es.chat.micStop : es.chat.micLabel}
          aria-pressed={listening}
          className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full text-[color:var(--text-on-brand)] shadow-cyan-glow transition-transform active:scale-95"
          style={{ background: listening ? 'var(--deep-blue)' : 'var(--cyan)' }}
        >
          {listening && (
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: 'var(--cyan)' }}
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <MicIcon size={26} />
        </button>
      )}
    </div>
  );
}
