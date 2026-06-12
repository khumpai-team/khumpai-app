/**
 * Warm placeholder for routes built in later phases (Home, Journal). Keeps the
 * shell navigable and on-brand instead of showing a blank or broken screen.
 */

import { KhumpiAvatar, type KhumpiState } from '@/components/khumpi/KhumpiAvatar';

export function PlaceholderScreen({
  title,
  message,
  avatar = 'calm',
}: {
  title: string;
  message: string;
  avatar?: KhumpiState;
}) {
  return (
    <div className="flex h-full flex-col bg-bg-base">
      <header className="border-b border-border bg-bg-surface px-5 py-4">
        <h1 className="font-serif text-2xl font-bold text-text-primary">{title}</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
        <KhumpiAvatar state={avatar} size={132} />
        <p className="max-w-[260px] text-[17px] leading-relaxed text-text-secondary">{message}</p>
      </div>
    </div>
  );
}
