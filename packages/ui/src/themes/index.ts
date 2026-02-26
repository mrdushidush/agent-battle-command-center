import { useUIStore } from '../store/uiState';
import { classicTheme } from './classic';
import { battleclawTheme } from './battleclaw';

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  panels: {
    appTitle: string;
    taskQueue: string;
    activeMissions: string;
    toolLog: string;
    tokenBurn: string;
    dashboard: string;
    costTracking: string;
    alerts: string;
    agents: string;
  };
  logo: {
    icon: string;          // Lucide icon name or 'custom'
    customSrc?: string;    // Image path for custom logo
    text: string;
  };
  agentIcons: {
    coder: string;
    qa: string;
    cto: string;
  };
}

export const THEMES: Record<string, ThemeConfig> = {
  battleclaw: battleclawTheme,
  classic: classicTheme,
};

export const DEFAULT_THEME = 'battleclaw';

export function getTheme(id: string): ThemeConfig {
  return THEMES[id] ?? THEMES[DEFAULT_THEME];
}

export function getThemeList(): ThemeConfig[] {
  return Object.values(THEMES);
}

export function useTheme(): ThemeConfig {
  const themeId = useUIStore((s) => s.themeId);
  return getTheme(themeId);
}
