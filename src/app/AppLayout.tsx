/**
 * AppLayout — the phone frame. On desktop the app sits inside a 390px device
 * frame on a soft backdrop; on a real phone it fills the screen. The bottom nav
 * is pinned; each screen scrolls within the content area.
 */

import { Outlet } from 'react-router-dom';
import { BottomNav } from '@/components/ui/BottomNav';
import { PanicButton } from '@/components/ui/PanicButton';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';

export function AppLayout() {
  useNotificationScheduler();
  return (
    <div className="device-backdrop grain relative flex min-h-[100dvh] items-center justify-center sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-phone flex-col overflow-hidden bg-bg-base sm:h-[860px] sm:max-h-[calc(100dvh-48px)] sm:rounded-[44px] sm:border sm:border-border sm:shadow-soft-xl">
        <NotificationCenter />
        <main className="relative flex-1 overflow-hidden">
          <Outlet />
        </main>
        <PanicButton />
        <BottomNav />
      </div>
    </div>
  );
}
