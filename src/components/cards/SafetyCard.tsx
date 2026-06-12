/**
 * SafetyCard — shown when a symptom is urgent or emergency.
 *
 * Tone is serene, never alarmist. Border is soft AMBER for `urgent`; the only
 * time we use real danger-red is `emergency`. Actions: notify the emergency
 * contact over WhatsApp (pre-armed message), see a nearby clinic, and an
 * always-visible 106 (SAMU) line. Links are native (work offline).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import type { RedFlagLevel } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';
import { CheckIcon, ChatBubbleIcon, PhoneIcon, PinIcon } from '@/components/ui/icons';

const digits = (phone: string) => phone.replace(/\D/g, '');

export function SafetyCard({
  id,
  level,
  message,
  notified,
}: {
  id: string;
  level: RedFlagLevel;
  message: string;
  notified?: boolean;
}) {
  const contact = useAppStore((s) => s.emergencyContact);
  const userName = useAppStore((s) => s.user.name);
  const markNotified = useChatStore((s) => s.markSafetyNotified);
  const [showClinic, setShowClinic] = useState(false);

  const isEmergency = level === 'emergency';
  // Amber for urgent; danger-red ONLY for true emergency.
  const accent = isEmergency ? 'var(--danger)' : 'var(--amber)';

  const waHref = `https://wa.me/${digits(contact.phone)}?text=${encodeURIComponent(
    es.safety.whatsappMessage(userName),
  )}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      className="ml-10 w-[90%] max-w-[340px] overflow-hidden rounded-lg bg-bg-surface shadow-soft-lg"
      style={{ border: `2px solid ${accent}` }}
      role="group"
      aria-label={es.safety.title}
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl"
          style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}
        >
          {isEmergency ? '🚨' : '🩹'}
        </span>
        <p className="font-serif text-[16px] font-bold leading-tight text-text-primary">
          {es.safety.title}
        </p>
      </div>

      <p className="px-4 pt-2 text-[15px] leading-relaxed text-text-secondary">{message}</p>

      <div className="flex flex-col gap-2 px-4 pt-3">
        {notified ? (
          <div className="flex items-center justify-center gap-2 rounded-full bg-[color:var(--cyan-tint)] py-3 text-[15px] font-bold text-cyan">
            <CheckIcon size={18} /> {es.safety.notified(contact.name)}
          </div>
        ) : (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => markNotified(id)}
            className="touch-target flex items-center justify-center gap-2 rounded-full py-3 text-[15px] font-bold text-[color:var(--text-on-brand)] shadow-soft transition-transform active:scale-95"
            style={{ background: 'var(--cyan)' }}
          >
            <ChatBubbleIcon size={19} /> {es.safety.notifyContact(contact.name)}
          </a>
        )}

        <button
          type="button"
          onClick={() => setShowClinic((v) => !v)}
          aria-expanded={showClinic}
          className="touch-target flex items-center justify-center gap-2 rounded-full border border-border bg-bg-base py-3 text-[15px] font-bold text-deep-blue transition-colors active:bg-bg-sunken"
        >
          <PinIcon size={19} /> {showClinic ? es.safety.hideClinic : es.safety.seeClinic}
        </button>

        {showClinic && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden rounded-md bg-bg-sunken px-3 py-3 text-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              {es.safety.clinic.label}
            </p>
            <p className="mt-1 font-bold text-text-primary">{es.safety.clinic.name}</p>
            <p className="text-text-secondary">{es.safety.clinic.address}</p>
            <a
              href={`tel:${digits(es.safety.clinic.phone)}`}
              className="mt-1 inline-flex items-center gap-1.5 font-bold text-deep-blue"
            >
              <PhoneIcon size={15} /> {es.safety.clinic.phone}
            </a>
          </motion.div>
        )}
      </div>

      {/* always-visible emergency line */}
      <a
        href="tel:106"
        className="mt-3 flex items-center justify-center gap-2 border-t border-border py-3 text-sm font-bold"
        style={{ color: accent }}
      >
        <PhoneIcon size={17} /> {es.safety.emergencyLine}
      </a>
    </motion.div>
  );
}
