import { Settings, Bell, Zap, Clock, RotateCw, MessageSquare, RefreshCcw, Volume2, VolumeX, Terminal } from 'lucide-react';
import { ResourceBar } from '../resources/ResourceBar';
import { useUIStore } from '../../store/uiState';
import { useState } from 'react';
import { audioManager } from '../../audio/audioManager';

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
    metrics,
  } = useUIStore();
  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged).length;
  const [resetting, setResetting] = useState(false);

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
      const response = await fetch('http://localhost:3001/api/agents/reset-all', {
        method: 'POST',
      });

      const result = await response.json();

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
        <ResourceBar
          label="API Credits"
          icon={<Zap className="w-4 h-4" />}
          value={metrics.totalApiCredits}
          max={5000}
          color="green"
        />
        <ResourceBar
          label="Time"
          icon={<Clock className="w-4 h-4" />}
          value={Math.floor(metrics.totalTimeMs / 1000 / 60)}
          max={8 * 60}
          color="blue"
          format="time"
        />
        <ResourceBar
          label="Iterations"
          icon={<RotateCw className="w-4 h-4" />}
          value={metrics.totalIterations}
          max={100}
          color="purple"
        />
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
          className={`mode-toggle-btn ${mode === 'micromanager' ? 'active' : ''}`}
          onClick={() => setMode('micromanager')}
        >
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${mode === 'micromanager' ? 'bg-hud-green' : 'bg-gray-600'}`} />
            Micromanager
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
      <div className="flex items-center gap-2">
        <button
          className={`p-2 hover:bg-command-accent rounded transition-colors ${
            audioSettings.muted ? '' : 'bg-hud-green/10'
          }`}
          onClick={toggleMute}
          title={audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
        >
          {audioSettings.muted ? (
            <VolumeX className="w-5 h-5 text-gray-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-hud-green" />
          )}
        </button>
        <button
          className={`relative p-2 hover:bg-command-accent rounded transition-colors ${
            toolLogOpen ? 'bg-hud-blue/20' : ''
          }`}
          onClick={toggleToolLog}
          title="Tool execution log"
        >
          <Terminal className={`w-5 h-5 ${toolLogOpen ? 'text-hud-blue' : 'text-gray-400'}`} />
        </button>
        <button
          className={`relative p-2 hover:bg-command-accent rounded transition-colors ${
            chatPanelOpen ? 'bg-hud-green/20' : ''
          }`}
          onClick={toggleChatPanel}
          title="Chat with agents"
        >
          <MessageSquare className={`w-5 h-5 ${chatPanelOpen ? 'text-hud-green' : 'text-gray-400'}`} />
        </button>
        <button
          className="relative p-2 hover:bg-command-accent rounded transition-colors"
          onClick={toggleAlertsPanel}
        >
          <Bell className="w-5 h-5 text-gray-400" />
          {unacknowledgedAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-hud-red text-white text-xs rounded-full flex items-center justify-center">
              {unacknowledgedAlerts}
            </span>
          )}
        </button>
        <button
          className={`p-2 hover:bg-command-accent rounded transition-colors ${
            resetting ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleResetAgents}
          disabled={resetting}
          title="DEBUG: Reset all agents (clears stuck states)"
        >
          <RefreshCcw className={`w-5 h-5 text-hud-red ${resetting ? 'animate-spin' : ''}`} />
        </button>
        <button className="p-2 hover:bg-command-accent rounded transition-colors">
          <Settings className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </header>
  );
}
