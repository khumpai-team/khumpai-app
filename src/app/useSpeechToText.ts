/**
 * useSpeechToText — thin wrapper over the browser Web Speech API
 * (SpeechRecognition). Zero backend, on-device, Peruvian Spanish (es-PE).
 * Streams interim results so the composer fills in live.
 *
 * `supported` is false where the API is absent (Firefox / older Safari) — the
 * caller can fall back. To upgrade to production-grade, cross-browser accuracy,
 * replace the engine with Azure Speech (Cognitive Services) or a Whisper
 * transcription endpoint behind this same { supported, start, stop } interface.
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

export interface UseSpeechToTextOptions {
  lang?: string;
  /** Called with the transcript so far (interim updates, then the final). */
  onResult: (transcript: string, isFinal: boolean) => void;
  /** Mirrors the listening lifecycle (start/stop/end/error). */
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

  const Ctor = getRecognitionCtor();
  const supported = !!Ctor;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    optsRef.current.onListeningChange?.(false);
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    const rec = new Ctor(); // fresh per session for reliability
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const text = (final || interim).trim();
      if (text) optsRef.current.onResult(text, Boolean(final));
    };
    rec.onend = () => optsRef.current.onListeningChange?.(false);
    rec.onerror = () => optsRef.current.onListeningChange?.(false);
    recRef.current = rec;
    try {
      rec.start();
      optsRef.current.onListeningChange?.(true);
    } catch {
      optsRef.current.onListeningChange?.(false);
    }
  }, [Ctor, lang]);

  useEffect(
    () => () => {
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
