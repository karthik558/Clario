import { useEffect, useState } from 'react';

export type ClarioTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'clario_theme';
export const THEME_CLASS = 'clario-dark';
export const THEME_CHANGE_EVENT = 'clario:theme-changed';

export function getSavedTheme(): ClarioTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Non-fatal if storage is unavailable
  }
  return 'light';
}

function syncRootTheme(theme: ClarioTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add(THEME_CLASS);
    root.dataset.theme = 'dark';
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove(THEME_CLASS);
    root.classList.remove('dark');
    root.dataset.theme = 'light';
    root.style.colorScheme = 'light';
  }
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? '#0b1120' : '#0f172a');
  }
}

export function applyTheme(theme: ClarioTheme): ClarioTheme {
  syncRootTheme(theme);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-fatal if storage is unavailable
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
  }

  return theme;
}

export function toggleTheme(): ClarioTheme {
  const isCurrentlyDark =
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains(THEME_CLASS)
      : getSavedTheme() === 'dark';
  return applyTheme(isCurrentlyDark ? 'light' : 'dark');
}

export function initTheme(): ClarioTheme {
  const theme = getSavedTheme();
  syncRootTheme(theme);
  return theme;
}

export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains(THEME_CLASS);
    }
    return getSavedTheme() === 'dark';
  });

  useEffect(() => {
    const sync = () => {
      const activeDark =
        typeof document !== 'undefined'
          ? document.documentElement.classList.contains(THEME_CLASS)
          : getSavedTheme() === 'dark';
      setIsDark(activeDark);
    };
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  return isDark;
}
