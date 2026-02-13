import { Settings, Bell, Zap, MessageSquare, RefreshCcw, Volume2, VolumeX, Terminal, DollarSign } from 'lucide-react';
import { useUIStore } from '../../store/uiState';
import { useState, useEffect } from 'react';
import { audioManager } from '../../audio/audioManager';
import { SettingsModal } from '../modals/SettingsModal';
import { AnimatedCurrency } from '../shared/AnimatedCounter';
import { apiGet, apiPost } from '../../lib/api';

export function TopBar() {
  const {
    mode,
    setMode,
    alerts,
    toggleAlertsPanel,
    chatPanelOpen,
    toggleChatPanel,
    toolLogOpen,
    toggleToolLog,
    audioSettings,
    setMuted,
    budget,
    updateBudget,
    settingsModalOpen,
    toggleSettingsModal,
  } = useUIStore();
  const unacknowledgedAlerts = alerts.filter(a => a && a.acknowledged === false).length;
  const [resetting, setResetting] = useState(false);

  // Fetch initial budget status
  useEffect(() => {
    apiGet<any>('/api/budget/status')
      .then(data => {
        updateBudget({
          dailySpentCents: data.dailySpentCents,
          dailyLimitCents: data.dailyLimitCents,
          allTimeSpentCents: data.allTimeSpentCents,
          percentUsed: data.percentUsed,
          isOverBudget: data.isOverBudget,
          isWarning: data.isWarning,
          claudeBlocked: data.claudeBlocked,
          avgCostPerTaskCents: data.costPerTask?.avgCostCents || 0,
          todayTasks: data.costPerTask?.todayTasks || 0,
        });
      })
      .catch(err => console.error('Failed to fetch budget:', err));
  }, [updateBudget]);

  const toggleMute = () => {
    const newMuted = !audioSettings.muted;
    setMuted(newMuted);
    audioManager.setMuted(newMuted);
  };

  const handleResetAgents = async () => {
    if (!confirm('Reset all agents to idle? This will clear any stuck states.')) {
      return;
    }

    setResetting(true);
    try {
      const result = await apiPost<{ success: boolean; count: number }>('/api/agents/reset-all');

      if (result.success) {
        alert(`Successfully reset ${result.count} agents`);
      }
    } catch (error) {
      console.error('Failed to reset agents:', error);
      alert('Failed to reset agents');
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="h-14 bg-command-panel border-b border-command-border flex items-center px-4 gap-6">
      {/* Logo/Title */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-hud-green/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-hud-green" />
        </div>
        <span className="font-display text-lg tracking-wider text-hud-green hidden lg:block">
          COMMAND CENTER
        </span>
      </div>

      {/* Resource Bars */}
      <div className="flex-1 flex items-center gap-6">
        {/* Budget Display */}
        <div 
          className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
            budget.isOverBudget
              ? 'bg-red-500/10 border-red-500/30'
              : budget.isWarning
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-green-500/10 border-green-500/30'
          }`}
          role="status"
          aria-label={`Budget: $${(budget.dailySpentCents / 100).toFixed(2)} spent of $${(budget.dailyLimitCents / 100).toFixed(2)} daily limit${budget.isOverBudget ? ', over budget' : budget.isWarning ? ', warning' : ''}`}
        >
          <DollarSign className={`w-4 h-4 ${
            budget.isOverBudget ? 'text-red-400' : budget.isWarning ? 'text-amber-400' : 'text-green-400'
          }`} aria-hidden="true" />
          <div className="flex flex-col">
            <span className={`text-sm font-mono font-bold ${
              budget.isOverBudget ? 'text-red-400' : budget.isWarning ? 'text-amber-400' : 'text-green-400'
            }`}>
              <AnimatedCurrency cents={budget.dailySpentCents} className="inline" /> / ${(budget.dailyLimitCents / 100).toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              Today {budget.claudeBlocked && <span className="text-red-400 font-bold">BLOCKED</span>}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={budget.percentUsed * 100} aria-valuemin={0} aria-valuemax={100} aria-label="Budget usage">
            <div
              className={`h-full transition-all ${
                budget.isOverBudget ? 'bg-red-500' : budget.isWarning ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(budget.percentUsed * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* All-time cost */}
        <div className="flex flex-col items-center px-2">
          <AnimatedCurrency cents={budget.allTimeSpentCents} className="text-sm font-mono text-hud-blue font-bold" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">All-Time</span>
        </div>

        {/* Avg cost per task */}
        <div className="flex flex-col items-center px-2">
          <span className="text-sm font-mono text-hud-purple font-bold">
            ${(budget.avgCostPerTaskCents / 100).toFixed(4)}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Avg/Task</span>
        </div>

        {/* Tasks today */}
        <div className="flex flex-col items-center px-2">
          <span className="text-sm font-mono text-gray-300 font-bold">
            {budget.todayTasks}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Tasks Today</span>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-toggle-btn ${mode === 'overseer' ? 'active' : ''}`}
          onClick={() => setMode('overseer')}
        >
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${mode === 'overseer' ? 'bg-hud-green' : 'bg-gray-600'}`} />
            Overseer
          </span>
        </button>
        <button
          className={`mode-toggle-btn ${mode === 'dashboard' ? 'active' : ''}`}
          onClick={() => setMode('dashboard')}
        >
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${mode === 'dashboard' ? 'bg-hud-green' : 'bg-gray-600'}`} />
            Dashboard
          </span>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2" role="toolbar" aria-label="Main controls">
        <button
          className={`p-2 hover:bg-command-accent rounded transition-colors ${
            audioSettings.muted ? '' : 'bg-hud-green/10'
          }`}
          onClick={toggleMute}
          aria-label={audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
          aria-pressed={!audioSettings.muted}
        >
          {audioSettings.muted ? (
            <VolumeX className="w-5 h-5 text-gray-400" aria-hidden="true" />
          ) : (
            <Volume2 className="w-5 h-5 text-hud-green" aria-hidden="true" />
          )}
          <span className="sr-only">{audioSettings.muted ? 'Unmute' : 'Mute'} audio</span>
        </button>
        <button
          className={`relative p-2 hover:bg-command-accent rounded transition-colors ${
            toolLogOpen ? 'bg-hud-blue/20' : ''
          }`}
          onClick={toggleToolLog}
          aria-label="Tool execution log"
          aria-pressed={toolLogOpen}
        >
          <Terminal className={`w-5 h-5 ${toolLogOpen ? 'text-hud-blue' : 'text-gray-400'}`} aria-hidden="true" />
        </button>
        <button
          className={`relative p-2 hover:bg-command-accent rounded transition-colors ${
            chatPanelOpen ? 'bg-hud-green/20' : ''
          }`}
          onClick={toggleChatPanel}
          aria-label="Chat with agents"
          aria-pressed={chatPanelOpen}
        >
          <MessageSquare className={`w-5 h-5 ${chatPanelOpen ? 'text-hud-green' : 'text-gray-400'}`} aria-hidden="true" />
        </button>
        <button
          className="relative p-2 hover:bg-command-accent rounded transition-colors"
          onClick={toggleAlertsPanel}
          aria-label={`Alerts${unacknowledgedAlerts > 0 ? `, ${unacknowledgedAlerts} unacknowledged` : ''}`}
        >
          <Bell className="w-5 h-5 text-gray-400" aria-hidden="true" />
          {unacknowledgedAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-hud-red text-white text-xs rounded-full flex items-center justify-center" aria-hidden="true">
              {unacknowledgedAlerts}
            </span>
          )}
          <span className="sr-only">{unacknowledgedAlerts > 0 ? `${unacknowledgedAlerts} unacknowledged alerts` : 'No alerts'}</span>
        </button>
        <button
          className={`p-2 hover:bg-command-accent rounded transition-colors ${
            resetting ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleResetAgents}
          disabled={resetting}
          aria-label="Reset all agents"
        >
          <RefreshCcw className={`w-5 h-5 text-hud-red ${resetting ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
        <button
          onClick={toggleSettingsModal}
          className={`p-2 hover:bg-command-accent rounded transition-colors ${
            settingsModalOpen ? 'bg-hud-green/20' : ''
          }`}
          aria-label="Settings"
          aria-pressed={settingsModalOpen}
        >
          <Settings className={`w-5 h-5 ${settingsModalOpen ? 'text-hud-green' : 'text-gray-400'}`} aria-hidden="true" />
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal />
    </header>
  );
}
