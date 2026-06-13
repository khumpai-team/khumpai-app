/**
 * useSpeechToText — thin wrapper over the browser Web Speech API
 * (SpeechRecognition). Zero backend, on-device, Peruvian Spanish (es-PE).
 *
 * Press-to-start / press-to-stop: recognition runs CONTINUOUSLY and auto-restarts
 * through the engine's silence timeouts until the caller calls stop(). Interim
 * results stream live; finalized text accumulates across restarts so a long
 * dictation isn't lost when the engine cycles.
 *
 * `supported` is false where the API is absent (Firefox / older Safari) — the
 * caller can fall back. Production/cross-browser upgrade: swap the engine for
 * Azure Speech behind this same { supported, start, stop } interface.
 */
import { useCallback, useEffect, useRef } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any -- Web Speech API is not in the standard TS DOM lib */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ');

export interface UseSpeechToTextOptions {
  lang?: string;
  /** Called with the full transcript so far (accumulated finals + live interim). */
  onResult: (transcript: string, isFinal: boolean) => void;
  /** Mirrors the listening lifecycle (start → true; stop/fatal error → false). */
  onListeningChange?: (listening: boolean) => void;
}

export function useSpeechToText(opts: UseSpeechToTextOptions): {
  supported: boolean;
  start: () => void;
  stop: () => void;
} {
  const { lang = 'es-PE' } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false); // true between start() and stop()
  const finalizedRef = useRef(''); // committed text from prior (ended) sessions
  const sessionFinalRef = useRef(''); // finalized text within the current session

  const Ctor = getRecognitionCtor();
  const supported = !!Ctor;

  const launch = useCallback(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    sessionFinalRef.current = '';

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      sessionFinalRef.current = final;
      const text = join(finalizedRef.current, final, interim);
      if (text) optsRef.current.onResult(text, false);
    };

    rec.onend = () => {
      // Commit this session's finalized text, then keep going if not stopped.
      finalizedRef.current = join(finalizedRef.current, sessionFinalRef.current);
      sessionFinalRef.current = '';
      if (shouldListenRef.current) {
        try {
          launch();
        } catch {
          shouldListenRef.current = false;
          optsRef.current.onListeningChange?.(false);
        }
      } else {
        optsRef.current.onListeningChange?.(false);
      }
    };

    rec.onerror = (ev: any) => {
      // Permission errors are fatal; transient ones (no-speech) let onend restart.
      if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
        shouldListenRef.current = false;
        optsRef.current.onListeningChange?.(false);
      }
    };

    recRef.current = rec;
    rec.start();
  }, [Ctor, lang]);

  const start = useCallback(() => {
    if (!Ctor) return;
    finalizedRef.current = '';
    shouldListenRef.current = true;
    try {
      launch();
      optsRef.current.onListeningChange?.(true);
    } catch {
      shouldListenRef.current = false;
      optsRef.current.onListeningChange?.(false);
    }
  }, [Ctor, launch]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    optsRef.current.onListeningChange?.(false);
  }, []);

  useEffect(
    () => () => {
      shouldListenRef.current = false;
      try {
        recRef.current?.abort?.();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { supported, start, stop };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
