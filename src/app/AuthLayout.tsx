/**
 * AuthLayout — the same device frame as the app, but without the bottom nav.
 * Used for Welcome, Login, and Onboarding (the pre-app flow).
 */

import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="device-backdrop flex min-h-[100dvh] items-center justify-center sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-phone flex-col overflow-hidden bg-bg-base sm:h-[860px] sm:max-h-[calc(100dvh-48px)] sm:rounded-[44px] sm:border sm:border-border sm:shadow-soft-xl">
        <Outlet />
      </div>
    </div>
  );
}
