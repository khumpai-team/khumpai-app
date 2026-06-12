/**
 * App root: routing + providers.
 *
 * Pre-app flow (Welcome → Login → Onboarding) lives in AuthLayout (no nav).
 * Once onboarding is complete, the main app (AppLayout, with nav + panic
 * button) opens on /chat. A guard keeps un-onboarded users in the flow and
 * sends finished users straight to the chat.
 */

import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/app/ThemeProvider';
import { AppLayout } from '@/app/AppLayout';
import { AuthLayout } from '@/app/AuthLayout';
import { ChatScreen } from '@/screens/ChatScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { JournalScreen } from '@/screens/JournalScreen';
import { ReportScreen } from '@/screens/ReportScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { LoginScreen } from '@/screens/LoginScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { useSessionStore } from '@/store/useSessionStore';

function RequireOnboarding({ children }: { children: ReactNode }) {
  const done = useSessionStore((s) => s.onboardingCompleted);
  return done ? <>{children}</> : <Navigate to="/welcome" replace />;
}

export function App() {
  const done = useSessionStore((s) => s.onboardingCompleted);

  return (
    <ThemeProvider>
      <Routes>
        {/* pre-app flow */}
        <Route element={<AuthLayout />}>
          <Route path="/welcome" element={<WelcomeScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
        </Route>

        {/* main app (guarded) */}
        <Route
          element={
            <RequireOnboarding>
              <AppLayout />
            </RequireOnboarding>
          }
        >
          <Route path="/chat" element={<ChatScreen />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/journal" element={<JournalScreen />} />
          <Route path="/report" element={<ReportScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>

        <Route path="*" element={<Navigate to={done ? '/chat' : '/welcome'} replace />} />
      </Routes>
    </ThemeProvider>
  );
}
