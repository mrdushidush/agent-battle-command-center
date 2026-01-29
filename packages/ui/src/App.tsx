import { useEffect } from 'react';
import { CommandCenter } from './components/layout/CommandCenter';
import { useSocket } from './hooks/useSocket';
import { useAgents } from './hooks/useAgents';
import { useTasks } from './hooks/useTasks';
import { useUIStore } from './store/uiState';
import { audioManager } from './audio/audioManager';

function App() {
  const { connect, disconnect, isConnected } = useSocket();
  const { fetchAgents } = useAgents();
  const { fetchTasks } = useTasks();
  const { audioSettings } = useUIStore();

  useEffect(() => {
    connect();
    fetchAgents();
    fetchTasks();

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Sync audio settings with audio manager
  useEffect(() => {
    audioManager.setMuted(audioSettings.muted);
    audioManager.setVolume(audioSettings.volume);
  }, [audioSettings.muted, audioSettings.volume]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <CommandCenter />
      {!isConnected && (
        <div className="fixed bottom-4 right-4 bg-hud-amber/20 border border-hud-amber/50 text-hud-amber px-4 py-2 rounded-lg text-sm">
          Connecting to server...
        </div>
      )}
    </div>
  );
}

export default App;
