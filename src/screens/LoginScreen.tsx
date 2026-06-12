/**
 * LoginScreen — mock auth. Phone number → a fake 4-digit OTP (any digits work)
 * → onboarding. No real backend; this just sets the session "loggedIn" flag.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { useSessionStore } from '@/store/useSessionStore';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { ChevronLeftIcon } from '@/components/ui/icons';

const inputCls =
  'w-full rounded-md border border-border bg-bg-base px-4 py-3 text-center text-[18px] tracking-wide text-text-primary focus-visible:outline-cyan';

export function LoginScreen() {
  const navigate = useNavigate();
  const setLoggedIn = useSessionStore((s) => s.setLoggedIn);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const phoneOk = phone.replace(/\D/g, '').length >= 9;
  const otpOk = /^\d{4}$/.test(otp.trim());

  return (
    <div className="flex h-full flex-col px-7 pt-6">
      <button
        type="button"
        onClick={() => (step === 'otp' ? setStep('phone') : navigate('/welcome'))}
        aria-label={es.common.back}
        className="touch-target -ml-2 grid h-11 w-11 place-items-center rounded-full text-text-secondary transition-colors active:bg-bg-sunken"
      >
        <ChevronLeftIcon size={24} />
      </button>

      <div className="mt-2 flex flex-col items-center">
        <KhumpiAvatar state={step === 'otp' ? 'informed' : 'happy'} size={84} />
      </div>

      {step === 'phone' ? (
        <div className="mt-6 flex flex-1 flex-col">
          <h1 className="font-serif text-2xl font-bold text-text-primary">{es.login.title}</h1>
          <p className="mt-1 text-[15px] text-text-secondary">{es.login.subtitle}</p>
          <label className="mt-6 text-sm font-semibold text-text-secondary">
            {es.login.phoneLabel}
            <input
              className={`${inputCls} mt-2`}
              inputMode="tel"
              autoFocus
              placeholder={es.login.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!phoneOk}
            onClick={() => setStep('otp')}
            className="touch-target mt-6 rounded-full bg-cyan py-4 text-[17px] font-bold text-[color:var(--text-on-brand)] shadow-cyan-glow transition-transform active:scale-95 disabled:opacity-40"
          >
            {es.login.sendCode}
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-1 flex-col">
          <h1 className="font-serif text-2xl font-bold text-text-primary">{es.login.otpLabel}</h1>
          <p className="mt-1 text-[15px] text-text-secondary">{es.login.otpHint}</p>
          <input
            className={`${inputCls} mt-6 text-2xl tracking-[0.6em]`}
            inputMode="numeric"
            maxLength={4}
            autoFocus
            placeholder="••••"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <button
            type="button"
            disabled={!otpOk}
            onClick={() => {
              setLoggedIn(true);
              navigate('/onboarding');
            }}
            className="touch-target mt-6 rounded-full bg-cyan py-4 text-[17px] font-bold text-[color:var(--text-on-brand)] shadow-cyan-glow transition-transform active:scale-95 disabled:opacity-40"
          >
            {es.login.verify}
          </button>
        </div>
      )}
    </div>
  );
}
