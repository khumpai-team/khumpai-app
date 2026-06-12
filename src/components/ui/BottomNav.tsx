/**
 * Bottom navigation: Home · (elevated Khumpi → Chat) · Mi diario.
 * The center button is raised and carries Khumpi's face — it's the primary way
 * into the conversation.
 */

import { NavLink } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { KhumpiAvatar } from '@/components/khumpi/KhumpiAvatar';

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 5l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3v-5h-7v5h-3A1.5 1.5 0 0 1 4 19v-7.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.14 : 0}
      />
    </svg>
  );
}

function JournalIcon({ active }: { active: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.14 : 0}
      />
      <path d="M6 4a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 9h5M10 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SideTab({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: (active: boolean) => React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className="touch-target flex flex-1 flex-col items-center justify-center gap-1 py-2 text-text-tertiary transition-colors aria-[current=page]:text-cyan"
    >
      {({ isActive }) => (
        <>
          {children(isActive)}
          <span
            className="text-[11px] font-semibold"
            style={{ color: isActive ? 'var(--cyan)' : 'var(--text-tertiary)' }}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="relative z-20 flex items-stretch border-t border-border bg-bg-surface px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5"
    >
      <SideTab to="/home" label={es.nav.home}>
        {(active) => <HomeIcon active={active} />}
      </SideTab>

      {/* elevated center button → Chat */}
      <div className="flex w-[88px] shrink-0 justify-center">
        <NavLink
          to="/chat"
          aria-label={es.nav.chat}
          className="touch-target absolute -top-6 grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-bg-surface bg-cyan shadow-cyan-glow transition-transform active:scale-95"
        >
          <span className="grid h-[52px] w-[52px] place-items-center rounded-full">
            <KhumpiAvatar state="happy" size={44} idle={false} title={es.nav.chat} />
          </span>
        </NavLink>
      </div>

      <SideTab to="/journal" label={es.nav.journal}>
        {(active) => <JournalIcon active={active} />}
      </SideTab>
    </nav>
  );
}
