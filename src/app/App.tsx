/**
 * App root: routing + providers. The app opens on /chat (the conversation is
 * the product). Home and Journal are placeholders until later phases.
 */

import { Navigate, Route, Routes } from 'react-router-dom';
import { es } from '@/data/i18n/es';
import { ThemeProvider } from '@/app/ThemeProvider';
import { AppLayout } from '@/app/AppLayout';
import { ChatScreen } from '@/screens/ChatScreen';
import { PlaceholderScreen } from '@/screens/PlaceholderScreen';

export function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatScreen />} />
          <Route
            path="/home"
            element={<PlaceholderScreen title={es.home.title} message={es.home.placeholder} avatar="informed" />}
          />
          <Route
            path="/journal"
            element={<PlaceholderScreen title={es.journal.title} message={es.journal.placeholder} avatar="calm" />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
