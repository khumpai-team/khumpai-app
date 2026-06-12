/**
 * PanicButton — a floating, soft-coral help button on every main screen.
 *
 * Tap → a calm confirmation ("¿Necesitas ayuda ahora?"). On confirm, in
 * parallel: place a call to the emergency contact, offer a pre-armed WhatsApp
 * message, surface the 106 (SAMU) line, and reassure the user in chat. Coral is
 * reserved for this button; danger-red appears only on the 106 emergency line.
 * All links are native (tel:/wa.me) so they work even offline.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { uid } from '@/lib/id';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { PhoneIcon, ChatBubbleIcon } from '@/components/ui/icons';

const digits = (phone: string) => phone.replace(/\D/g, '');

/** Fire a native protocol link without navigating the SPA away. */
function openNative(href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type Phase = 'idle' | 'confirming' | 'active';

export function PanicButton() {
  const contact = useAppStore((s) => s.emergencyContact);
  const userName = useAppStore((s) => s.user.name);
  const [phase, setPhase] = useState<Phase>('idle');

  const tel = `tel:${digits(contact.phone)}`;
  const wa = `https://wa.me/${digits(contact.phone)}?text=${encodeURIComponent(
    es.panic.whatsappMessage(userName),
  )}`;

  const confirm = () => {
    setPhase('active');
    // Place the call immediately, in parallel with showing the options.
    openNative(tel);
    // Reassure in the conversation, regardless of which screen we're on.
    useChatStore.getState().addMessage({
      id: uid('msg'),
      kind: 'message',
      role: 'khumpi',
      text: es.panic.reassure(contact.name),
    });
  };

  const close = () => setPhase('idle');

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase('confirming')}
        aria-label={es.panic.button}
        className="touch-target absolute bottom-[92px] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-[color:var(--text-on-brand)] shadow-soft-lg transition-transform active:scale-95"
        style={{ background: 'var(--coral-soft)' }}
      >
        <span className="text-2xl" aria-hidden>
          ＋
        </span>
      </button>

      <AnimatePresence>
        {phase !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={es.panic.title}
          >
            <button
              type="button"
              aria-label={es.common.close}
              onClick={close}
              className="absolute inset-0 bg-[#0b1a24]/55 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative m-3 w-full max-w-[360px] rounded-xl bg-bg-surface p-5 shadow-soft-xl"
            >
              {phase === 'confirming' ? (
                <>
                  <div className="flex flex-col items-center text-center">
                    <KhumpiAvatar state="calm" size={84} />
                    <h2 className="mt-2 font-serif text-xl font-bold text-text-primary">
                      {es.panic.title}
                    </h2>
                    <p className="mt-1 text-[15px] text-text-secondary">{es.panic.subtitle}</p>
                  </div>
                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={confirm}
                      className="touch-target w-full rounded-full py-3.5 text-[16px] font-bold text-[color:var(--text-on-brand)] shadow-soft transition-transform active:scale-95"
                      style={{ background: 'var(--coral-soft)' }}
                    >
                      {es.panic.confirm}
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="touch-target w-full rounded-full border border-border bg-bg-base py-3 text-[15px] font-bold text-text-secondary transition-colors active:bg-bg-sunken"
                    >
                      {es.panic.cancel}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center text-center">
                    <KhumpiAvatar state="calm" size={84} />
                    <p className="mt-2 text-[16px] font-semibold leading-relaxed text-text-primary">
                      {es.panic.reassure(contact.name)}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-col gap-2">
                    <a
                      href={tel}
                      className="touch-target flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[16px] font-bold text-[color:var(--text-on-brand)] shadow-soft transition-transform active:scale-95"
                      style={{ background: 'var(--cyan)' }}
                    >
                      <PhoneIcon size={20} /> {es.panic.callContact(contact.name)}
                    </a>
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="touch-target flex w-full items-center justify-center gap-2 rounded-full border border-border bg-bg-base py-3 text-[15px] font-bold text-deep-blue transition-colors active:bg-bg-sunken"
                    >
                      <ChatBubbleIcon size={19} /> {es.panic.whatsappContact(contact.name)}
                    </a>
                    {/* true emergency line — danger-red is allowed here */}
                    <a
                      href="tel:106"
                      className="touch-target flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[16px] font-bold text-[color:var(--text-on-brand)] shadow-soft transition-transform active:scale-95"
                      style={{ background: 'var(--danger)' }}
                    >
                      <PhoneIcon size={20} /> {es.panic.call106}
                    </a>
                    <button
                      type="button"
                      onClick={close}
                      className="touch-target mt-1 w-full rounded-full py-2.5 text-sm font-bold text-text-tertiary"
                    >
                      {es.common.close}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
