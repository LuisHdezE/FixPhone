import { useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ThemeContext, themePresets } from '@/theme/themeContext';
import type { ThemeColorId, ThemeContextValue } from '@/theme/themeContext';

const STORAGE_KEY = 'fixphone-theme-color';

function isThemeColorId(value: string | null): value is ThemeColorId {
  return themePresets.some((preset) => preset.id === value);
}

function readInitialTheme(): ThemeColorId {
  if (typeof window === 'undefined') {
    return 'blue';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemeColorId(stored) ? stored : 'blue';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeColor, setThemeColor] = useState<ThemeColorId>(readInitialTheme);

  useEffect(() => {
    const preset = themePresets.find((candidate) => candidate.id === themeColor) ?? themePresets[0];
    if (!preset) {
      return;
    }

    const root = document.documentElement;
    root.dataset.themeColor = preset.id;
    root.style.setProperty('--theme-primary', preset.primary);
    root.style.setProperty('--theme-primary-hover', preset.primaryHover);
    root.style.setProperty('--theme-primary-active', preset.primaryActive);
    root.style.setProperty('--theme-primary-soft', preset.primarySoft);
    root.style.setProperty('--theme-primary-muted', preset.primaryMuted);
    root.style.setProperty('--theme-primary-border', preset.primaryBorder);
    root.style.setProperty('--theme-on-primary', preset.onPrimary);
    root.style.setProperty('--theme-accent', preset.accent ?? preset.primary);
    root.style.setProperty('--theme-accent-hover', preset.accentHover ?? preset.primaryHover);
    root.style.setProperty('--theme-accent-soft', preset.accentSoft ?? preset.primarySoft);
    root.style.setProperty('--theme-navigation-background', preset.navigationBackground ?? '#ffffff');
    root.style.setProperty('--theme-navigation-text', preset.navigationText ?? '#475569');
    root.style.setProperty('--theme-navigation-muted', preset.navigationMuted ?? '#94a3b8');
    root.style.setProperty('--theme-navigation-border', preset.navigationBorder ?? '#e2e8f0');
    root.style.setProperty('--theme-navigation-active-background', preset.navigationActiveBackground ?? preset.primarySoft);
    window.localStorage.setItem(STORAGE_KEY, preset.id);
  }, [themeColor]);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeColor, setThemeColor, presets: themePresets }),
    [themeColor],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
