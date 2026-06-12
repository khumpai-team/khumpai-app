/**
 * Applies the active theme to <html data-theme>. While the user hasn't made an
 * explicit choice, it follows the OS color-scheme live.
 */

import { useEffect, type ReactNode } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const followSystem = useThemeStore((s) => s.followSystem);
  const setTheme = useThemeStore((s) => s.setTheme);

  // Apply attribute.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Follow the OS until the user chooses explicitly.
  useEffect(() => {
    if (!followSystem || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      // setTheme flips followSystem off, so re-enable it to keep tracking.
      useThemeStore.setState({ theme: e.matches ? 'dark' : 'light', followSystem: true });
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [followSystem, setTheme]);

  return <>{children}</>;
}
