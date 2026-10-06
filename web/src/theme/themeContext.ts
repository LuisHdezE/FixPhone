import { createContext, useContext } from 'react';

export type ThemeColorId =
  | 'forest'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'orange'
  | 'rose'
  | 'teal'
  | 'cyan'
  | 'red';

export interface ThemePreset {
  id: ThemeColorId;
  label: string;
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primarySoft: string;
  primaryMuted: string;
  primaryBorder: string;
  onPrimary: string;
  accent?: string;
  accentHover?: string;
  accentSoft?: string;
  navigationBackground?: string;
  navigationText?: string;
  navigationMuted?: string;
  navigationBorder?: string;
  navigationActiveBackground?: string;
}

export const themePresets: readonly ThemePreset[] = [
  {
    id: 'forest',
    label: 'Bosque',
    primary: '#176b2c',
    primaryHover: '#125823',
    primaryActive: '#0d461b',
    primarySoft: '#edf7ef',
    primaryMuted: '#dbeee0',
    primaryBorder: '#a7cfb1',
    onPrimary: '#ffffff',
  },
  {
    id: 'blue',
    label: 'Azul',
    primary: '#1d4ed8',
    primaryHover: '#1e40af',
    primaryActive: '#1e3a8a',
    primarySoft: '#eff6ff',
    primaryMuted: '#dbeafe',
    primaryBorder: '#93c5fd',
    onPrimary: '#ffffff',
  },
  {
    id: 'indigo',
    label: 'Índigo',
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    primaryActive: '#3730a3',
    primarySoft: '#eef2ff',
    primaryMuted: '#e0e7ff',
    primaryBorder: '#a5b4fc',
    onPrimary: '#ffffff',
  },
  {
    id: 'violet',
    label: 'Violeta',
    primary: '#7c3aed',
    primaryHover: '#6d28d9',
    primaryActive: '#5b21b6',
    primarySoft: '#f5f3ff',
    primaryMuted: '#ede9fe',
    primaryBorder: '#c4b5fd',
    onPrimary: '#ffffff',
  },
  {
    id: 'orange',
    label: 'Naranja',
    primary: '#c2410c',
    primaryHover: '#9a3412',
    primaryActive: '#7c2d12',
    primarySoft: '#fff7ed',
    primaryMuted: '#ffedd5',
    primaryBorder: '#fdba74',
    onPrimary: '#ffffff',
  },
  {
    id: 'rose',
    label: 'Rosa',
    primary: '#be123c',
    primaryHover: '#9f1239',
    primaryActive: '#881337',
    primarySoft: '#fff1f2',
    primaryMuted: '#ffe4e6',
    primaryBorder: '#fda4af',
    onPrimary: '#ffffff',
  },
  {
    id: 'teal',
    label: 'Turquesa',
    primary: '#0f766e',
    primaryHover: '#115e59',
    primaryActive: '#134e4a',
    primarySoft: '#f0fdfa',
    primaryMuted: '#ccfbf1',
    primaryBorder: '#5eead4',
    onPrimary: '#ffffff',
  },
  {
    id: 'cyan',
    label: 'Cian',
    primary: '#0e7490',
    primaryHover: '#155e75',
    primaryActive: '#164e63',
    primarySoft: '#ecfeff',
    primaryMuted: '#cffafe',
    primaryBorder: '#67e8f9',
    onPrimary: '#ffffff',
  },
  {
    id: 'red',
    label: 'Rojo',
    primary: '#b91c1c',
    primaryHover: '#991b1b',
    primaryActive: '#7f1d1d',
    primarySoft: '#fef2f2',
    primaryMuted: '#fee2e2',
    primaryBorder: '#fca5a5',
    onPrimary: '#ffffff',
  },
];

export interface ThemeContextValue {
  themeColor: ThemeColorId;
  setThemeColor: (themeColor: ThemeColorId) => void;
  presets: readonly ThemePreset[];
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }

  return context;
}
