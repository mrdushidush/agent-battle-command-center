import { useUIStore } from '../../store/uiState';
import { useMemo } from 'react';

const STATUS_ORDER = ['pending', 'assigned', 'in_progress', 'completed', 'failed', 'aborted', 'needs_human'];

const STATUS_COLORS: Record<string, string> = {
  pending: '#6B7280',
  assigned: '#8B5CF6',
  in_progress: '#3B82F6',
  needs_human: '#F59E0B',
  completed: '#10B981',
  failed: '#EF4444',
  aborted: '#6B7280',
};

const LANE_POSITIONS = {
  pending: 0,
  assigned: 1,
  in_progress: 2,
  completed: 3,
  failed: 3,
  aborted: 3,
  needs_human: 2,
};

export function TimelineMinimap() {
  const { tasks, agents, selectTask, selectedTaskId } = useUIStore();

  // Filter out tasks older than 24 hours
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentTasks = useMemo(() =>
    tasks.filter(task => {
      const taskDate = new Date(task.createdAt).getTime();
      return taskDate > twentyFourHoursAgo;
    }),
    [tasks]
  );

  // Group tasks by status for positioning
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, typeof recentTasks> = {};
    STATUS_ORDER.forEach(status => {
      grouped[status] = recentTasks.filter(t => t.status === status);
    });
    return grouped;
  }, [recentTasks]);

  // Calculate task positions
  const getTaskPosition = (task: typeof recentTasks[0]) => {
    const status = task.status;
    const tasksInStatus = tasksByStatus[status] || [];
    const indexInStatus = tasksInStatus.findIndex(t => t.id === task.id);
    const totalInStatus = tasksInStatus.length;

    // X position based on status (lane)
    const laneIndex = LANE_POSITIONS[status as keyof typeof LANE_POSITIONS] ?? 0;
    const x = 15 + (laneIndex / 3) * 70; // 15% to 85% horizontal spread

    // Y position based on index within status group
    const ySpread = 70; // vertical spread
    const yStart = 15; // top padding
    const yStep = totalInStatus > 1 ? ySpread / (totalInStatus - 1) : 0;
    const y = yStart + indexInStatus * yStep;

    return { x, y };
  };

  // Get agent positions for connection lines
  const getAgentPosition = (agentId: string) => {
    const agentIndex = agents.findIndex(a => a.id === agentId);
    const totalAgents = agents.length;
    if (agentIndex === -1) return { x: 50, y: 92 };

    const xSpread = 40;
    const xStart = 30;
    const xStep = totalAgents > 1 ? xSpread / (totalAgents - 1) : 0;
    return {
      x: xStart + agentIndex * xStep,
      y: 92,
    };
  };

  const activeTaskCount = recentTasks.filter(t =>
    ['in_progress', 'assigned'].includes(t.status)
  ).length;

  return (
    <div className="h-full timeline-minimap p-2 relative">
      {/* Radar sweep effect */}
      <div className="radar-sweep opacity-30" />

      {/* Radar rings */}
      <div className="radar-rings" />

      {/* SVG Container */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        <defs>
          <linearGradient id="gridGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 255, 136, 0)" />
            <stop offset="50%" stopColor="rgba(0, 255, 136, 0.15)" />
            <stop offset="100%" stopColor="rgba(0, 255, 136, 0)" />
          </linearGradient>
          <linearGradient id="laneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 255, 136, 0.05)" />
            <stop offset="100%" stopColor="rgba(0, 255, 136, 0)" />
          </linearGradient>
        </defs>

        {/* Horizontal lane separators */}
        {[25, 50, 75].map(y => (
          <line
            key={`h-${y}`}
            x1="5"
            y1={y}
            x2="95"
            y2={y}
            stroke="url(#gridGradient)"
            strokeWidth="0.3"
          />
        ))}

        {/* Vertical status column indicators */}
        {[15, 38, 62, 85].map((x) => (
          <g key={`col-${x}`}>
            <line
              x1={x}
              y1="10"
              x2={x}
              y2="85"
              stroke="rgba(0, 255, 136, 0.1)"
              strokeWidth="0.3"
              strokeDasharray="2,2"
            />
            {/* Column header backgrounds */}
            <rect
              x={x - 10}
              y={2}
              width="20"
              height="6"
              fill="rgba(0, 255, 136, 0.05)"
              rx="1"
            />
          </g>
        ))}

        {/* Connection lines for assigned tasks */}
        {recentTasks
          .filter(t => t.assignedAgentId && ['in_progress', 'assigned'].includes(t.status))
          .map(task => {
            const taskPos = getTaskPosition(task);
            const agentPos = getAgentPosition(task.assignedAgentId!);
            const color = STATUS_COLORS[task.status];

            return (
              <line
                key={`line-${task.id}`}
                x1={taskPos.x}
                y1={taskPos.y}
                x2={agentPos.x}
                y2={agentPos.y}
                stroke={color}
                strokeWidth={0.5}
                className="timeline-connection"
                opacity={0.6}
              />
            );
          })}

        {/* Task dots */}
        {recentTasks.map(task => {
          const pos = getTaskPosition(task);
          const isSelected = task.id === selectedTaskId;
          const isActive = ['in_progress', 'assigned'].includes(task.status);
          const color = STATUS_COLORS[task.status];

          return (
            <g key={task.id} className="timeline-task-dot cursor-pointer">
              {/* Glow effect for active tasks */}
              {isActive && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={6}
                  fill={color}
                  opacity={0.3}
                  className="animate-pulse"
                />
              )}

              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={5}
                  fill="none"
                  stroke="#00aaff"
                  strokeWidth={1}
                  className="animate-pulse"
                />
              )}

              {/* Main dot */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={3}
                fill={color}
                className="hover:opacity-80 transition-opacity"
                onClick={() => selectTask(task.id)}
              >
                <title>{task.title} ({task.status.replace('_', ' ')})</title>
              </circle>

              {/* Loop indicator */}
              {task.status === 'needs_human' && (
                <text
                  x={pos.x}
                  y={pos.y - 6}
                  textAnchor="middle"
                  fill="#F59E0B"
                  fontSize="4"
                  className="animate-pulse"
                >
                  !
                </text>
              )}
            </g>
          );
        })}

        {/* Agent indicators at bottom */}
        {agents.map(agent => {
          const pos = getAgentPosition(agent.id);
          const isActive = agent.status === 'busy';
          const color = agent.type === 'coder' ? '#3B82F6' : agent.type === 'cto' ? '#F59E0B' : '#10B981';

          return (
            <g key={agent.id}>
              {isActive && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={5}
                  fill={color}
                  opacity={0.3}
                  className="animate-pulse"
                />
              )}
              <rect
                x={pos.x - 3}
                y={pos.y - 2}
                width={6}
                height={4}
                fill={color}
                rx={1}
                opacity={isActive ? 1 : 0.5}
              >
                <title>{agent.id} ({agent.status})</title>
              </rect>
            </g>
          );
        })}
      </svg>

      {/* Status labels */}
      <div className="absolute top-1 left-0 right-0 flex justify-around text-[7px] text-gray-600 font-display tracking-wider">
        <span>PEND</span>
        <span>ASGN</span>
        <span>WORK</span>
        <span>DONE</span>
      </div>

      {/* Legend and stats */}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
        <div className="flex gap-2 text-[7px] text-gray-500">
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-active" />
            Active
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-stuck" />
            Stuck
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-status-completed" />
            Done
          </span>
        </div>
        <div className="text-[8px] text-hud-green font-mono">
          {activeTaskCount} ACTIVE
        </div>
      </div>
    </div>
  );
}
