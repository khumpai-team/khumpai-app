/**
 * SettingsScreen — minimal and calm. Theme, emergency contact (view/edit),
 * an offline demo toggle, and a language placeholder.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { useAppStore } from '@/store/appStore';
import { useThemeStore } from '@/store/useThemeStore';
import { ChevronLeftIcon, SunIcon, MoonToggleIcon } from '@/components/ui/icons';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
      style={{ background: on ? 'var(--amber)' : 'var(--border)' }}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-soft transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

const fieldCls =
  'w-full rounded-md border border-border bg-bg-base px-3 py-2.5 text-[16px] text-text-primary focus-visible:outline-cyan';

export function SettingsScreen() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const contact = useAppStore((s) => s.emergencyContact);
  const isOffline = useAppStore((s) => s.isOffline);
  const setOffline = useAppStore((s) => s.actions.setOffline);

  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [relation, setRelation] = useState(contact.relation);
  const [saved, setSaved] = useState(false);

  const saveContact = () => {
    useAppStore.setState({ emergencyContact: { ...contact, name, phone, relation } });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="flex h-full flex-col bg-bg-base">
      <header className="flex items-center gap-2 border-b border-border bg-bg-surface px-3 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={es.common.back}
          className="touch-target grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
        >
          <ChevronLeftIcon size={24} />
        </button>
        <h1 className="font-serif text-xl font-bold text-text-primary">{es.settings.title}</h1>
      </header>

      <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5 no-scrollbar">
        {/* appearance */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {es.settings.appearance}
          </p>
          <div className="flex gap-2 rounded-full bg-bg-sunken p-1">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
                className="touch-target flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-colors"
                style={{
                  background: theme === t ? 'var(--bg-surface)' : 'transparent',
                  color: theme === t ? 'var(--cyan)' : 'var(--text-secondary)',
                  boxShadow: theme === t ? '0 2px 8px rgba(31,102,153,0.10)' : 'none',
                }}
              >
                {t === 'light' ? <SunIcon size={18} /> : <MoonToggleIcon size={18} />}
                {t === 'light' ? es.settings.light : es.settings.dark}
              </button>
            ))}
          </div>
        </section>

        {/* emergency contact */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {es.settings.emergency}
          </p>
          <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
            <label className="text-sm font-semibold text-text-secondary">
              {es.settings.emergencyName}
              <input className={`${fieldCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-text-secondary">
              {es.settings.emergencyPhone}
              <input className={`${fieldCls} mt-1`} value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-text-secondary">
              {es.settings.emergencyRelation}
              <input className={`${fieldCls} mt-1`} value={relation} onChange={(e) => setRelation(e.target.value)} />
            </label>
            <button
              type="button"
              onClick={saveContact}
              className="touch-target mt-1 rounded-full btn-primary py-2.5 text-sm font-bold text-[color:var(--text-on-brand)] transition-transform active:scale-95"
            >
              {saved ? es.settings.saved : es.settings.save}
            </button>
          </div>
        </section>

        {/* connection / offline demo */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {es.settings.connection}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
            <div className="min-w-0">
              <p className="font-bold text-text-primary">{es.settings.offlineDemo}</p>
              <p className="text-sm text-text-secondary">{es.settings.offlineHint}</p>
            </div>
            <Toggle on={isOffline} onChange={setOffline} label={es.settings.offlineDemo} />
          </div>
        </section>

        {/* language */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {es.settings.language}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
            <p className="font-bold text-text-primary">{es.settings.languageValue}</p>
            <span className="text-xs font-semibold text-text-tertiary">{es.settings.languageSoon}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
