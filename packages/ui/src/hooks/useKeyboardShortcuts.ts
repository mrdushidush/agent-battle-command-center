import { useEffect, useCallback } from 'react';
import { useUIStore } from '../store/uiState';

interface KeyboardShortcutsOptions {
  enabled?: boolean;
  onRefresh?: () => void;
}

/**
 * Hook for managing keyboard shortcuts in the command center.
 * 
 * Shortcuts:
 * - M: Toggle mute/unmute audio
 * - 1-2: Switch between dashboard modes (overseer/dashboard)
 * - Escape: Close detail panels
 * - R: Refresh task queue
 * - ?: Show keyboard shortcut help overlay
 */
export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const { enabled = true, onRefresh } = options;
  
  const {
    setMuted,
    audioSettings,
    setMode,
    selectTask,
    selectAgent,
    selectedTaskId,
    selectedAgentId,
    settingsModalOpen,
    toggleSettingsModal,
  } = useUIStore();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    // Don't trigger if shortcuts are disabled
    if (!enabled) return;

    switch (event.key.toLowerCase()) {
      case 'm':
        // Toggle mute
        event.preventDefault();
        setMuted(!audioSettings.muted);
        break;

      case '1':
        // Switch to overseer mode
        event.preventDefault();
        setMode('overseer');
        break;

      case '2':
        // Switch to dashboard mode
        event.preventDefault();
        setMode('dashboard');
        break;

      case 'r':
        // Refresh task queue
        if (onRefresh) {
          event.preventDefault();
          onRefresh();
        }
        break;

      case 'escape':
        // Close detail panels
        event.preventDefault();
        if (selectedTaskId) {
          selectTask(null);
        } else if (selectedAgentId) {
          selectAgent(null);
        } else if (settingsModalOpen) {
          toggleSettingsModal();
        }
        break;

      case '?':
        // Show help overlay - dispatch custom event
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('show-shortcuts-help'));
        break;
    }
  }, [
    enabled,
    audioSettings.muted,
    setMuted,
    setMode,
    selectTask,
    selectAgent,
    selectedTaskId,
    selectedAgentId,
    settingsModalOpen,
    toggleSettingsModal,
    onRefresh,
  ]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  return {
    shortcuts: [
      { key: 'M', description: 'Toggle mute/unmute audio' },
      { key: '1', description: 'Switch to Overseer mode' },
      { key: '2', description: 'Switch to Dashboard mode' },
      { key: 'R', description: 'Refresh task queue' },
      { key: 'Esc', description: 'Close detail panels' },
      { key: '?', description: 'Show this help' },
    ],
  };
}
