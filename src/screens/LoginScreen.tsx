/**
 * LoginScreen — fully mocked auth for the demo. The phone and the 4-digit code
 * are HARDCODED and prefilled, so login is one tap: "Enviar código" → "Entrar".
 * No backend, no real SMS — it just flips the session `loggedIn` flag and goes
 * to onboarding. Any phone / any 4 digits also work, but you never have to type.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { es } from '@/data/i18n/es';
import { useSessionStore } from '@/store/useSessionStore';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';
import { ChevronLeftIcon } from '@/components/ui/icons';

// Mocked, hardcoded demo credentials — prefilled for a one-tap login.
const DEMO_PHONE = '999 888 777';
const DEMO_OTP = '1234';

const fieldCls =
  'w-full rounded-[16px] border border-border bg-bg-base px-4 py-3.5 text-[18px] text-text-primary shadow-[inset_0_1px_2px_rgba(15,36,41,0.04)] focus-visible:border-border-strong focus:outline-none';

export function LoginScreen() {
  const navigate = useNavigate();
  const setLoggedIn = useSessionStore((s) => s.setLoggedIn);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState(DEMO_PHONE);
  const [otp, setOtp] = useState('');

  const phoneOk = phone.replace(/\D/g, '').length >= 9;
  const otpOk = /^\d{4}$/.test(otp.trim());

  const goToOtp = () => {
    setOtp(DEMO_OTP); // prefill the demo code so the user just taps Entrar
    setStep('otp');
  };

  const enter = () => {
    setLoggedIn(true);
    navigate('/onboarding');
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-7 pt-6">
      {/* atmosphere */}
      <div
        className="pointer-events-none absolute -right-16 -top-12 h-56 w-56 rounded-full"
        style={{ background: 'var(--sky)', opacity: 0.16, filter: 'blur(44px)' }}
      />

      <button
        type="button"
        onClick={() => (step === 'otp' ? setStep('phone') : navigate('/welcome'))}
        aria-label={es.common.back}
        className="press relative z-10 -ml-2 grid h-11 w-11 place-items-center rounded-full text-text-secondary"
      >
        <ChevronLeftIcon size={24} />
      </button>

      <div className="relative z-10 mt-1 flex flex-col items-center">
        <KhumpiAvatar state={step === 'otp' ? 'informed' : 'happy'} size={88} />
        <span className="mt-3 rounded-full bg-[color:var(--cyan-tint)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-cyan">
          {es.login.demo}
        </span>
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 mt-7 flex flex-1 flex-col"
      >
        {step === 'phone' ? (
          <>
            <h1 className="font-serif text-[26px] font-bold leading-tight text-text-primary">{es.login.title}</h1>
            <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">{es.login.subtitle}</p>

            <label className="mt-7 block">
              <span className="eyebrow">{es.login.phoneLabel}</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-[14px] border border-border bg-bg-base px-3.5 py-3.5 text-[18px] font-bold text-text-secondary">
                  🇵🇪 +51
                </span>
                <input
                  className={fieldCls}
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </label>

            <div className="flex-1" />
            <button
              type="button"
              disabled={!phoneOk}
              onClick={goToOtp}
              className="press btn-primary mb-8 rounded-full py-4 text-[17px] font-bold disabled:opacity-40"
            >
              {es.login.sendCode}
            </button>
          </>
        ) : (
          <>
            <h1 className="font-serif text-[26px] font-bold leading-tight text-text-primary">{es.login.otpLabel}</h1>
            <p className="mt-1.5 text-[15px] text-text-secondary">{es.login.otpSentTo(`+51 ${phone}`)}</p>

            <div className="mt-7 flex justify-center gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="grid h-16 w-14 place-items-center rounded-[16px] border-2 bg-bg-base text-[28px] font-extrabold text-text-primary"
                  style={{ borderColor: otp[i] ? 'var(--cyan)' : 'var(--border)' }}
                >
                  {otp[i] ?? ''}
                </div>
              ))}
            </div>
            {/* invisible input drives the boxes; code is prefilled, so optional */}
            <input
              className="sr-only"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={otp}
              aria-label={es.login.otpLabel}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />

            <p className="mt-4 text-center text-[14px] text-text-tertiary">{es.login.otpHint}</p>
            <button
              type="button"
              onClick={() => setOtp(DEMO_OTP)}
              className="mx-auto mt-1 text-[13px] font-bold text-deep-blue"
            >
              {es.login.resend}
            </button>

            <div className="flex-1" />
            <button
              type="button"
              disabled={!otpOk}
              onClick={enter}
              className="press btn-primary mb-8 rounded-full py-4 text-[17px] font-bold disabled:opacity-40"
            >
              {es.login.verify}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
