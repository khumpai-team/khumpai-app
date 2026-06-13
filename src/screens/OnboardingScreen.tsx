/**
 * OnboardingScreen — the chat, reused as a warm scripted setup.
 *
 * name → mode (self / caregiver) → [patient name] → emergency contact
 * (confirm card) → medication (confirm card) → next appointment → done.
 * Nothing is mandatory; the closing line makes that explicit. On finish it sets
 * the session onboarding flag and drops the user into the real chat.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { uid } from '@/lib/id';
import { extractPersonName } from '@/agent/extractName';
import { useAppStore } from '@/store/appStore';
import { useSessionStore } from '@/store/useSessionStore';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { readAttachment } from '@/lib/image';
import { CheckIcon, EditIcon } from '@/components/ui/icons';

type Msg = { id: string; role: 'khumpi' | 'user'; text: string; imageUrl?: string };
type Step =
  | 'name'
  | 'mode'
  | 'patientName'
  | 'contact'
  | 'contactConfirm'
  | 'med'
  | 'medConfirm'
  | 'appt'
  | 'apptDate'
  | 'done';

interface ContactDraft {
  name: string;
  phone: string;
}
interface MedDraft {
  name: string;
  dose: string;
  schedule: string[];
}

function parseContact(text: string): ContactDraft {
  const phoneMatch = text.match(/(\+?\d[\d\s]{6,}\d)/);
  const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, ' ').trim() : '';
  // Drop the phone, then extract just the person's name from the rest
  // ("mi hija María" → "María"), instead of keeping the whole phrase.
  const rest = text.replace(/(\+?\d[\d\s]{6,}\d)/, '').replace(/[,.;]/g, ' ').replace(/\s+/g, ' ').trim();
  const name = extractPersonName(rest);
  return { name: name || 'Contacto', phone: phone || '' };
}

function parseMed(text: string): MedDraft {
  const doseMatch = text.match(/(\d+\s?mg)/i);
  const dose = doseMatch ? doseMatch[1].replace(/\s+/, '') : '';
  const schedule: string[] = [];
  const re = /(\d{1,2})\s?(am|pm|a\.?m\.?|p\.?m\.?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let h = Number(m[1]) % 12;
    if (/p/i.test(m[2])) h += 12;
    schedule.push(`${String(h).padStart(2, '0')}:00`);
  }
  if (/maniana|mañana/i.test(text) && !schedule.includes('08:00')) schedule.push('08:00');
  if (/noche/i.test(text) && !schedule.includes('20:00')) schedule.push('20:00');
  // Name = the words before the first digit, minus leading verbs ("tomo…", "es…").
  const name =
    (text.split(/\d/)[0] || 'Metformina')
      .replace(/[,.]/g, '')
      .replace(/^\s*(me\s+)?(tomo|tomar|tomó|uso|usar|es|la|el|mi|una?)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Metformina';
  return { name, dose: dose || '850mg', schedule: schedule.length ? [...new Set(schedule)].sort() : ['08:00', '20:00'] };
}

const editCls =
  'w-full rounded-md border border-border bg-bg-base px-3 py-2 text-[16px] text-text-primary focus-visible:outline-cyan';

export function OnboardingScreen() {
  const navigate = useNavigate();
  const setOnboardingCompleted = useSessionStore((s) => s.setOnboardingCompleted);
  const actions = useAppStore((s) => s.actions);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>('name');
  const [caregiver, setCaregiver] = useState(false);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactDraft | null>(null);
  const [med, setMed] = useState<MedDraft | null>(null);
  const [apptDate, setApptDate] = useState('');
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const say = (text: string) => setMessages((m) => [...m, { id: uid('o'), role: 'khumpi', text }]);
  const me = (text: string) => setMessages((m) => [...m, { id: uid('o'), role: 'user', text }]);

  const attach = async (file: File) => {
    const { url, isImage, name } = await readAttachment(file);
    setMessages((m) => [
      ...m,
      { id: uid('o'), role: 'user', text: isImage ? '' : `📎 ${name}`, imageUrl: isImage ? (url ?? undefined) : undefined },
    ]);
    say(es.onboarding.attachAck);
  };

  // Kick off once — ref guard avoids the StrictMode double-mount duplicate.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    say(es.onboarding.askName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, step]);

  const handleSend = (text: string) => {
    const t = text.trim();
    if (!t) return;
    me(t);

    if (step === 'name') {
      // Extract the real name from conversational input ("hola me llamo lucio"
      // → "Lucio"); re-ask if nothing name-like was said.
      const name = extractPersonName(t);
      if (!name) { say(es.onboarding.nameRetry); return; }
      useAppStore.setState((s) => ({ user: { ...s.user, name } }));
      say(es.onboarding.askMode(name));
      setStep('mode');
    } else if (step === 'patientName') {
      const name = extractPersonName(t);
      if (!name) { say(es.onboarding.patientNameRetry); return; }
      // Relabel the data-rich seed patient as the cared-for person, so the
      // caregiver dashboard has real history to monitor from day one.
      useAppStore.setState((s) => ({
        persons: s.persons.map((p) =>
          p.id === s.currentPersonId ? { ...p, name, relation: 'father' } : p,
        ),
      }));
      setPatientName(name);
      say(es.onboarding.askContact);
      setStep('contact');
    } else if (step === 'contact') {
      setContact(parseContact(t));
      setStep('contactConfirm');
    } else if (step === 'med') {
      setMed(parseMed(t));
      setStep('medConfirm');
    }
  };

  const chooseMode = (isFamily: boolean) => {
    me(isFamily ? es.onboarding.modeFamily : es.onboarding.modeSelf);
    setCaregiver(isFamily);
    useAppStore.setState({ mode: isFamily ? 'caregiver' : 'patient' });
    if (isFamily) {
      say(es.onboarding.askPatientName);
      setStep('patientName');
    } else {
      say(es.onboarding.askContact);
      setStep('contact');
    }
  };

  const confirmContact = (c: ContactDraft) => {
    useAppStore.setState({
      emergencyContact: { name: c.name, phone: c.phone, relation: 'familiar', isCaregiverUser: false },
    });
    say(`${es.confirmation.saved} ✓`);
    say(es.onboarding.askMed);
    setStep('med');
  };

  const confirmMed = (md: MedDraft) => {
    actions.upsertMedication({
      id: uid('med'),
      personId: useAppStore.getState().currentPersonId,
      name: md.name,
      dose: md.dose,
      frequency: md.schedule.length === 2 ? '2 veces al día' : `${md.schedule.length || 1} vez al día`,
      schedule: md.schedule,
      adherenceLog: [],
    });
    say(`${es.confirmation.saved} ✓`);
    say(es.onboarding.askAppt);
    setStep('appt');
  };

  const skipMed = () => {
    me(es.onboarding.skip);
    say(es.onboarding.askAppt);
    setStep('appt');
  };

  const finishAppt = (date?: string) => {
    if (date) {
      actions.addDoctorVisit({
        id: uid('visit'),
        personId: useAppStore.getState().currentPersonId,
        date: new Date().toISOString().slice(0, 10),
        whatDoctorSaid: '',
        indications: [],
        nextAppointment: date,
      });
      say(es.onboarding.apptSavedReply);
    } else {
      me(es.onboarding.apptSkip);
    }
    say(es.onboarding.closing);
    setStep('done');
  };

  const finish = () => {
    setOnboardingCompleted(true);
    navigate('/chat');
  };

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <header className="flex items-center gap-3 border-b border-border bg-bg-surface px-4 py-2.5">
        <span className="grid h-11 w-11 place-items-center">
          <KhumpiAvatar state={listening ? 'listening' : 'happy'} size={44} head />
        </span>
        <p className="font-serif text-[17px] font-bold text-text-primary">{es.chat.assistantName}</p>
      </header>

      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} imageUrl={m.imageUrl} />
        ))}

        {step === 'contactConfirm' && contact && (
          <OnbCard
            title={es.onboarding.contactTitle}
            icon="📞"
            fields={[
              { key: 'name', label: es.onboarding.fieldName, value: contact.name },
              { key: 'phone', label: es.onboarding.fieldPhone, value: contact.phone },
            ]}
            onConfirm={(vals) => confirmContact({ name: vals.name, phone: vals.phone })}
          />
        )}

        {step === 'medConfirm' && med && (
          <OnbCard
            title={es.onboarding.medTitle}
            icon="💊"
            badge={caregiver ? patientName ?? undefined : undefined}
            fields={[
              { key: 'name', label: es.confirmation.fieldMedication, value: med.name },
              { key: 'dose', label: es.onboarding.fieldDose, value: med.dose },
              { key: 'schedule', label: es.onboarding.fieldSchedule, value: med.schedule.join(' · ') },
            ]}
            onConfirm={(vals) =>
              confirmMed({ name: vals.name, dose: vals.dose, schedule: vals.schedule.split(/[·,\s]+/).filter(Boolean) })
            }
          />
        )}
      </div>

      {/* bottom control region depends on the step */}
      {step === 'name' || step === 'patientName' || step === 'contact' || step === 'med' ? (
        // Text-entry steps reuse the chat composer — same mic + speech-to-text.
        <ChatInput
          onSend={handleSend}
          onAttach={attach}
          onListeningChange={setListening}
          autoFocus
          placeholder={
            step === 'name'
              ? es.onboarding.namePlaceholder
              : step === 'patientName'
                ? es.onboarding.patientPlaceholder
                : step === 'contact'
                  ? es.onboarding.contactPlaceholder
                  : es.onboarding.medPlaceholder
          }
          footer={
            step === 'med' ? (
              <button type="button" onClick={skipMed} className="py-1 text-sm font-semibold text-text-tertiary">
                {es.onboarding.skip}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="border-t border-border bg-bg-surface px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
        {step === 'mode' && (
          <div className="flex flex-col gap-2 pb-1">
            <button type="button" onClick={() => chooseMode(false)} className="touch-target rounded-full btn-primary py-3 text-[15px] font-bold text-[color:var(--text-on-brand)] active:scale-95">
              {es.onboarding.modeSelf}
            </button>
            <button type="button" onClick={() => chooseMode(true)} className="touch-target rounded-full border border-border bg-bg-base py-3 text-[15px] font-bold text-deep-blue active:bg-bg-sunken">
              {es.onboarding.modeFamily}
            </button>
          </div>
        )}

        {step === 'appt' && (
          <div className="flex gap-2 pb-1">
            <button type="button" onClick={() => setStep('apptDate')} className="touch-target flex-1 rounded-full btn-primary py-3 text-[15px] font-bold text-[color:var(--text-on-brand)] active:scale-95">
              {es.onboarding.apptYes}
            </button>
            <button type="button" onClick={() => finishAppt()} className="touch-target flex-1 rounded-full border border-border bg-bg-base py-3 text-[15px] font-bold text-text-secondary active:bg-bg-sunken">
              {es.onboarding.apptSkip}
            </button>
          </div>
        )}

        {step === 'apptDate' && (
          <div className="flex items-center gap-2 pb-1">
            <input type="date" className={editCls} value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
            <button
              type="button"
              disabled={!apptDate}
              onClick={() => finishAppt(apptDate)}
              className="touch-target rounded-full btn-primary px-5 py-3 text-[15px] font-bold text-[color:var(--text-on-brand)] active:scale-95 disabled:opacity-40"
            >
              {es.onboarding.send}
            </button>
          </div>
        )}

        {step === 'done' && (
          <button type="button" onClick={finish} className="touch-target w-full rounded-full btn-primary py-4 text-[17px] font-bold text-[color:var(--text-on-brand)] active:scale-95">
            {es.onboarding.start}
          </button>
        )}
        </div>
      )}
    </div>
  );
}

// --- inline confirm card (the first "hero" moment) ------------------------

interface OnbField {
  key: string;
  label: string;
  value: string;
}

function OnbCard({
  title,
  icon,
  fields,
  badge,
  onConfirm,
}: {
  title: string;
  icon: string;
  fields: OnbField[];
  badge?: string;
  onConfirm: (vals: Record<string, string>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      className="ml-10 w-[86%] max-w-[330px] overflow-hidden rounded-lg border border-border bg-bg-surface shadow-soft-lg"
    >
      <div className="flex items-center gap-3 border-b border-border bg-bg-sunken px-4 py-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--cyan-tint)] text-xl">{icon}</span>
        <p className="flex-1 font-serif text-[15px] font-bold text-text-primary">{title}</p>
        {badge && (
          <span className="rounded-full bg-[color:var(--sky-tint)] px-2.5 py-1 text-xs font-semibold text-deep-blue">
            👨 {badge}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-3 px-4 py-4">
        {fields.map((f) => (
          <li key={f.key} className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-sm font-semibold text-text-secondary">{f.label}</span>
            {editing ? (
              <input
                className="w-full max-w-[190px] rounded-md border border-border bg-bg-base px-3 py-1.5 text-[15px] text-text-primary focus-visible:outline-cyan"
                value={vals[f.key]}
                aria-label={f.label}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            ) : (
              <span className="truncate text-right text-[15px] font-bold text-text-primary">{vals[f.key]}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={() => onConfirm(vals)}
          className="touch-target flex-1 rounded-full btn-primary py-2.5 text-[15px] font-bold text-[color:var(--text-on-brand)] active:scale-95"
        >
          <span className="inline-flex items-center justify-center gap-1.5">
            <CheckIcon size={17} /> {es.confirmation.confirm}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="touch-target flex items-center justify-center gap-1.5 rounded-full border border-border bg-bg-base px-4 text-[15px] font-bold text-deep-blue active:bg-bg-sunken"
        >
          <EditIcon size={17} /> {editing ? es.confirmation.done : es.confirmation.edit}
        </button>
      </div>
    </motion.div>
  );
}
