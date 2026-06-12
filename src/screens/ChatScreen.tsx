/**
 * ChatScreen — the home of the conversation and the app's default route.
 * Header (Khumpi + status) · scrolling transcript with inline cards (confirm,
 * insight, action, safety) and arc choice chips · composer. During the calm arc
 * the background gains a barely-there sky wash and Khumpi softens to "calm".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { AGENT_ES } from '@/data/i18n/agent-es';
import { uid } from '@/lib/id';
import { useChat } from '@/app/useChat';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';
import { useThemeStore } from '@/store/useThemeStore';
import { KhumpiAvatar, type KhumpiState } from '@/components/khumpi/KhumpiAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { ChatInput } from '@/components/chat/ChatInput';
import { ConfirmationCard } from '@/components/cards/ConfirmationCard';
import { InsightCard } from '@/components/cards/InsightCard';
import { ActionCard } from '@/components/cards/ActionCard';
import { SafetyCard } from '@/components/cards/SafetyCard';
import { SunIcon, MoonToggleIcon } from '@/components/ui/icons';

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
  } = useChat();
  const [listening, setListening] = useState(false);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed a time-aware greeting once, if the transcript is empty.
  useEffect(() => {
    const chat = useChatStore.getState();
    if (chat.items.length === 0) {
      const name = useAppStore.getState().user.name;
      const h = new Date().getHours();
      const text =
        h < 12 ? AGENT_ES.greetings.morning(name) : h < 19 ? AGENT_ES.greetings.midday(name) : AGENT_ES.greetings.evening(name);
      chat.addMessage({ id: uid('msg'), kind: 'message', role: 'khumpi', text });
    }
  }, []);

  // Keep pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items, thinking]);

  const hasUserSpoken = useMemo(
    () => items.some((it) => it.kind === 'message' && it.role === 'user'),
    [items],
  );

  const headerState: KhumpiState = calm
    ? 'calm'
    : listening
      ? 'listening'
      : thinking
        ? 'thinking'
        : 'happy';
  const statusText = listening ? es.chat.statusListening : thinking ? es.chat.statusThinking : es.chat.status;

  return (
    <div className="flex h-full flex-col bg-bg-base">
      {/* header */}
      <header className="z-10 flex items-center gap-3 border-b border-border bg-bg-surface px-4 py-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--cyan-tint)]">
          <KhumpiAvatar state={headerState} size={34} idle={false} />
        </span>
        <div className="flex-1">
          <p className="font-serif text-[17px] font-bold leading-tight text-text-primary">{es.app.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: thinking || listening ? 'var(--amber)' : 'var(--cyan)' }}
            />
            {statusText}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={es.common.themeToggle}
          className="touch-target grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
        >
          {theme === 'dark' ? <SunIcon size={22} /> : <MoonToggleIcon size={22} />}
        </button>
      </header>

      {/* transcript */}
      <div ref={scrollRef} className="no-scrollbar relative flex-1 overflow-y-auto px-4 py-4">
        {/* calm atmosphere wash */}
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

        <div className="relative space-y-3">
          {items.map((it) => {
            switch (it.kind) {
              case 'message':
                return <MessageBubble key={it.id} role={it.role} text={it.text} streaming={it.streaming} pending={it.pending} />;
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
              default:
                return null;
            }
          })}

          {thinking && <TypingIndicator />}

          {!hasUserSpoken && !thinking && (
            <div className="pt-2">
              <SuggestionChips onPick={sendUserMessage} />
            </div>
          )}
        </div>
      </div>

      {/* composer */}
      <ChatInput onSend={sendUserMessage} onListeningChange={setListening} />
    </div>
  );
}
