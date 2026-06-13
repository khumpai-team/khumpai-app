/**
 * ChatScreen — the conversation and the app's default route.
 * Header (Khumpi + status) · offline banner · scrolling transcript with inline
 * cards (confirm, insight, action, safety) and arc choice chips · composer.
 * Opens the morning check-in once a day, and a discreet long-press on the
 * status text toggles the offline demo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { AGENT_ES } from '@/data/i18n/agent-es';
import { uid } from '@/lib/id';
import { useChat } from '@/app/useChat';
import { useOffline } from '@/app/useOffline';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';
import { useSessionStore } from '@/store/useSessionStore';
import { KhumpiAvatar, type KhumpiState } from '@/components/khumpi/KhumpiAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { ChatInput } from '@/components/chat/ChatInput';
import { ConfirmationCard } from '@/components/cards/ConfirmationCard';
import { InsightCard } from '@/components/cards/InsightCard';
import { ActionCard } from '@/components/cards/ActionCard';
import { SafetyCard } from '@/components/cards/SafetyCard';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { CheckinSheet } from '@/components/sheets/CheckinSheet';
import { PanicButton } from '@/components/ui/PanicButton';

const todayKey = () => new Date().toISOString().slice(0, 10);

export function ChatScreen() {
  const {
    items,
    thinking,
    calm,
    sendUserMessage,
    confirmCard,
    dismissCard,
    answerArcChoice,
    resolveAction,
    saveCheckin,
    pickPerson,
    sendAttachment,
  } = useChat();
  const [listening, setListening] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [reconnectCount, setReconnectCount] = useState<number | null>(null);

  const { isOffline, goOffline, goOnline } = useOffline();

  const scrollRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);

  // Seed greeting + open the morning check-in once per day.
  useEffect(() => {
    const chat = useChatStore.getState();
    const sess = useSessionStore.getState();
    const isCaregiver = useAppStore.getState().mode === 'caregiver';
    const needsCheckin = !isCaregiver && sess.lastCheckinDate !== todayKey();
    // Idempotent across StrictMode double-mounts and re-renders.
    if (chat.items.length === 0 && !chat.seeded) {
      chat.markSeeded();
      const name = useAppStore.getState().user.name;
      const h = new Date().getHours();
      const text = needsCheckin
        ? es.checkin.greeting
        : h < 12
          ? AGENT_ES.greetings.morning(name)
          : h < 19
            ? AGENT_ES.greetings.midday(name)
            : AGENT_ES.greetings.evening(name);
      chat.addMessage({ id: uid('msg'), kind: 'message', role: 'khumpi', text });
    }
    if (needsCheckin) setShowCheckin(true);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items, thinking]);

  const hasUserSpoken = useMemo(
    () => items.some((it) => it.kind === 'message' && it.role === 'user'),
    [items],
  );

  // Hero/empty state: the pristine first screen (just the seeded greeting).
  const heroMode = items.length <= 1 && !thinking && !showCheckin;
  const greeting = useMemo(() => {
    const first = items.find((it) => it.kind === 'message');
    return (first && first.kind === 'message' && first.text) || es.chat.greeting;
  }, [items]);

  const headerState: KhumpiState = calm ? 'calm' : listening ? 'listening' : thinking ? 'thinking' : 'happy';
  const statusText = listening ? es.chat.statusListening : thinking ? es.chat.statusThinking : es.chat.status;

  // Discreet long-press on the status line toggles the offline demo.
  const startPress = () => {
    pressTimer.current = window.setTimeout(() => {
      if (useAppStore.getState().isOffline) {
        const n = goOnline();
        setReconnectCount(n);
        window.setTimeout(() => setReconnectCount(null), 2600);
      } else {
        goOffline();
      }
    }, 600);
  };
  const endPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  const completeCheckin = (sleepHours: number, mood: 1 | 2 | 3 | 4 | 5, stress: 1 | 2 | 3) => {
    setShowCheckin(false);
    useSessionStore.getState().setLastCheckinDate(todayKey());
    saveCheckin(sleepHours, mood, stress);
  };
  const skipCheckin = () => {
    setShowCheckin(false);
    useSessionStore.getState().setLastCheckinDate(todayKey());
  };

  return (
    <div className="flex h-full flex-col bg-bg-base">
      {/* header — living assistant presence */}
      <header
        className="relative z-10 flex items-center gap-3 border-b border-border px-4 py-3"
        style={{ background: 'linear-gradient(180deg, var(--cyan-tint), var(--bg-surface) 70%)' }}
      >
        <div className="relative shrink-0">
          <span className="grid h-14 w-14 place-items-center">
            <KhumpiAvatar state={headerState} size={56} head />
          </span>
          {/* online presence dot */}
          <span
            className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-[color:var(--bg-surface)]"
            style={{ background: isOffline ? 'var(--amber)' : thinking || listening ? 'var(--amber)' : 'var(--cyan)' }}
          />
        </div>
        <div className="flex-1">
          <p className="font-serif text-[18px] font-bold leading-tight text-text-primary">{es.chat.assistantName}</p>
          <p
            className="flex w-fit cursor-default select-none items-center gap-1.5 text-[13px] font-semibold text-text-secondary"
            onPointerDown={startPress}
            onPointerUp={endPress}
            onPointerLeave={endPress}
            title="Khumpai"
          >
            {isOffline ? es.offline.banner.replace('📥 ', '') : statusText}
          </p>
        </div>
        <PanicButton variant="inline" />
      </header>

      <OfflineBanner offline={isOffline} reconnectCount={reconnectCount} />

      {/* transcript */}
      <div ref={scrollRef} className="no-scrollbar relative flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence>
          {calm && (
            <motion.div
              key="calm-wash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="pointer-events-none absolute inset-0"
              style={{ background: 'var(--sky)', opacity: 0.04 }}
              aria-hidden
            />
          )}
        </AnimatePresence>

        {heroMode ? (
          <ChatHero greeting={greeting} onPick={sendUserMessage} />
        ) : (
        <div className="relative space-y-3">
          {items.map((it) => {
            switch (it.kind) {
              case 'message':
                return <MessageBubble key={it.id} role={it.role} text={it.text} streaming={it.streaming} pending={it.pending} imageUrl={it.imageUrl} />;
              case 'card':
                return (
                  <ConfirmationCard
                    key={it.id}
                    entry={it.args.entry}
                    secondaryEntry={it.args.secondaryEntry}
                    state={it.state}
                    onConfirm={(entries) => confirmCard(it.id, entries)}
                    onDismiss={() => dismissCard(it.id)}
                  />
                );
              case 'choice':
                return it.answered ? null : (
                  <div key={it.id} className="ml-10 flex flex-wrap gap-2">
                    {it.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => answerArcChoice(it.id, o.value)}
                        className="touch-target rounded-full border border-border bg-bg-surface px-4 py-2 text-[15px] font-bold text-deep-blue shadow-soft transition-transform active:scale-95"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                );
              case 'insight':
                return <InsightCard key={it.id} insight={it.insight} />;
              case 'action':
                return (
                  <ActionCard
                    key={it.id}
                    text={it.text}
                    acceptLabel={it.acceptLabel}
                    state={it.state}
                    onAccept={() => resolveAction(it.id, it.suggestionType, true)}
                    onDecline={() => resolveAction(it.id, it.suggestionType, false)}
                  />
                );
              case 'safety':
                return <SafetyCard key={it.id} id={it.id} level={it.level} message={it.message} notified={it.notified} />;
              case 'personPick':
                return (
                  <div key={it.id} className="ml-[46px] flex flex-wrap gap-2">
                    {it.options.map((opt) => {
                      const selected = it.answeredName === opt.name;
                      const dim = !!it.answeredName && !selected;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!!it.answeredName}
                          onClick={() => pickPerson(it.id, opt)}
                          className="press flex items-center gap-2 rounded-full border bg-bg-surface py-1.5 pl-1.5 pr-4 text-[15px] font-bold shadow-soft transition-opacity disabled:cursor-default"
                          style={{
                            borderColor: selected ? 'var(--cyan)' : 'var(--border)',
                            color: 'var(--text-primary)',
                            opacity: dim ? 0.45 : 1,
                          }}
                        >
                          <span
                            className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-extrabold text-white"
                            style={{ background: opt.color }}
                          >
                            {opt.name.charAt(0).toUpperCase()}
                          </span>
                          {opt.name}
                        </button>
                      );
                    })}
                  </div>
                );
              default:
                return null;
            }
          })}

          {thinking && <TypingIndicator />}

          {!hasUserSpoken && !thinking && !showCheckin && (
            <div className="pt-2">
              <SuggestionChips onPick={sendUserMessage} />
            </div>
          )}
        </div>
        )}
      </div>

      {/* composer */}
      <ChatInput onSend={sendUserMessage} onListeningChange={setListening} onAttach={sendAttachment} />

      {/* morning check-in */}
      <AnimatePresence>
        {showCheckin && <CheckinSheet onComplete={completeCheckin} onSkip={skipCheckin} />}
      </AnimatePresence>
    </div>
  );
}

/** Welcoming hero shown on the pristine chat — big living Khumpi + quick replies. */
function ChatHero({ greeting, onPick }: { greeting: string; onPick: (t: string) => void }) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-6 px-2 pb-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <KhumpiAvatar state="happy" size={156} />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.5 }}
        className="max-w-[300px] font-serif text-[22px] font-bold leading-snug text-text-primary"
      >
        {greeting}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.5 }}
        className="flex w-full max-w-[330px] flex-col gap-2"
      >
        <p className="eyebrow text-center">{es.chat.suggestionsTitle}</p>
        {es.chat.suggestions.map((sug, i) => (
          <motion.button
            key={sug}
            type="button"
            onClick={() => onPick(sug)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.44 + i * 0.06 }}
            className="press rounded-[16px] border border-border bg-bg-surface px-4 py-3 text-left text-[15px] font-semibold text-text-primary shadow-soft transition-colors hover:border-border-strong"
          >
            {sug}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
