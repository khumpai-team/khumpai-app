/**
 * WelcomeScreen — first impression. Khumpi makes an entrance (fade + scale +
 * gentle bounce), the logo in serif, the tagline, and one warm call to action.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';

export function WelcomeScreen() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center">
      {/* soft atmospheric blobs */}
      <div
        className="pointer-events-none absolute -left-16 -top-10 h-56 w-56 rounded-full"
        style={{ background: 'var(--sky)', opacity: 0.18, filter: 'blur(40px)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-12 -right-12 h-64 w-64 rounded-full"
        style={{ background: 'var(--cyan)', opacity: 0.16, filter: 'blur(48px)' }}
      />

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 10 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.6, 1.08, 1], y: 0 }}
        transition={{ duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <KhumpiAvatar state="happy" size={150} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="mt-6 font-serif text-5xl font-bold tracking-tight text-text-primary"
      >
        {es.app.name}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-3 max-w-[280px] text-[17px] leading-relaxed text-text-secondary"
      >
        {es.welcome.tagline}
      </motion.p>

      <motion.button
        type="button"
        onClick={() => navigate('/login')}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="touch-target absolute bottom-10 left-8 right-8 rounded-full bg-cyan py-4 text-[17px] font-bold text-[color:var(--text-on-brand)] shadow-cyan-glow transition-transform active:scale-95"
      >
        {es.welcome.cta} →
      </motion.button>
    </div>
  );
}
