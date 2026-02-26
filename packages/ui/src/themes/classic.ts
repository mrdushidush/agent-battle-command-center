import type { ThemeConfig } from './index';

export const classicTheme: ThemeConfig = {
  id: 'classic',
  name: 'Classic HUD',
  description: 'Original military command center with green HUD',
  panels: {
    appTitle: 'COMMAND CENTER',
    taskQueue: 'Task Queue',
    activeMissions: 'Running',
    toolLog: 'Tool Execution Log',
    tokenBurn: 'Token Burn Rate',
    dashboard: 'Dashboard',
    costTracking: 'Cost Tracking',
    alerts: 'Alerts',
    agents: 'Agents',
  },
  logo: {
    icon: 'Zap',
    text: 'COMMAND CENTER',
  },
  agentIcons: {
    coder: 'Code',
    qa: 'TestTube',
    cto: 'Briefcase',
  },
};
