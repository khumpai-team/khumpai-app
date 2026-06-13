/**
 * ReportScreen — two tabs.
 *
 * "Para mi médico": a clinical reporting dashboard built around Time-in-Range
 * (the modern AGP standard) — a control hero with an in-range ring, a stacked
 * low/in/high bar, a glucose trend chart with the target band, per-moment
 * averages, adherence, observed patterns (with honesty labels) and questions
 * for the doctor. Serif headers for document trust; a share sheet at the end.
 * "Lo que me dijo el doctor": a visits timeline + add-visit form.
 *
 * All viz is hand-built SVG (see components/report/viz). Scoped to the current
 * patient (currentPersonId) so it works for both fronts.
 */

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { generateReport, getDoctorNotes } from '@/agent/tools';
import { evaluateAchievements } from '@/lib/achievements';
import { uid } from '@/lib/id';
import { useAppStore } from '@/store/appStore';
import { useChatStore } from '@/store/useChatStore';
import { useVisitMediaStore, type VisitMedia } from '@/store/useVisitMediaStore';
import { useSpeechToText } from '@/app/useSpeechToText';
import { readAttachment } from '@/lib/image';
import type { GlucoseLog, GlucoseMoment } from '@/types';
import { Ring, RangeBar, TrendChart, MomentBars } from '@/components/report/viz';
import { ChevronLeftIcon, ShareIcon, PlusIcon, CheckIcon, ChatBubbleIcon, MicIcon } from '@/components/ui/icons';

type Tab = 'doctor' | 'visits';
type Period = 7 | 30 | 90;
type MomentStatus = 'low' | 'in' | 'high';

const DAY = 24 * 60 * 60 * 1000;
const MOMENTS: GlucoseMoment[] = ['ayunas', 'post-desayuno', 'post-almuerzo', 'post-cena'];

const fmtDay = (dateStr: string) => {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr);
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};
const fmtShort = (d: Date) => new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(d);

const fieldCls =
  'w-full rounded-md border border-border bg-bg-base px-3 py-2.5 text-[16px] text-text-primary focus-visible:outline-cyan';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-border bg-bg-surface p-4 shadow-soft ${className}`}>{children}</section>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-[15px] font-bold text-deep-blue">{children}</h2>;
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

      <div className="flex-1 overflow-y-auto no-scrollbar">{tab === 'doctor' ? <DoctorTab /> : <VisitsTab />}</div>
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
  const persons = useAppStore((s) => s.persons);
  const patientName = persons.find((p) => p.id === personId)?.name ?? '';

  const [period, setPeriod] = useState<Period>(7);
  const [adding, setAdding] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [sent, setSent] = useState(false);
  const [unlocked, setUnlocked] = useState<string | null>(null);

  const s = useMemo(() => {
    const now = Date.now();
    const curFrom = now - period * DAY;
    const prevFrom = now - 2 * period * DAY;
    const glu = logs
      .filter((l): l is GlucoseLog => l.type === 'glucose' && l.personId === personId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const t = (g: GlucoseLog) => new Date(g.timestamp).getTime();
    const cur = glu.filter((g) => t(g) >= curFrom);
    const prev = glu.filter((g) => t(g) >= prevFrom && t(g) < curFrom);

    const vals = cur.map((g) => g.payload.value);
    const total = vals.length;
    const avg = total ? Math.round(vals.reduce((a, b) => a + b, 0) / total) : null;
    const prevAvg = prev.length ? Math.round(prev.reduce((a, b) => a + b.payload.value, 0) / prev.length) : null;
    const delta = avg != null && prevAvg != null ? avg - prevAvg : null;

    const low = vals.filter((v) => v < 70).length;
    const high = vals.filter((v) => v > 180).length;
    const inr = total - low - high;
    const pctLow = total ? Math.round((low / total) * 100) : 0;
    const pctIn = total ? Math.round((inr / total) * 100) : 0;
    const pctHigh = total ? Math.max(0, 100 - pctLow - pctIn) : 0;

    const byMoment = MOMENTS.map((m) => {
      const mv = cur.filter((g) => g.payload.moment === m).map((g) => g.payload.value);
      const a = mv.length ? Math.round(mv.reduce((x, y) => x + y, 0) / mv.length) : null;
      const status: MomentStatus = a == null ? 'in' : a > 180 ? 'high' : a < 70 ? 'low' : 'in';
      return { key: m, label: es.report.momentShort[m], avg: a, status };
    });

    const recs = medications
      .filter((m) => m.personId === personId)
      .flatMap((m) => m.adherenceLog)
      .filter((r) => new Date(`${r.date}T12:00:00`).getTime() >= curFrom);
    const takenN = recs.filter((r) => r.taken).length;
    const adh = recs.length ? Math.round((takenN / recs.length) * 100) : null;

    const trend = cur.map((g) => ({ v: g.payload.value, spike: g.payload.value > 180 }));

    return {
      total,
      avg,
      delta,
      pctLow,
      pctIn,
      pctHigh,
      byMoment,
      adh,
      takenN,
      totalDoses: recs.length,
      trend,
      spikes: high,
      rangeStr: `${fmtShort(new Date(curFrom))} – ${fmtShort(new Date(now))}`,
    };
  }, [logs, medications, personId, period]);

  const control = s.total === 0 ? null : s.pctIn >= 70 ? 'good' : s.avg != null && s.avg <= 180 ? 'moderate' : 'high';
  const controlMeta =
    control === 'good'
      ? { label: es.report.statusGood, color: 'var(--cyan)', tint: 'var(--cyan-tint)' }
      : control === 'moderate'
        ? { label: es.report.statusModerate, color: 'var(--deep-blue)', tint: 'var(--deep-blue-tint)' }
        : { label: es.report.statusHigh, color: 'var(--amber)', tint: 'var(--amber-tint)' };

  const patterns = useMemo(() => generateReport(useAppStore.getState()).patterns, [logs]);
  const questions = getDoctorNotes(doctorNotes, { forQuestion: true });

  const addQuestion = () => {
    const text = questionText.trim();
    if (!text) return;
    actions.addDoctorNote({ id: uid('dn'), personId, text, timestamp: new Date().toISOString(), source: 'user', forQuestion: true });
    setQuestionText('');
    setAdding(false);
  };

  const share = (_via: string) => {
    setShowShare(false);
    setSent(true);
    window.setTimeout(() => setSent(false), 2200);
    const newOnes = evaluateAchievements(useAppStore.getState(), undefined, { reportGenerated: true });
    newOnes.forEach((a) => actions.addAchievement(a));
    if (newOnes[0]) {
      setUnlocked(newOnes[0].title);
      window.setTimeout(() => setUnlocked(null), 3000);
    }
  };

  // Plain-language talking points synthesized from the period.
  const talkPoints: string[] = [];
  if (s.avg != null) talkPoints.push(es.report.talkAvg(s.avg));
  if (s.total) talkPoints.push(es.report.talkRange(s.pctIn));
  if (s.spikes > 0) talkPoints.push(es.report.talkSpikes(s.spikes));
  if (s.adh != null) talkPoints.push(es.report.talkAdherence(s.adh));
  patterns.forEach((p) => talkPoints.push(p.text));

  return (
    <div className="flex flex-col gap-3.5 px-4 py-4">
      {/* report meta */}
      <div>
        <p className="eyebrow">{es.report.reportFor(patientName)}</p>
        <p className="text-xs text-text-tertiary">{s.rangeStr}</p>
      </div>

      {/* period selector */}
      <div className="flex gap-1 rounded-full bg-bg-sunken p-1">
        {([7, 30, 90] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className="flex-1 rounded-full py-2 text-[13px] font-bold transition-colors"
            style={{
              background: period === p ? 'var(--bg-surface)' : 'transparent',
              color: period === p ? 'var(--cyan)' : 'var(--text-secondary)',
              boxShadow: period === p ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {p === 7 ? es.report.period7 : p === 30 ? es.report.period30 : es.report.period90}
          </button>
        ))}
      </div>

      {/* WHAT TO SAY — the lead: talking points + questions */}
      <section className="overflow-hidden rounded-lg border border-border shadow-soft-lg">
        <div className="p-4" style={{ background: 'linear-gradient(135deg, var(--cyan-tint), var(--bg-surface) 62%)' }}>
          <div className="flex items-start gap-2.5">
            <span className="text-xl" aria-hidden>🗣️</span>
            <h2 className="font-serif text-[17px] font-bold leading-snug text-deep-blue">{es.report.talkTitle}</h2>
          </div>
          {talkPoints.length ? (
            <>
              <p className="mt-2 text-sm text-text-secondary">{es.report.talkIntro}</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {talkPoints.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-text-primary">
                    <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--cyan)' }} />
                    {t}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-[15px] text-text-secondary">{es.report.talkEmpty}</p>
          )}
        </div>

        {/* questions to ask */}
        <div className="border-t border-border bg-bg-surface p-4">
          <p className="eyebrow text-deep-blue">❓ {es.report.talkAsk}</p>
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
                <button type="button" onClick={addQuestion} className="press btn-primary rounded-full px-4 py-2 text-sm font-bold">
                  {es.report.addQuestion}
                </button>
                <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-sm font-bold text-text-secondary">
                  {es.confirmation.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1.5 text-sm font-bold text-deep-blue">
              <PlusIcon size={18} /> {es.report.addQuestion}
            </button>
          )}
        </div>
      </section>

      <p className="eyebrow mt-1">{es.report.detailsTitle}</p>

      {s.total === 0 ? (
        <Card>
          <SectionTitle>{es.report.control}</SectionTitle>
          <p className="mt-2 text-[15px] text-text-secondary">{es.report.noGlucose}</p>
        </Card>
      ) : (
        <>
          {/* HERO — control + time-in-range ring */}
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center gap-4 p-5" style={{ background: `linear-gradient(135deg, ${controlMeta.tint}, transparent 70%)` }}>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">{es.report.avgLabel}</p>
                <p className="font-serif text-[40px] font-bold leading-none text-text-primary">
                  {s.avg}
                  <span className="ml-1 text-base font-bold text-text-tertiary">mg/dL</span>
                </p>
                <span
                  className="mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-extrabold"
                  style={{ background: controlMeta.tint, color: controlMeta.color }}
                >
                  {controlMeta.label}
                </span>
                {s.delta != null && (
                  <p
                    className="mt-1.5 text-[13px] font-bold"
                    style={{ color: s.delta < 0 ? 'var(--cyan)' : s.delta > 0 ? 'var(--amber)' : 'var(--text-tertiary)' }}
                  >
                    {s.delta < 0 ? es.report.deltaBetter(-s.delta) : s.delta > 0 ? es.report.deltaWorse(s.delta) : es.report.deltaSame}
                  </p>
                )}
              </div>
              <Ring pct={s.pctIn} color={controlMeta.color} size={104} sublabel={es.report.tirIn} />
            </div>
          </Card>

          {/* TIME IN RANGE */}
          <Card>
            <SectionTitle>{es.report.timeInRange}</SectionTitle>
            <div className="mt-3">
              <RangeBar low={s.pctLow} inRange={s.pctIn} high={s.pctHigh} />
              <div className="mt-2.5 flex items-center justify-between text-[12px] font-semibold">
                {[
                  { c: 'var(--deep-blue)', l: es.report.tirLow, p: s.pctLow },
                  { c: 'var(--cyan)', l: es.report.tirIn, p: s.pctIn },
                  { c: 'var(--amber)', l: es.report.tirHigh, p: s.pctHigh },
                ].map((seg) => (
                  <span key={seg.l} className="flex items-center gap-1.5 text-text-secondary">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.c }} />
                    {seg.l} <span className="font-extrabold text-text-primary">{seg.p}%</span>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-text-tertiary">{es.report.tirHint}</p>
            </div>
          </Card>

          {/* TREND */}
          <Card>
            <SectionTitle>{es.report.trend}</SectionTitle>
            <div className="mt-2">
              <TrendChart points={s.trend} />
              <p className="mt-1 text-xs text-text-tertiary">
                {es.report.readingsCount(s.total)} · {es.report.trendHint}
              </p>
            </div>
          </Card>

          {/* BY MOMENT */}
          <Card>
            <SectionTitle>{es.report.byMoment}</SectionTitle>
            <div className="mt-3">
              <MomentBars rows={s.byMoment} />
            </div>
          </Card>

          {/* ADHERENCE */}
          <Card>
            <SectionTitle>{es.report.adherenceTitle}</SectionTitle>
            {s.adh != null ? (
              <div className="mt-2 flex items-center gap-4">
                <Ring pct={s.adh} color="var(--deep-blue)" size={88} />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-text-primary">{es.report.adherencePct(s.adh)}</p>
                  <p className="text-sm text-text-secondary">{es.report.adherenceSub(s.takenN, s.totalDoses)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[15px] text-text-secondary">{es.report.noAdherence}</p>
            )}
          </Card>
        </>
      )}

      {/* PATTERNS */}
      <Card>
        <SectionTitle>🔍 {es.report.patternsTitle}</SectionTitle>
        {patterns.length ? (
          <div className="mt-2 flex flex-col gap-3">
            {patterns.map((ins) => (
              <div key={ins.id}>
                <p className="text-[15px] leading-relaxed text-text-primary">{ins.text}</p>
                <span className="mt-1 inline-block rounded-full bg-bg-sunken px-2.5 py-1 text-xs font-semibold text-text-secondary">
                  🔍 {ins.confidence === 'clear' ? es.arc.honestyClear : es.arc.honestyPossible} {es.arc.honestyTail(ins.basedOnCount)}
                </span>
              </div>
            ))}
            <p className="text-xs italic text-text-tertiary">{es.report.patternsDisclaimer}</p>
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-text-secondary">{es.report.noPatterns}</p>
        )}
      </Card>

      {/* SHARE */}
      <button
        type="button"
        onClick={() => setShowShare(true)}
        className="press touch-target mt-1 flex items-center justify-center gap-2 rounded-full py-4 text-[16px] font-bold text-white shadow-soft"
        style={{ background: 'var(--deep-blue)' }}
      >
        <ShareIcon size={20} /> {es.report.share}
      </button>

      <AnimatePresence>
        {sent && <Toast key="sent" text={es.report.sent} />}
        {unlocked && <Toast key="ach" text={`🎉 ${unlocked}`} />}
      </AnimatePresence>

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

/** An attachment tile — image thumbnail or a 📄 file chip. */
function MediaTile({ item }: { item: VisitMedia }) {
  if (item.kind === 'image') {
    return <img src={item.url} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />;
  }
  return (
    <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-bg-sunken p-1 text-center">
      <span className="text-xl" aria-hidden>📄</span>
      <span className="w-full truncate text-[9px] font-semibold text-text-tertiary">{item.name}</span>
    </div>
  );
}

// --- Tab: Lo que me dijo el doctor ----------------------------------------

function VisitsTab() {
  const visits = useAppStore((s) => s.doctorVisits);
  const actions = useAppStore((s) => s.actions);
  const personId = useAppStore((s) => s.currentPersonId);
  const media = useVisitMediaStore((s) => s.media);
  const addMedia = useVisitMediaStore((s) => s.add);

  const [adding, setAdding] = useState(false);
  const [said, setSaid] = useState('');
  const [indications, setIndications] = useState('');
  const [next, setNext] = useState('');
  const [pending, setPending] = useState<VisitMedia[]>([]);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stt = useSpeechToText({ onResult: (t) => setSaid(t), onListeningChange: setListening });

  const sorted = useMemo(() => [...visits].sort((a, b) => b.date.localeCompare(a.date)), [visits]);

  const reset = () => {
    setSaid('');
    setIndications('');
    setNext('');
    setPending([]);
    setAdding(false);
    if (listening) stt.stop();
  };

  const attach = async (file: File) => {
    const { url, isImage, name } = await readAttachment(file);
    setPending((p) => [...p, isImage && url ? { kind: 'image', url } : { kind: 'file', name }]);
  };

  const saveVisit = () => {
    const whatDoctorSaid = said.trim();
    if (!whatDoctorSaid) return;
    const id = uid('visit');
    actions.addDoctorVisit({
      id,
      personId,
      date: new Date().toISOString().slice(0, 10),
      whatDoctorSaid,
      indications: indications.split('\n').map((x) => x.trim()).filter(Boolean),
      nextAppointment: next || undefined,
    });
    if (pending.length) addMedia(id, pending);
    useChatStore.getState().addMessage({ id: uid('msg'), kind: 'message', role: 'khumpi', text: es.report.visitAck(whatDoctorSaid) });
    reset();
  };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <p className="text-[15px] leading-relaxed text-text-secondary">{es.report.visitsIntro}</p>

      {adding ? (
        <Card>
          <h2 className="font-serif text-lg font-bold text-deep-blue">{es.report.newVisit}</h2>
          <div className="mt-3 flex flex-col gap-4">
            {/* what the doctor said — type or dictate */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-secondary">{es.report.visitSaid}</span>
                {stt.supported && (
                  <button
                    type="button"
                    onClick={() => (listening ? stt.stop() : stt.start())}
                    aria-pressed={listening}
                    className="press relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold"
                    style={{
                      background: listening ? 'var(--deep-blue)' : 'var(--cyan-tint)',
                      color: listening ? 'var(--text-on-brand)' : 'var(--cyan)',
                    }}
                  >
                    <MicIcon size={15} /> {listening ? es.report.visitDictateStop : es.report.visitDictate}
                  </button>
                )}
              </div>
              <textarea
                className={`${fieldCls} mt-1`}
                rows={2}
                value={said}
                placeholder={es.report.visitSaidPlaceholder}
                onChange={(e) => setSaid(e.target.value)}
              />
            </div>

            <label className="text-sm font-semibold text-text-secondary">
              {es.report.visitIndications}
              <textarea className={`${fieldCls} mt-1`} rows={3} value={indications} onChange={(e) => setIndications(e.target.value)} />
            </label>

            {/* attachments (receta / foto) */}
            <div>
              <span className="text-sm font-semibold text-text-secondary">{es.report.visitAttachments}</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {pending.map((m, i) => (
                  <MediaTile key={i} item={m} />
                ))}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) attach(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label={es.report.visitAttach}
                  className="press grid h-16 w-16 place-items-center rounded-md border border-dashed border-border-strong text-text-tertiary"
                >
                  <PlusIcon size={20} />
                </button>
              </div>
            </div>

            <label className="text-sm font-semibold text-text-secondary">
              {es.report.visitNext}
              <input type="date" className={`${fieldCls} mt-1`} value={next} onChange={(e) => setNext(e.target.value)} />
            </label>

            <div className="flex gap-2">
              <button type="button" onClick={saveVisit} className="press btn-primary rounded-full px-4 py-2.5 text-sm font-bold">
                {es.report.visitSave}
              </button>
              <button type="button" onClick={reset} className="rounded-full border border-border px-4 py-2.5 text-sm font-bold text-text-secondary">
                {es.confirmation.cancel}
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="press touch-target flex items-center justify-center gap-2 rounded-full border border-border bg-bg-surface py-3.5 text-[15px] font-bold text-deep-blue shadow-soft"
        >
          <PlusIcon size={20} /> {es.report.newVisit}
        </button>
      )}

      {sorted.length ? (
        <div className="relative flex flex-col gap-3 pl-4">
          {sorted.map((v) => (
            <Card key={v.id} className="relative">
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
              {media[v.id]?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {media[v.id].map((m, i) => (
                    <MediaTile key={i} item={m} />
                  ))}
                </div>
              )}
              {v.nextAppointment && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-deep-blue">
                  <ChatBubbleIcon size={15} /> {es.report.nextAppt(fmtDay(v.nextAppointment))}
                </p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <p className="px-2 py-6 text-center text-[15px] text-text-secondary">{es.report.noVisits}</p>
      )}
    </div>
  );
}
