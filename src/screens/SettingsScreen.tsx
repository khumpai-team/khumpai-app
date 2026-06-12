/**
 * SettingsScreen — minimal and calm. A profile/account header, theme, emergency
 * contact (view/edit), an offline demo toggle, a language placeholder, and a
 * sign-out at the bottom (with a gentle confirm that resets the demo).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { SEED_STATE } from '@/data/seed';
import { useAppStore } from '@/store/appStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useChatStore } from '@/store/useChatStore';
import { usePillboxStore } from '@/store/usePillboxStore';
import { ChevronLeftIcon, SunIcon, MoonToggleIcon, LogoutIcon } from '@/components/ui/icons';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
      style={{ background: on ? 'var(--amber)' : 'var(--border-strong)' }}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-soft transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

const fieldCls =
  'w-full rounded-md border border-border bg-bg-base px-3 py-2.5 text-[16px] text-text-primary focus-visible:outline-none focus-visible:border-border-strong';

const labelCls = 'eyebrow mb-2';

export function SettingsScreen() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const user = useAppStore((s) => s.user);
  const mode = useAppStore((s) => s.mode);
  const contact = useAppStore((s) => s.emergencyContact);
  const isOffline = useAppStore((s) => s.isOffline);
  const setOffline = useAppStore((s) => s.actions.setOffline);

  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [relation, setRelation] = useState(contact.relation);
  const [saved, setSaved] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const saveContact = () => {
    useAppStore.setState({ emergencyContact: { ...contact, name, phone, relation } });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const signOut = () => {
    // Fresh demo: reset chat, pill stock, app state and session, then exit.
    useChatStore.getState().clear();
    usePillboxStore.setState({ stock: { 'med-metformina': 8 }, capacity: { 'med-metformina': 30 } });
    useAppStore.setState({ ...SEED_STATE });
    useSessionStore.setState({ loggedIn: false, onboardingCompleted: false, lastCheckinDate: null });
    navigate('/welcome');
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
        {/* account / profile */}
        <section>
          <p className={labelCls}>{es.settings.account}</p>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-2xl font-extrabold text-[color:var(--text-on-brand)]"
              style={{ background: 'var(--grad-cyan)', boxShadow: 'var(--shadow-cyan)' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-text-primary">{user.name}</p>
              <span className="mt-0.5 inline-block rounded-full bg-[color:var(--cyan-tint)] px-2.5 py-0.5 text-xs font-bold text-cyan">
                {mode === 'caregiver' ? es.settings.roleCaregiver : es.settings.rolePatient}
              </span>
            </div>
          </div>
        </section>

        {/* appearance */}
        <section>
          <p className={labelCls}>{es.settings.appearance}</p>
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
                  boxShadow: theme === t ? 'var(--shadow-sm)' : 'none',
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
          <p className={labelCls}>{es.settings.emergency}</p>
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
              className="press btn-primary touch-target mt-1 rounded-full py-2.5 text-sm font-bold"
            >
              {saved ? es.settings.saved : es.settings.save}
            </button>
          </div>
        </section>

        {/* connection / offline demo */}
        <section>
          <p className={labelCls}>{es.settings.connection}</p>
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
          <p className={labelCls}>{es.settings.language}</p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-surface p-4 shadow-soft">
            <p className="font-bold text-text-primary">{es.settings.languageValue}</p>
            <span className="text-xs font-semibold text-text-tertiary">{es.settings.languageSoon}</span>
          </div>
        </section>

        {/* sign out */}
        <button
          type="button"
          onClick={() => setConfirmOut(true)}
          className="press mt-1 mb-4 flex touch-target items-center justify-center gap-2 rounded-full border border-border bg-bg-surface py-3.5 text-[15px] font-bold text-text-secondary shadow-soft transition-colors active:bg-bg-sunken"
        >
          <LogoutIcon size={19} /> {es.settings.signOut}
        </button>
      </div>

      {/* confirm sign-out */}
      <AnimatePresence>
        {confirmOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={es.settings.signOutTitle}
          >
            <button
              type="button"
              aria-label={es.common.close}
              onClick={() => setConfirmOut(false)}
              className="absolute inset-0 bg-[#0b1a24]/55 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative m-3 w-full max-w-[360px] rounded-xl bg-bg-surface p-5 shadow-soft-xl"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bg-sunken text-text-secondary">
                  <LogoutIcon size={22} />
                </span>
                <div>
                  <h2 className="font-serif text-lg font-bold text-text-primary">{es.settings.signOutTitle}</h2>
                </div>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">{es.settings.signOutBody}</p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={signOut}
                  className="press touch-target w-full rounded-full py-3.5 text-[16px] font-bold text-[color:var(--bg-surface)]"
                  style={{ background: 'var(--text-primary)' }}
                >
                  {es.settings.signOutConfirm}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOut(false)}
                  className="press touch-target w-full rounded-full border border-border bg-bg-base py-3 text-[15px] font-bold text-text-secondary"
                >
                  {es.settings.stay}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
