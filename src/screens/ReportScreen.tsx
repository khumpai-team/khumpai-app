/**
 * ReportScreen — two tabs.
 *
 * "Para mi médico": a period-scoped summary (glucose, adherence, observed
 * patterns WITH honesty labels, questions for the doctor) rendered with serif
 * headers for a document-trust feel, plus a share sheet (the doctor never
 * installs anything). "Lo que me dijo el doctor": a timeline of visits and a
 * form to add a new one (Khumpi acknowledges it in chat).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { generateReport, getDoctorNotes } from '@/agent/tools';
import { evaluateAchievements } from '@/lib/achievements';
import { uid } from '@/lib/id';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';
import type { GlucoseLog } from '@/types';
import {
  ChevronLeftIcon,
  ShareIcon,
  PlusIcon,
  CheckIcon,
  ChatBubbleIcon,
} from '@/components/ui/icons';

type Tab = 'doctor' | 'visits';
type Period = 15 | 30;

const fmtDay = (dateStr: string) => {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
  const s = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return s;
};

const fieldCls =
  'w-full rounded-md border border-border bg-bg-base px-3 py-2.5 text-[16px] text-text-primary focus-visible:outline-cyan';

function SerifHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-lg font-bold text-deep-blue">{children}</h2>;
}

export function ReportScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('doctor');

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <header className="border-b border-border bg-bg-surface px-3 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/journal')}
            aria-label={es.common.back}
            className="touch-target grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
          >
            <ChevronLeftIcon size={24} />
          </button>
          <h1 className="font-serif text-xl font-bold text-text-primary">{es.report.title}</h1>
        </div>
        <div className="mt-2 flex">
          {(['doctor', 'visits'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className="flex-1 border-b-2 pb-2.5 pt-1 text-[13px] font-bold transition-colors"
              style={{
                borderColor: tab === t ? 'var(--cyan)' : 'transparent',
                color: tab === t ? 'var(--cyan)' : 'var(--text-tertiary)',
              }}
            >
              {t === 'doctor' ? es.report.tabDoctor : es.report.tabVisits}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {tab === 'doctor' ? <DoctorTab /> : <VisitsTab />}
      </div>
    </div>
  );
}

// --- Tab: Para mi médico --------------------------------------------------

function DoctorTab() {
  const logs = useAppStore((s) => s.logs);
  const medications = useAppStore((s) => s.medications);
  const doctorNotes = useAppStore((s) => s.doctorNotes);
  const actions = useAppStore((s) => s.actions);
  const personId = useAppStore((s) => s.currentPersonId);

  const [period, setPeriod] = useState<Period>(15);
  const [adding, setAdding] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [sent, setSent] = useState(false);
  const [unlocked, setUnlocked] = useState<string | null>(null);

  const summary = useMemo(() => {
    const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
    const gl = logs.filter((l): l is GlucoseLog => l.type === 'glucose' && new Date(l.timestamp).getTime() >= cutoff);
    const values = gl.map((g) => g.payload.value);
    const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    const inRange = values.filter((v) => v >= 70 && v <= 180).length;
    const spikes = gl.filter((g) => g.payload.value >= 180).sort((a, b) => b.payload.value - a.payload.value);

    const recs = medications.flatMap((m) => m.adherenceLog).filter((r) => new Date(`${r.date}T12:00:00`).getTime() >= cutoff);
    const taken = recs.filter((r) => r.taken).length;
    const pct = recs.length ? Math.round((taken / recs.length) * 100) : null;

    return { count: values.length, avg, inRange, spikes, taken, totalDoses: recs.length, pct };
  }, [logs, medications, period]);

  const patterns = useMemo(() => generateReport(useAppStore.getState()).patterns, [logs]);
  const questions = getDoctorNotes(doctorNotes, { forQuestion: true });

  const addQuestion = () => {
    const text = questionText.trim();
    if (!text) return;
    actions.addDoctorNote({
      id: uid('dn'),
      personId,
      text,
      timestamp: new Date().toISOString(),
      source: 'user',
      forQuestion: true,
    });
    setQuestionText('');
    setAdding(false);
  };

  const share = (_via: string) => {
    setShowShare(false);
    setSent(true);
    window.setTimeout(() => setSent(false), 2200);
    // Celebrate: a generated report can unlock the "report ready" achievement.
    const newOnes = evaluateAchievements(useAppStore.getState(), undefined, { reportGenerated: true });
    newOnes.forEach((a) => actions.addAchievement(a));
    if (newOnes[0]) {
      setUnlocked(newOnes[0].title);
      window.setTimeout(() => setUnlocked(null), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* period selector */}
      <div className="flex gap-2 rounded-full bg-bg-sunken p-1">
        {([15, 30] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className="flex-1 rounded-full py-2 text-sm font-bold transition-colors"
            style={{
              background: period === p ? 'var(--bg-surface)' : 'transparent',
              color: period === p ? 'var(--cyan)' : 'var(--text-secondary)',
              boxShadow: period === p ? '0 2px 8px rgba(31,102,153,0.10)' : 'none',
            }}
          >
            {p === 15 ? es.report.period15 : es.report.period30}
          </button>
        ))}
      </div>

      {/* glucose */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
        <SerifHeader>📊 {es.report.glucoseTitle}</SerifHeader>
        {summary.count > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label={es.report.avg} value={`${summary.avg}`} unit={es.confirmation.units.mgdl} />
              <Stat label={es.report.inRange} value={`${summary.inRange}/${summary.count}`} />
              <Stat label={es.report.spikes} value={`${summary.spikes.length}`} accent="var(--amber)" />
            </div>
            <p className="mt-2 text-xs text-text-tertiary">{es.report.readingsCount(summary.count)}</p>
          </>
        ) : (
          <p className="mt-2 text-[15px] text-text-secondary">{es.report.noGlucose}</p>
        )}
      </section>

      {/* adherence */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
        <SerifHeader>💊 {es.report.adherenceTitle}</SerifHeader>
        {summary.pct != null ? (
          <>
            <p className="mt-2 text-2xl font-extrabold text-cyan">{es.report.adherencePct(summary.pct)}</p>
            <p className="text-sm text-text-secondary">{es.report.adherenceSub(summary.taken, summary.totalDoses)}</p>
          </>
        ) : (
          <p className="mt-2 text-[15px] text-text-secondary">{es.report.noAdherence}</p>
        )}
      </section>

      {/* patterns */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
        <SerifHeader>🔍 {es.report.patternsTitle}</SerifHeader>
        {patterns.length ? (
          <div className="mt-2 flex flex-col gap-3">
            {patterns.map((ins) => (
              <div key={ins.id}>
                <p className="text-[15px] leading-relaxed text-text-primary">{ins.text}</p>
                <span className="mt-1 inline-block rounded-full bg-bg-sunken px-2.5 py-1 text-xs font-semibold text-text-secondary">
                  🔍 {ins.confidence === 'clear' ? es.arc.honestyClear : es.arc.honestyPossible}{' '}
                  {es.arc.honestyTail(ins.basedOnCount)}
                </span>
              </div>
            ))}
            <p className="text-xs italic text-text-tertiary">{es.report.patternsDisclaimer}</p>
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-text-secondary">{es.report.noPatterns}</p>
        )}
      </section>

      {/* questions */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
        <SerifHeader>❓ {es.report.questionsTitle}</SerifHeader>
        <ul className="mt-2 flex flex-col gap-2">
          {questions.length ? (
            questions.map((q) => (
              <li key={q.id} className="flex gap-2 text-[15px] leading-relaxed text-text-primary">
                <span className="text-deep-blue">•</span>
                {q.text}
              </li>
            ))
          ) : (
            <li className="text-[15px] text-text-secondary">{es.report.noQuestions}</li>
          )}
        </ul>

        {adding ? (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              className={fieldCls}
              rows={2}
              autoFocus
              placeholder={es.report.questionPlaceholder}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" onClick={addQuestion} className="rounded-full bg-cyan px-4 py-2 text-sm font-bold text-[color:var(--text-on-brand)]">
                {es.report.addQuestion}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-sm font-bold text-text-secondary">
                {es.confirmation.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex items-center gap-1.5 text-sm font-bold text-deep-blue"
          >
            <PlusIcon size={18} /> {es.report.addQuestion}
          </button>
        )}
      </section>

      {/* share */}
      <button
        type="button"
        onClick={() => setShowShare(true)}
        className="touch-target mt-1 flex items-center justify-center gap-2 rounded-full bg-deep-blue py-4 text-[16px] font-bold text-white shadow-soft transition-transform active:scale-95"
      >
        <ShareIcon size={20} /> {es.report.share}
      </button>

      {/* toasts */}
      <AnimatePresence>
        {sent && (
          <Toast key="sent" text={es.report.sent} />
        )}
        {unlocked && <Toast key="ach" text={`🎉 ${unlocked}`} />}
      </AnimatePresence>

      {/* share sheet */}
      <AnimatePresence>
        {showShare && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={es.report.shareVia}
          >
            <button type="button" aria-label={es.common.close} onClick={() => setShowShare(false)} className="absolute inset-0 bg-[#0b1a24]/55" />
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="relative m-3 w-full max-w-[360px] rounded-xl bg-bg-surface p-5 shadow-soft-xl"
            >
              <h3 className="font-serif text-lg font-bold text-text-primary">{es.report.shareVia}</h3>
              <div className="mt-3 flex flex-col gap-2">
                {[es.report.whatsapp, es.report.email, es.report.pdf].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => share(opt)}
                    className="touch-target rounded-full border border-border bg-bg-base py-3 text-[15px] font-bold text-text-primary transition-colors active:bg-bg-sunken"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="rounded-md bg-bg-sunken px-2 py-3">
      <p className="text-xl font-extrabold" style={{ color: accent ?? 'var(--text-primary)' }}>
        {value}
      </p>
      {unit && <p className="text-[10px] text-text-tertiary">{unit}</p>}
      <p className="mt-0.5 text-xs font-semibold text-text-secondary">{label}</p>
    </div>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="pointer-events-none absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-text-primary px-5 py-2.5 text-sm font-bold text-bg-surface shadow-soft-lg"
    >
      {text}
    </motion.div>
  );
}

// --- Tab: Lo que me dijo el doctor ----------------------------------------

function VisitsTab() {
  const visits = useAppStore((s) => s.doctorVisits);
  const actions = useAppStore((s) => s.actions);
  const personId = useAppStore((s) => s.currentPersonId);

  const [adding, setAdding] = useState(false);
  const [said, setSaid] = useState('');
  const [indications, setIndications] = useState('');
  const [next, setNext] = useState('');

  const sorted = useMemo(() => [...visits].sort((a, b) => b.date.localeCompare(a.date)), [visits]);

  const saveVisit = () => {
    const whatDoctorSaid = said.trim();
    if (!whatDoctorSaid) return;
    actions.addDoctorVisit({
      id: uid('visit'),
      personId,
      date: new Date().toISOString().slice(0, 10),
      whatDoctorSaid,
      indications: indications.split('\n').map((s) => s.trim()).filter(Boolean),
      nextAppointment: next || undefined,
    });
    // Khumpi acknowledges in chat.
    useChatStore.getState().addMessage({
      id: uid('msg'),
      kind: 'message',
      role: 'khumpi',
      text: es.report.visitAck(whatDoctorSaid),
    });
    setSaid('');
    setIndications('');
    setNext('');
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {adding ? (
        <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
          <h2 className="font-serif text-lg font-bold text-deep-blue">{es.report.newVisit}</h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className="text-sm font-semibold text-text-secondary">
              {es.report.visitSaid}
              <textarea className={`${fieldCls} mt-1`} rows={2} value={said} onChange={(e) => setSaid(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-text-secondary">
              {es.report.visitIndications}
              <textarea className={`${fieldCls} mt-1`} rows={3} value={indications} onChange={(e) => setIndications(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-text-secondary">
              {es.report.visitNext}
              <input type="date" className={`${fieldCls} mt-1`} value={next} onChange={(e) => setNext(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={saveVisit} className="rounded-full bg-cyan px-4 py-2.5 text-sm font-bold text-[color:var(--text-on-brand)]">
                {es.report.visitSave}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2.5 text-sm font-bold text-text-secondary">
                {es.confirmation.cancel}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="touch-target flex items-center justify-center gap-2 rounded-full border border-border bg-bg-surface py-3.5 text-[15px] font-bold text-deep-blue shadow-soft transition-transform active:scale-95"
        >
          <PlusIcon size={20} /> {es.report.newVisit}
        </button>
      )}

      {sorted.length ? (
        <div className="relative flex flex-col gap-3 pl-4">
          {sorted.map((v) => (
            <section key={v.id} className="relative rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
              <span className="absolute -left-4 top-5 h-3 w-3 rounded-full bg-cyan ring-4 ring-[color:var(--bg-base)]" />
              <p className="font-serif text-sm font-bold text-deep-blue">{fmtDay(v.date)}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-text-primary">{v.whatDoctorSaid}</p>
              {v.indications.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {v.indications.map((ind, i) => (
                    <li key={i} className="flex gap-2 text-sm text-text-secondary">
                      <CheckIcon size={15} className="mt-0.5 shrink-0 text-cyan" />
                      {ind}
                    </li>
                  ))}
                </ul>
              )}
              {v.nextAppointment && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-deep-blue">
                  <ChatBubbleIcon size={15} /> {es.report.nextAppt(fmtDay(v.nextAppointment))}
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="px-2 py-6 text-center text-[15px] text-text-secondary">{es.report.noVisits}</p>
      )}
    </div>
  );
}
