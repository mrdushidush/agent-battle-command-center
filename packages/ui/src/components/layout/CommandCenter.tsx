import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Minimap } from '../minimap/Minimap';
import { TaskQueue } from '../main-view/TaskQueue';
import { ActiveMissions } from '../main-view/ActiveMissions';
import { ToolLog } from '../main-view/ToolLog';
import { AlertPanel } from '../resources/AlertPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { MicromanagerView } from '../micromanager/MicromanagerView';
import { Dashboard } from '../dashboard/Dashboard';
import { useUIStore } from '../../store/uiState';

export function CommandCenter() {
  const { mode, sidebarCollapsed, alertsPanelOpen, chatPanelOpen, toolLogOpen, toggleChatPanel, agents } = useUIStore();

  return (
    <div className="h-full flex flex-col bg-command-bg">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`transition-all duration-300 ${
            sidebarCollapsed ? 'w-16' : 'w-80'
          } flex flex-col border-r border-command-border`}
        >
          {/* Minimap - Much larger now */}
          <div className="flex-1 border-b border-command-border min-h-[400px]">
            <Minimap />
          </div>

          {/* Sidebar content - Smaller section */}
          <div className="h-64 overflow-hidden">
            <Sidebar />
          </div>
        </div>

        {/* Main View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'overseer' ? (
            <>
              {/* Task Queue (Bounty Board) - Large area for task cards */}
              <div className="flex-1 border-b border-command-border overflow-hidden">
                <TaskQueue />
              </div>

              {/* Active Missions - Compact running tasks strip */}
              <div className="h-[140px] min-h-[140px] overflow-hidden">
                <ActiveMissions />
              </div>

              {/* Tool Log Panel - Optional bottom panel */}
              {toolLogOpen && (
                <div className="h-64 border-t border-command-border overflow-hidden">
                  <ToolLog />
                </div>
              )}
            </>
          ) : mode === 'micromanager' ? (
            <MicromanagerView />
          ) : (
            <Dashboard />
          )}
        </div>

        {/* Alerts Panel */}
        {alertsPanelOpen && (
          <div className="w-80 border-l border-command-border">
            <AlertPanel />
          </div>
        )}

        {/* Chat Panel */}
        {chatPanelOpen && (
          <div className="w-80 border-l border-command-border">
            <ChatPanel agents={agents} onClose={toggleChatPanel} />
          </div>
        )}
      </div>
    </div>
  );
}
