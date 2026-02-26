import type { ThemeConfig } from './index';

export const battleclawTheme: ThemeConfig = {
  id: 'battleclaw',
  name: 'BattleClaw',
  description: 'Teal and amber tactical theme with bounty board styling',
  panels: {
    appTitle: 'BATTLECLAW',
    taskQueue: 'Bounty Board',
    activeMissions: 'Active Missions',
    toolLog: 'Live Tool Log',
    tokenBurn: 'Burn Rate',
    dashboard: 'Intel Dashboard',
    costTracking: 'Cost Intel',
    alerts: 'Threat Alerts',
    agents: 'Strike Team',
  },
  logo: {
    icon: 'custom',
    customSrc: '/battleclaw-logo.png',
    text: 'BATTLECLAW',
  },
  agentIcons: {
    coder: 'Sword',
    qa: 'Shield',
    cto: 'Crown',
  },
};
