import { Plus, CheckCircle, Clock, Archive } from 'lucide-react';
import { useState, useMemo } from 'react';
import { TaskCard } from '../shared/TaskCard';
import { TaskQueueSkeleton } from '../shared/Skeleton';
import { useUIStore } from '../../store/uiState';
import { CreateTaskModal } from './CreateTaskModal';

// Helper to check if a date is today
function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false;

  const d = new Date(date);
  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function TaskQueue() {
  const { tasks, isLoading } = useUIStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'coder' | 'qa'>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const pendingTasks = useMemo(
    () => tasks.filter(t => t.status === 'pending'),
    [tasks]
  );
  const allCompletedTasks = useMemo(
    () => tasks.filter(t => ['completed', 'failed', 'aborted'].includes(t.status)),
    [tasks]
  );

  // Priority breakdown for pending tasks
  const priorityCount = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };

    pendingTasks.forEach(task => {
      const p = task.priority ?? 0;

      if (p >= 8) counts.high++;
      else if (p >= 5) counts.medium++;
      else counts.low++;
    });

    return counts;
  }, [pendingTasks]);

  const todayCompletedTasks = useMemo(
    () =>
      allCompletedTasks.filter(
        t => isToday(t.completedAt) || isToday(t.updatedAt)
      ),
    [allCompletedTasks]
  );

  // Filter completed tasks: show only today's unless archive mode is on
  const completedTasks = showArchive ? allCompletedTasks : todayCompletedTasks;
  const archivedCount = allCompletedTasks.length - todayCompletedTasks.length;

  const displayTasks = showCompleted ? completedTasks : pendingTasks;
  const filteredTasks = filter === 'all'
    ? displayTasks
    : displayTasks.filter(t => t.requiredAgent === filter || t.requiredAgent === null);

  return (
    <div className="h-full flex flex-col" role="region" aria-label="Task queue">
      {/* Header */}
      <div className="p-3 border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-sm uppercase tracking-wider text-gray-400" id="task-queue-heading">
            Task Queue
          </h2>
          <span className="text-xs text-gray-500" aria-live="polite">
            {showCompleted
              ? showArchive
                ? `${completedTasks.length} total completed`
                : `${completedTasks.length} completed today`
              : `${pendingTasks.length} pending`}
          </span>
        </div>

        <div className="flex items-center gap-2" role="toolbar" aria-label="Task queue controls">
          {/* Pending/Completed Toggle */}
          <button
            onClick={() => {
              setShowCompleted(prev => !prev);
              setShowArchive(false);
              setFilter('all');
            }}
            className={`p-1.5 rounded transition-colors ${showCompleted ? 'bg-hud-green/20 text-hud-green' : 'bg-command-accent text-gray-400'
              }`}
            aria-label={showCompleted ? 'Show pending tasks' : 'Show completed tasks'}
            aria-pressed={showCompleted}
          >
            {showCompleted ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Clock className="w-4 h-4" aria-hidden="true" />}
          </button>
          {/* Archive Toggle (only visible when showing completed) */}
          {showCompleted && archivedCount > 0 && (
            <button
              onClick={() => setShowArchive(!showArchive)}
              className={`p-1.5 rounded transition-colors flex items-center gap-1 text-xs ${showArchive ? 'bg-hud-orange/20 text-hud-orange' : 'bg-command-accent text-gray-400'
                }`}
              aria-label={showArchive ? 'Show today only' : `Show all archived tasks (${archivedCount})`}
              aria-pressed={showArchive}
            >
              <Archive className="w-4 h-4" aria-hidden="true" />
              {showArchive ? 'Today' : `+${archivedCount}`}
            </button>
          )}
          {/* Filter */}
          <div className="flex items-center gap-1 bg-command-accent rounded-lg p-1" role="group" aria-label="Filter by agent type">
            {['all', 'coder', 'qa'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as typeof filter)}
                className={`px-2 py-1 text-xs rounded ${filter === f
                  ? f === 'coder' ? 'bg-agent-coder/20 text-agent-coder'
                    : f === 'qa' ? 'bg-agent-qa/20 text-agent-qa'
                      : 'bg-command-panel text-white'
                  : 'text-gray-500'
                  }`}
                aria-label={`Filter by ${f === 'all' ? 'all agents' : f}`}
                aria-pressed={filter === f}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {/* Add Task */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs py-1.5"
            aria-label="Create new task"
          >
            <Plus className="w-3 h-3 inline mr-1" aria-hidden="true" />
            Add Task
          </button>
        </div>
      </div>

      {/* Priority Breakdown Row */}
      {!showCompleted && pendingTasks.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {priorityCount.high > 0 && (
            <span
              className="px-2 py-1 text-xs font-medium rounded-full bg-hud-red/20 text-hud-red"
              aria-label={`${priorityCount.high} high priority tasks`}
            >
              High {priorityCount.high}
            </span>
          )}

          {priorityCount.medium > 0 && (
            <span
              className="px-2 py-1 text-xs font-medium rounded-full bg-hud-amber/20 text-hud-amber"
              aria-label={`${priorityCount.medium} medium priority tasks`}
            >
              Medium {priorityCount.medium}
            </span>
          )}

          {priorityCount.low > 0 && (
            <span
              className="px-2 py-1 text-xs font-medium rounded-full bg-gray-500/20 text-gray-400"
              aria-label={`${priorityCount.low} low priority tasks`}
            >
              Low {priorityCount.low}
            </span>
          )}
        </div>
      )}

      {/* Task List - Full grid view */}
      <div className="flex-1 overflow-y-auto p-3" role="list" aria-labelledby="task-queue-heading">
        {isLoading.tasks ? (
          <TaskQueueSkeleton count={6} />
        ) : filteredTasks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm" role="status">
            <div className="text-center">
              <p>{showCompleted
                ? showArchive
                  ? 'No completed tasks'
                  : archivedCount > 0
                    ? 'No tasks completed today'
                    : 'No completed tasks'
                : 'No pending tasks'}</p>
              {!showCompleted && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-2 text-hud-blue hover:underline"
                >
                  Create one
                </button>
              )}
              {showCompleted && !showArchive && archivedCount > 0 && (
                <button
                  onClick={() => setShowArchive(true)}
                  className="mt-2 text-hud-orange hover:underline"
                >
                  View {archivedCount} archived tasks
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            {[...filteredTasks]
              .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
              .map(task => (
                <div key={task.id} role="listitem">
                  <TaskCard task={task} />
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
