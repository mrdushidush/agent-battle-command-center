import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Minimap } from '../minimap/Minimap';
import { TaskQueue } from '../main-view/TaskQueue';
import { BattlefieldView } from '../battlefield/BattlefieldView';
import { ActiveMissions } from '../main-view/ActiveMissions';
import { ToolLog } from '../main-view/ToolLog';
import { TokenBurnLog } from '../main-view/TokenBurnLog';
import { AlertPanel } from '../resources/AlertPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { Dashboard } from '../dashboard/Dashboard';
import { useUIStore } from '../../store/uiState';
import { ComponentErrorBoundary } from '../ComponentErrorBoundary';

export function CommandCenter() {
  const { mode, sidebarCollapsed, alertsPanelOpen, chatPanelOpen, toolLogOpen, toggleChatPanel, agents, battlefieldEnabled } = useUIStore();

  return (
    <div className="h-full flex flex-col command-bg-enhanced">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`transition-all duration-300 ${
            sidebarCollapsed ? 'w-16' : 'w-[40rem]'
          } flex flex-col border-r border-command-border`}
        >
          {/* Minimap - Square radar display (40rem = 640px) */}
          <div className={`border-b border-command-border ${
            sidebarCollapsed ? 'w-16 h-16' : 'w-[40rem] h-[40rem]'
          } flex-shrink-0`}>
            <ComponentErrorBoundary componentName="Minimap">
              <Minimap />
            </ComponentErrorBoundary>
          </div>

          {/* Sidebar content - Flexible height */}
          <div className="flex-1 overflow-hidden">
            <ComponentErrorBoundary componentName="Sidebar">
              <Sidebar />
            </ComponentErrorBoundary>
          </div>
        </div>

        {/* Main View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'overseer' ? (
            <>
              {/* Task Queue / 3D Battlefield - Large area for task cards or holographic view */}
              <div className="flex-1 border-b border-command-border overflow-hidden">
                <ComponentErrorBoundary componentName="Task Queue">
                  {battlefieldEnabled ? <BattlefieldView /> : <TaskQueue />}
                </ComponentErrorBoundary>
              </div>

              {/* Active Missions - Compact running tasks strip */}
              <div className="h-[140px] min-h-[140px] overflow-hidden">
                <ComponentErrorBoundary componentName="Active Missions">
                  <ActiveMissions />
                </ComponentErrorBoundary>
              </div>

              {/* Tool Log Panel - Split view with Token Burn Rate */}
              {toolLogOpen && (
                <div className="h-64 border-t border-command-border overflow-hidden flex gap-2 p-2 bg-command-bg">
                  {/* Left: Execution Log */}
                  <div className="flex-1 overflow-hidden">
                    <ComponentErrorBoundary componentName="Tool Log">
                      <ToolLog />
                    </ComponentErrorBoundary>
                  </div>
                  {/* Right: Token Burn Rate */}
                  <div className="flex-1 overflow-hidden">
                    <ComponentErrorBoundary componentName="Token Burn Log">
                      <TokenBurnLog />
                    </ComponentErrorBoundary>
                  </div>
                </div>
              )}
            </>
          ) : (
            <ComponentErrorBoundary componentName="Dashboard">
              <Dashboard />
            </ComponentErrorBoundary>
          )}
        </div>

        {/* Alerts Panel */}
        {alertsPanelOpen && (
          <div className="w-80 border-l border-command-border">
            <ComponentErrorBoundary componentName="Alerts Panel">
              <AlertPanel />
            </ComponentErrorBoundary>
          </div>
        )}

        {/* Chat Panel */}
        {chatPanelOpen && (
          <div className="w-80 border-l border-command-border">
            <ComponentErrorBoundary componentName="Chat Panel">
              <ChatPanel agents={agents} onClose={toggleChatPanel} />
            </ComponentErrorBoundary>
          </div>
        )}
      </div>
    </div>
  );
}
