import { useState, useEffect } from 'react';
import { X, Volume2, DollarSign, Monitor, Palette, Play } from 'lucide-react';
import { useUIStore } from '../../store/uiState';
import { audioManager } from '../../audio/audioManager';
import { apiPost } from '../../lib/api';
import { defaultVoicePack } from '../../audio/voicePacks';
import { useTheme, getThemeList } from '../../themes/index';

type SettingsTab = 'audio' | 'budget' | 'display' | 'theme';

export function SettingsModal() {
  const theme = useTheme();
  const {
    settingsModalOpen,
    toggleSettingsModal,
    audioSettings,
    setMuted,
    setVolume,
    settings,
    updateSettings,
    budget,
    updateBudget,
  } = useUIStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [isTesting, setIsTesting] = useState(false);
  const [budgetInput, setBudgetInput] = useState<string>('');

  // Initialize budget input when modal opens
  useEffect(() => {
    if (settingsModalOpen) {
      setBudgetInput((budget.dailyLimitCents / 100).toFixed(2));
    }
  }, [settingsModalOpen, budget.dailyLimitCents]);

  const setTheme = useUIStore((s) => s.setTheme);
  const themeId = useUIStore((s) => s.themeId);

  if (!settingsModalOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'budget', label: 'Budget', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'display', label: 'Display', icon: <Monitor className="w-4 h-4" /> },
    { id: 'theme', label: 'Theme', icon: <Palette className="w-4 h-4" /> },
  ];

  // Get all unique audio files from voice packs
  const getAllAudioFiles = () => {
    const audioFiles: { file: string; text: string }[] = [];
    Object.values(defaultVoicePack).forEach(eventLines => {
      eventLines.forEach(line => {
        if (!audioFiles.find(a => a.file === line.audioFile)) {
          audioFiles.push({ file: line.audioFile, text: line.text });
        }
      });
    });
    return audioFiles;
  };

  const handleTestSound = () => {
    if (isTesting) return; // Prevent multiple simultaneous tests

    audioManager.setMuted(false);
    audioManager.setVolume(audioSettings.volume);

    const allSounds = getAllAudioFiles();
    setIsTesting(true);

    // Play sounds in sequence with 1.5s delay between each
    let currentIndex = 0;
    const playNext = () => {
      if (currentIndex < allSounds.length) {
        const sound = allSounds[currentIndex];
        audioManager.playSound(sound.file, sound.text, 10);
        currentIndex++;
        setTimeout(playNext, 1500);
      } else {
        setIsTesting(false);
      }
    };

    playNext();
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    audioManager.setVolume(value);
  };

  const handleBudgetLimitChange = async () => {
    const cents = Math.round(parseFloat(budgetInput) * 100);
    if (isNaN(cents) || cents < 0) {
      setBudgetInput((budget.dailyLimitCents / 100).toFixed(2));
      return;
    }

    try {
      await apiPost('/api/budget/limit', { dailyLimitCents: cents });
      updateBudget({ dailyLimitCents: cents });
    } catch (error) {
      console.error('Failed to update budget limit:', error);
      setBudgetInput((budget.dailyLimitCents / 100).toFixed(2));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs"
        onClick={toggleSettingsModal}
      />

      {/* Modal */}
      <div className="relative bg-command-panel border border-command-border rounded-lg w-[600px] max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-command-border bg-linear-to-r from-hud-green/5 to-transparent">
          <h2 className="font-display text-lg tracking-wider text-hud-green">{theme.panels.appTitle} SETTINGS</h2>
          <button
            onClick={toggleSettingsModal}
            className="p-2 hover:bg-command-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-command-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-display tracking-wider transition-colors ${
                activeTab === tab.id
                  ? 'text-hud-green border-b-2 border-hud-green bg-hud-green/5'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {activeTab === 'audio' && (
            <div className="space-y-6">
              {/* Mute Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-200">Sound Effects</label>
                  <p className="text-xs text-gray-500 mt-1">Play audio feedback for events</p>
                </div>
                <button
                  onClick={() => {
                    setMuted(!audioSettings.muted);
                    audioManager.setMuted(!audioSettings.muted);
                  }}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    audioSettings.muted ? 'bg-gray-700' : 'bg-hud-green/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full transition-all ${
                      audioSettings.muted
                        ? 'left-1 bg-gray-500'
                        : 'left-8 bg-hud-green'
                    }`}
                  />
                </button>
              </div>

              {/* Volume Slider */}
              <div>
                <label className="text-sm font-medium text-gray-200 block mb-2">
                  Volume: {Math.round(audioSettings.volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={audioSettings.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-command-accent rounded-lg appearance-none cursor-pointer accent-hud-green"
                />
              </div>

              {/* Test Sound */}
              <div>
                <button
                  onClick={handleTestSound}
                  disabled={isTesting}
                  className={`flex items-center gap-2 px-4 py-2 bg-hud-green/20 text-hud-green border border-hud-green/30 rounded-lg transition-colors ${
                    isTesting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-hud-green/30'
                  }`}
                >
                  <Play className={`w-4 h-4 ${isTesting ? 'animate-pulse' : ''}`} />
                  {isTesting ? 'Testing All Sounds...' : 'Test All Sounds'}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  {isTesting ? 'Playing all sounds in sequence...' : 'Cycles through entire sound library'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'budget' && (
            <div className="space-y-6">
              {/* Daily Limit */}
              <div>
                <label className="text-sm font-medium text-gray-200 block mb-2">
                  Daily Budget Limit
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-mono text-hud-green">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    onBlur={handleBudgetLimitChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleBudgetLimitChange()}
                    className="w-32 px-4 py-2 bg-command-bg border border-command-border rounded-lg text-xl font-mono focus:outline-hidden focus:border-hud-green"
                  />
                  <button
                    onClick={handleBudgetLimitChange}
                    className="px-4 py-2 bg-hud-green/20 text-hud-green border border-hud-green/30 rounded-lg hover:bg-hud-green/30 transition-colors text-sm"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Claude API calls will be blocked when this limit is reached
                </p>
              </div>

              {/* Warning Threshold */}
              <div>
                <label className="text-sm font-medium text-gray-200 block mb-2">
                  Warning at: {Math.round((budget.dailyLimitCents * 0.8) / 100)}% (80% of limit)
                </label>
                <div className="h-3 bg-command-accent rounded-full overflow-hidden">
                  <div className="h-full bg-linear-to-r from-hud-green via-hud-amber to-hud-red" style={{ width: '100%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$0</span>
                  <span className="text-hud-amber">Warning</span>
                  <span>${(budget.dailyLimitCents / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Current Status */}
              <div className="p-4 bg-command-bg rounded-lg border border-command-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Today's Spending</span>
                  <span className={`text-lg font-mono ${
                    budget.isOverBudget ? 'text-hud-red' : budget.isWarning ? 'text-hud-amber' : 'text-hud-green'
                  }`}>
                    ${(budget.dailySpentCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      budget.isOverBudget ? 'bg-hud-red' : budget.isWarning ? 'bg-hud-amber' : 'bg-hud-green'
                    }`}
                    style={{ width: `${Math.min(budget.percentUsed * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="space-y-6">
              {/* Tool Log Default */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-200">Tool Log Open by Default</label>
                  <p className="text-xs text-gray-500 mt-1">Show execution log panel on startup</p>
                </div>
                <button
                  onClick={() => updateSettings({ toolLogOpenByDefault: !settings.toolLogOpenByDefault })}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    settings.toolLogOpenByDefault ? 'bg-hud-green/30' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 rounded-full transition-all ${
                      settings.toolLogOpenByDefault
                        ? 'left-8 bg-hud-green'
                        : 'left-1 bg-gray-500'
                    }`}
                  />
                </button>
              </div>

              {/* Minimap Style */}
              <div>
                <label className="text-sm font-medium text-gray-200 block mb-3">Minimap Style</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['timeline', 'grid', 'flow'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => updateSettings({ minimapStyle: style })}
                      className={`p-4 rounded-lg border transition-colors ${
                        settings.minimapStyle === style
                          ? 'border-hud-green bg-hud-green/10 text-hud-green'
                          : 'border-command-border hover:border-gray-600 text-gray-400'
                      }`}
                    >
                      <span className="block text-sm font-display capitalize">{style}</span>
                      <span className="block text-xs mt-1 opacity-70">
                        {style === 'timeline' && 'Status progression'}
                        {style === 'grid' && 'Classic grid view'}
                        {style === 'flow' && 'Agent flow'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-6">
              {/* Theme Selection */}
              <div>
                <label className="text-sm font-medium text-gray-200 block mb-3">Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  {getThemeList().map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-4 rounded-lg border transition-colors text-left ${
                        themeId === t.id
                          ? 'border-2 border-hud-green bg-hud-green/10'
                          : 'border-command-border hover:border-gray-600'
                      }`}
                    >
                      <span className="block text-sm font-medium text-gray-200">{t.name}</span>
                      <span className="block text-xs text-gray-500 mt-1">{t.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 bg-command-bg rounded-lg border border-command-border">
                <p className="text-sm text-gray-400 mb-2">Preview</p>
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full animate-pulse bg-hud-green" />
                  <span className="font-display tracking-wider text-hud-green">
                    {theme.logo.text}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
