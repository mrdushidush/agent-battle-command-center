import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { AgentCard } from '../shared/AgentCard';
import { useUIStore } from '../../store/uiState';

// Agents to hide from UI (unused/test agents)
const HIDDEN_AGENTS: string[] = [];

export function Sidebar() {
  const { agents, sidebarCollapsed, toggleSidebar, alerts } = useUIStore();
  const unacknowledgedAlerts = alerts.filter(a => a && a.acknowledged === false).length;

  // Filter out hidden agents and group by type
  const visibleAgents = agents.filter(a => !HIDDEN_AGENTS.includes(a.id));
  const coderAgents = visibleAgents.filter(a => a.type === 'coder');
  const qaAgents = visibleAgents.filter(a => a.type === 'qa');

  if (sidebarCollapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-command-accent rounded transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        {/* Collapsed agent indicators */}
        <div className="flex-1 flex flex-col gap-2">
          {visibleAgents.map(agent => (
            <div
              key={agent.id}
              className={`w-8 h-8 rounded flex items-center justify-center ${
                agent.type === 'coder' ? 'bg-agent-coder/20' : 'bg-agent-qa/20'
              }`}
              title={`${agent.name} (${agent.status})`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  agent.status === 'idle' ? 'bg-status-completed' :
                  agent.status === 'busy' ? 'bg-status-active animate-pulse' :
                  agent.status === 'stuck' ? 'bg-status-stuck animate-pulse' :
                  'bg-status-pending'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Collapsed alerts indicator */}
        {unacknowledgedAlerts > 0 && (
          <div className="relative">
            <AlertTriangle className="w-5 h-5 text-hud-amber" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-hud-red text-white text-[10px] rounded-full flex items-center justify-center">
              {unacknowledgedAlerts}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-command-border flex items-center justify-between">
        <span className="font-display text-xs uppercase tracking-wider text-gray-400">
          Agents
        </span>
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-command-accent rounded transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Agent Lists */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Coders */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-agent-coder" />
            <span className="text-xs uppercase tracking-wider text-gray-500">Coders</span>
          </div>
          <div className="space-y-2">
            {coderAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent} compact />
            ))}
            {coderAgents.length === 0 && (
              <div className="text-xs text-gray-600 text-center py-2">No coder agents</div>
            )}
          </div>
        </div>

        {/* QA */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-agent-qa" />
            <span className="text-xs uppercase tracking-wider text-gray-500">QA</span>
          </div>
          <div className="space-y-2">
            {qaAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent} compact />
            ))}
            {qaAgents.length === 0 && (
              <div className="text-xs text-gray-600 text-center py-2">No QA agents</div>
            )}
          </div>
        </div>
      </div>

      {/* Alert Summary */}
      {unacknowledgedAlerts > 0 && (
        <div className="p-3 border-t border-command-border">
          <div className="flex items-center gap-2 text-hud-amber">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs">
              {unacknowledgedAlerts} alert{unacknowledgedAlerts !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
