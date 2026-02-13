import { ArrowRight, AlertTriangle, Loader, Zap, Activity } from 'lucide-react';
import { useUIStore } from '../../store/uiState';
import { ActiveMissionsSkeleton } from '../shared/Skeleton';
import type { Agent, Task } from '@abcc/shared';
import { useEffect, useState } from 'react';

interface CompactMissionProps {
  agent: Agent;
  task: Task;
}

function CompactMission({ agent, task }: CompactMissionProps) {
  const { agentHealth } = useUIStore();
  const [responseTime, setResponseTime] = useState<number>(0);

  const progress = Math.min((task.currentIteration / task.maxIterations) * 100, 100);
  const isStuck = task.status === 'needs_human';
  const health = agentHealth[agent.id];
  const loopDetected = health?.loopDetected || false;

  // Calculate token usage percentage
  const tokenUsagePercent = health
    ? Math.min(
        ((health.tokenBudget.input + health.tokenBudget.output) /
          (health.tokenBudget.maxInput + health.tokenBudget.maxOutput)) *
          100,
        100
      )
    : 0;

  // Update response time
  useEffect(() => {
    if (health?.lastActionTime) {
      const interval = setInterval(() => {
        setResponseTime(Date.now() - health.lastActionTime!);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [health?.lastActionTime]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className={`flex flex-col gap-1 px-3 py-2 rounded-lg border min-w-[240px] ${
      isStuck || loopDetected
        ? 'border-hud-amber/50 bg-hud-amber/5 animate-pulse'
        : 'border-command-border bg-command-panel'
    }`} role="article" aria-label={`${agent.name} working on ${task.title}`}>
      {/* Top row: Agent + Task */}
      <div className="flex items-center gap-2">
        {/* Agent indicator */}
        <div 
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            agent.type === 'coder' ? 'bg-agent-coder' :
            agent.type === 'qa' ? 'bg-agent-qa' : 'bg-agent-cto'
          }`}
          aria-hidden="true"
        />
        <span className="sr-only">{agent.type} agent</span>

        {/* Agent name */}
        <span className="text-[10px] text-gray-500 w-16 truncate">{agent.name}</span>

        <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" aria-hidden="true" />

        {/* Task title */}
        <span className="text-xs truncate flex-1 min-w-0">{task.title}</span>

        {/* Status */}
        {isStuck || loopDetected ? (
          <>
            <AlertTriangle className="w-3 h-3 text-hud-amber flex-shrink-0" aria-hidden="true" />
            <span className="sr-only">Needs attention</span>
          </>
        ) : (
          <>
            <Loader className="w-3 h-3 text-hud-blue flex-shrink-0 animate-spin" style={{ animationDuration: '2s' }} aria-hidden="true" />
            <span className="sr-only">In progress</span>
          </>
        )}
      </div>

      {/* Bottom row: Metrics */}
      <div className="flex items-center gap-3 text-[10px]">
        {/* Iteration progress */}
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-gray-500" aria-hidden="true" />
          <span className="text-gray-500">{task.currentIteration}/{task.maxIterations}</span>
          <div className="w-8 h-1 bg-command-accent rounded-full overflow-hidden ml-1" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Iteration progress">
            <div
              className={`h-full ${isStuck || loopDetected ? 'bg-hud-amber' : 'bg-hud-blue'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Token usage */}
        {health && (
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-gray-500" aria-hidden="true" />
            <span className={`font-mono ${tokenUsagePercent > 80 ? 'text-hud-red' : 'text-gray-500'}`}>
              {Math.round(tokenUsagePercent)}%
            </span>
            <span className="sr-only">token usage</span>
          </div>
        )}

        {/* Response time */}
        {health?.lastActionTime && (
          <span className="text-gray-500 font-mono">{formatTime(responseTime)}</span>
        )}

        {/* Loop warning */}
        {loopDetected && (
          <span className="text-hud-amber uppercase font-semibold" role="status" aria-label="Loop detected">
            LOOP
          </span>
        )}
      </div>
    </div>
  );
}

export function ActiveMissions() {
  const { tasks, agents, isLoading } = useUIStore();

  const activeTasks = tasks.filter(t =>
    ['assigned', 'in_progress', 'needs_human'].includes(t.status)
  );

  // Get missions (agent + task pairs)
  const missions = activeTasks
    .filter(t => t.assignedAgentId)
    .map(task => ({
      task,
      agent: agents.find(a => a.id === task.assignedAgentId)!,
    }))
    .filter(m => m.agent);

  // Tasks waiting for human input
  const stuckTasks = activeTasks.filter(t => t.status === 'needs_human');

  return (
    <div className="h-full flex flex-col bg-command-bg" role="region" aria-label="Active missions">
      {/* Compact Header */}
      <div className="px-3 py-2 border-t border-command-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xs uppercase tracking-wider text-gray-400" id="active-missions-heading">
            Running
          </h2>
          <span className="text-[10px] text-gray-500" aria-live="polite">
            {missions.length} active
          </span>
        </div>

        {stuckTasks.length > 0 && (
          <div className="flex items-center gap-1 text-hud-amber text-[10px]" role="status" aria-label={`${stuckTasks.length} tasks need attention`}>
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            <span>{stuckTasks.length} stuck</span>
          </div>
        )}
      </div>

      {/* Horizontal scrolling mission strip */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 pb-2" role="list" aria-labelledby="active-missions-heading">
        {isLoading.agents || isLoading.tasks ? (
          <ActiveMissionsSkeleton count={3} />
        ) : missions.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 text-xs" role="status">
            No active tasks - agents idle
          </div>
        ) : (
          <div className="flex gap-2 h-full items-center">
            {missions.map(({ agent, task }) => (
              <div key={task.id} className="flex-shrink-0" role="listitem">
                <CompactMission agent={agent} task={task} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
