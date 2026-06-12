/**
 * ConfirmationCard — THE hero interaction.
 *
 * Khumpi proposes a structured entry; the user confirms or edits inline.
 * On confirm, the fields check off one by one (80ms stagger) and the whole card
 * collapses into a small "✓ Guardado" pill with a soft bounce. Editing happens
 * inline — never a modal.
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { useAppStore } from '@/store/appStore';
import type { GlucoseMoment, LogEntry, MealContext } from '@/types';
import type { CardState } from '@/store/useChatStore';
import { CheckIcon, EditIcon, EntryIcon } from '@/components/ui/icons';

interface Props {
  entry: LogEntry;
  secondaryEntry?: LogEntry;
  state: CardState;
  onConfirm: (entries: LogEntry[]) => void;
  onDismiss: () => void;
}

interface FieldDef {
  id: string;
  label: string;
  read: string;
  editor: React.ReactNode;
}

const titleFor = (type: LogEntry['type']): string =>
  ({
    glucose: es.confirmation.titleGlucose,
    meal: es.confirmation.titleMeal,
    sleep: es.confirmation.titleSleep,
    medication: es.confirmation.titleMedication,
    symptom: es.confirmation.titleSymptom,
    mood: es.confirmation.title,
    stress: es.confirmation.title,
    activity: es.confirmation.title,
  })[type];

// --- tiny inline editors --------------------------------------------------

const inputCls =
  'w-full rounded-md border border-border bg-bg-base px-3 py-2 text-[16px] text-text-primary focus-visible:outline-cyan';

function TextField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input className={inputCls} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

function NumberField({ value, onChange, label, suffix }: { value: number; onChange: (v: number) => void; label: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        className={`${inputCls} max-w-[110px]`}
        value={Number.isNaN(value) ? '' : value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {suffix && <span className="text-sm text-text-secondary">{suffix}</span>}
    </div>
  );
}

function SelectField<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <select className={inputCls} value={value} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// --- field derivation -----------------------------------------------------

function useFields(
  primary: LogEntry,
  secondary: LogEntry | undefined,
  editing: boolean,
  setPrimary: (e: LogEntry) => void,
  setSecondary: (e: LogEntry) => void,
): FieldDef[] {
  return useMemo(() => {
    const fields: FieldDef[] = [];

    if (primary.type === 'meal') {
      const m = primary;
      fields.push({
        id: 'desc',
        label: es.confirmation.fieldMeal,
        read: m.payload.description,
        editor: (
          <TextField
            label={es.confirmation.fieldMeal}
            value={m.payload.description}
            onChange={(v) => setPrimary({ ...m, payload: { ...m.payload, description: v } })}
          />
        ),
      });
      fields.push({
        id: 'context',
        label: es.confirmation.fieldPlace,
        read: es.enums.mealContext[m.payload.context],
        editor: (
          <SelectField<MealContext>
            label={es.confirmation.fieldPlace}
            value={m.payload.context}
            onChange={(v) => setPrimary({ ...m, payload: { ...m.payload, context: v } })}
            options={(Object.keys(es.enums.mealContext) as MealContext[]).map((k) => ({ value: k, label: es.enums.mealContext[k] }))}
          />
        ),
      });
    }

    // Glucose: either the primary entry or one paired with a meal.
    const glucose = primary.type === 'glucose' ? primary : secondary?.type === 'glucose' ? secondary : undefined;
    if (glucose) {
      const setG = primary.type === 'glucose' ? setPrimary : setSecondary;
      fields.push({
        id: 'glucose',
        label: es.confirmation.fieldGlucose,
        read: `${glucose.payload.value} ${es.confirmation.units.mgdl}`,
        editor: (
          <NumberField
            label={es.confirmation.fieldGlucose}
            value={glucose.payload.value}
            suffix={es.confirmation.units.mgdl}
            onChange={(v) => setG({ ...glucose, payload: { ...glucose.payload, value: v } })}
          />
        ),
      });
      fields.push({
        id: 'moment',
        label: es.confirmation.fieldGlucoseMoment,
        read: es.enums.glucoseMoment[glucose.payload.moment],
        editor: (
          <SelectField<GlucoseMoment>
            label={es.confirmation.fieldGlucoseMoment}
            value={glucose.payload.moment}
            onChange={(v) => setG({ ...glucose, payload: { ...glucose.payload, moment: v } })}
            options={(Object.keys(es.enums.glucoseMoment) as GlucoseMoment[]).map((k) => ({ value: k, label: es.enums.glucoseMoment[k] }))}
          />
        ),
      });
    }

    if (primary.type === 'sleep') {
      const s = primary;
      fields.push({
        id: 'hours',
        label: es.confirmation.fieldHours,
        read: `${s.payload.hours} ${es.confirmation.units.hours}`,
        editor: (
          <NumberField
            label={es.confirmation.fieldHours}
            value={s.payload.hours}
            suffix={es.confirmation.units.hours}
            onChange={(v) => setPrimary({ ...s, payload: { ...s.payload, hours: v } })}
          />
        ),
      });
    }

    if (primary.type === 'medication') {
      const med = primary;
      fields.push({
        id: 'med',
        label: es.confirmation.fieldMedication,
        read: med.payload.name,
        editor: (
          <TextField
            label={es.confirmation.fieldMedication}
            value={med.payload.name}
            onChange={(v) => setPrimary({ ...med, payload: { ...med.payload, name: v } })}
          />
        ),
      });
      fields.push({
        id: 'taken',
        label: es.confirmation.fieldMedTaken,
        read: med.payload.taken ? es.confirmation.medTaken.yes : es.confirmation.medTaken.no,
        editor: (
          <SelectField<'yes' | 'no'>
            label={es.confirmation.fieldMedTaken}
            value={med.payload.taken ? 'yes' : 'no'}
            onChange={(v) => setPrimary({ ...med, payload: { ...med.payload, taken: v === 'yes' } })}
            options={[
              { value: 'yes', label: es.confirmation.medTaken.yes },
              { value: 'no', label: es.confirmation.medTaken.no },
            ]}
          />
        ),
      });
    }

    if (primary.type === 'symptom') {
      const s = primary;
      fields.push({
        id: 'sym',
        label: es.confirmation.fieldSymptom,
        read: s.payload.description,
        editor: (
          <TextField
            label={es.confirmation.fieldSymptom}
            value={s.payload.description}
            onChange={(v) => setPrimary({ ...s, payload: { ...s.payload, description: v } })}
          />
        ),
      });
    }

    return fields;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary, secondary, editing]);
}

// --- the card -------------------------------------------------------------

export function ConfirmationCard({ entry, secondaryEntry, state, onConfirm, onDismiss }: Props) {
  const reduce = useReducedMotion();
  const persons = useAppStore((s) => s.persons);
  const [primary, setPrimary] = useState<LogEntry>(entry);
  const [secondary, setSecondary] = useState<LogEntry | undefined>(secondaryEntry);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const saved = state === 'saved';

  const fields = useFields(primary, secondary, editing, setPrimary, (e) => setSecondary(e));

  const person = persons.find((p) => p.id === primary.personId);
  const showPersonBadge = !!person && person.relation !== 'self';

  const stagger = reduce ? 0 : 0.08;

  const handleConfirm = () => {
    if (confirming) return;
    setEditing(false);
    setConfirming(true);
    const entries = secondary ? [primary, secondary] : [primary];
    const total = reduce ? 120 : fields.length * 80 + 320;
    window.setTimeout(() => onConfirm(entries), total);
  };

  if (state === 'dismissed') {
    return (
      <div className="ml-10 max-w-[78%] rounded-md bg-bg-sunken px-4 py-2 text-sm text-text-tertiary">
        {es.confirmation.cancel} ✓
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {saved ? (
        <motion.div
          key="pill"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: reduce ? 1 : [0.85, 1.08, 1] }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className="btn-primary ml-10 inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-[15px] font-bold"
        >
          <CheckIcon size={18} />
          {es.confirmation.saved}
        </motion.div>
      ) : (
        <motion.div
          key="card"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          className="ml-10 w-[86%] max-w-[330px] overflow-hidden rounded-lg border border-border bg-bg-surface shadow-soft-lg"
        >
          {/* header */}
          <div className="flex items-center gap-3 border-b border-border bg-bg-sunken px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--cyan-tint)] text-cyan">
              <EntryIcon kind={primary.type} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[15px] font-bold leading-tight text-text-primary">
                {titleFor(primary.type)}
              </p>
              <p className="text-xs text-text-secondary">{es.confirmation.title}</p>
            </div>
            {showPersonBadge && (
              <span className="rounded-full bg-[color:var(--sky-tint)] px-2.5 py-1 text-xs font-semibold text-deep-blue">
                {es.confirmation.forPersonPrefix} {person?.name}
              </span>
            )}
          </div>

          {/* fields */}
          <ul className="flex flex-col gap-3 px-4 py-4">
            {fields.map((f, i) => (
              <li key={f.id} className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-sm font-semibold text-text-secondary">{f.label}</span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  {editing ? (
                    <div className="w-full max-w-[200px]">{f.editor}</div>
                  ) : (
                    <span className="truncate text-right text-[16px] font-bold text-text-primary">{f.read}</span>
                  )}
                  <AnimatePresence>
                    {confirming && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * stagger, type: 'spring', stiffness: 500, damping: 20 }}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan text-[color:var(--text-on-brand)]"
                      >
                        <CheckIcon size={15} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            ))}
          </ul>

          {/* actions */}
          {!confirming && (
            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={handleConfirm}
                className="press btn-primary touch-target flex-1 rounded-full px-4 text-[16px] font-bold"
              >
                {es.confirmation.confirm}
              </button>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
                className="touch-target flex items-center justify-center gap-1.5 rounded-full border border-border bg-bg-base px-4 text-[15px] font-bold text-deep-blue transition-colors active:bg-bg-sunken"
              >
                <EditIcon size={18} />
                {editing ? es.confirmation.done : es.confirmation.edit}
              </button>
            </div>
          )}

          {/* dismiss — subtle, never punitive */}
          {!confirming && !editing && (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full pb-3 text-center text-xs font-semibold text-text-tertiary underline-offset-2 hover:underline"
            >
              {es.confirmation.cancel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
