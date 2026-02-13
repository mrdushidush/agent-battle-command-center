import { Clock, AlertTriangle, CheckCircle, XCircle, Code, TestTube, Eye, Bug, RefreshCw, Play, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { Task } from '@abcc/shared';
import { useUIStore } from '../../store/uiState';
import { executeApi } from '../../api/client';
import { useTasks } from '../../hooks/useTasks';
import { EditTaskModal } from '../main-view/EditTaskModal';

type AnimationState = 'enter' | 'complete' | 'failed' | 'loop' | null;

const taskTypeIcons = {
  code: Code,
  test: TestTube,
  review: Eye,
  debug: Bug,
  refactor: RefreshCw,
};

const statusColors = {
  pending: 'border-status-pending/30',
  assigned: 'border-status-assigned/50',
  in_progress: 'border-status-active/50',
  needs_human: 'border-status-stuck/50',
  completed: 'border-status-completed/50',
  failed: 'border-status-failed/50',
  aborted: 'border-status-pending/30',
};

const priorityColors = {
  high: 'bg-hud-red/20 text-hud-red',
  medium: 'bg-hud-amber/20 text-hud-amber',
  low: 'bg-gray-500/20 text-gray-400',
};

interface TaskCardProps {
  task: Task;
  compact?: boolean;
  onClick?: () => void;
}

export function TaskCard({ task, compact = false, onClick }: TaskCardProps) {
  const { selectedTaskId, selectTask, agents, agentHealth } = useUIStore();
  const { deleteTask } = useTasks();
  const isSelected = selectedTaskId === task.id;
  const [executing, setExecuting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [animation, setAnimation] = useState<AnimationState>('enter');
  const prevStatusRef = useRef(task.status);

  const TaskIcon = taskTypeIcons[task.taskType as keyof typeof taskTypeIcons] || Code;
  const priorityLevel = task.priority >= 8 ? 'high' : task.priority >= 5 ? 'medium' : 'low';

  const isCompleted = ['completed', 'failed', 'aborted'].includes(task.status);

  // Check for loop detection
  const hasLoop = task.assignedAgentId && agentHealth[task.assignedAgentId]?.loopDetected;

  // Handle status change animations
  useEffect(() => {
    if (prevStatusRef.current !== task.status) {
      if (task.status === 'completed') {
        setAnimation('complete');
      } else if (task.status === 'failed') {
        setAnimation('failed');
      }

      // Clear animation after it plays
      const timer = setTimeout(() => setAnimation(null), 600);
      prevStatusRef.current = task.status;
      return () => clearTimeout(timer);
    }
  }, [task.status]);

  // Handle loop animation
  useEffect(() => {
    if (hasLoop) {
      setAnimation('loop');
    } else if (animation === 'loop') {
      setAnimation(null);
    }
  }, [hasLoop, animation]);

  // Clear enter animation after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (animation === 'enter') setAnimation(null);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Get animation class
  const getAnimationClass = () => {
    switch (animation) {
      case 'enter':
        return 'task-card-enter';
      case 'complete':
        return 'task-card-complete';
      case 'failed':
        return 'task-card-failed';
      case 'loop':
        return 'task-card-loop';
      default:
        return '';
    }
  };

  const handleClick = () => {
    selectTask(task.id);
    onClick?.();
  };

  const handleExecute = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger card selection

    // Find an appropriate agent
    const preferredAgent = agents.find(a =>
      task.requiredAgent ? a.type === task.requiredAgent : a.type === 'coder'
    );

    if (!preferredAgent) {
      alert('No suitable agent available');
      return;
    }

    setExecuting(true);
    try {
      const result = await executeApi.quickExecute(task.id, preferredAgent.id);
      if (result.queued) {
        // Task was queued because agent is busy - show friendly message
        alert(`📋 ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to execute task:', error);
      alert('Failed to execute task: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setExecuting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditModal(true);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Delete task "${task.title}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      await deleteTask(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  if (compact) {
    return (
      <div
        className={clsx(
          'panel p-2 cursor-pointer transition-all h-full flex flex-col',
          statusColors[task.status],
          isSelected && 'ring-1 ring-hud-blue/50',
          getAnimationClass()
        )}
        onClick={handleClick}
        role="article"
        aria-label={`${task.title}, ${task.status} status, priority ${task.priority}`}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <TaskIcon className={clsx(
            'w-3 h-3 flex-shrink-0',
            task.requiredAgent === 'coder' ? 'text-agent-coder' :
            task.requiredAgent === 'qa' ? 'text-agent-qa' : 'text-gray-400'
          )} aria-hidden="true" />
          <span className="text-[10px] truncate flex-1 font-medium">{task.title}</span>
        </div>
        <div className="flex items-center justify-between mt-auto">
          <span className={clsx(
            'text-[9px] px-1 py-0.5 rounded',
            priorityColors[priorityLevel]
          )} aria-label={`Priority ${task.priority}`}>
            P{task.priority}
          </span>
          <div className="flex items-center gap-1" aria-label={`Status: ${task.status}`}>
            {task.status === 'pending' && (
              <button
                onClick={handleExecute}
                disabled={executing}
                className="p-0.5 bg-hud-green/20 hover:bg-hud-green/30 text-hud-green rounded disabled:opacity-50"
                aria-label="Execute task"
              >
                <Play className="w-2.5 h-2.5" aria-hidden="true" />
              </button>
            )}
            {task.status === 'needs_human' && (
              <>
                <AlertTriangle className="w-3 h-3 text-hud-amber" aria-hidden="true" />
                <span className="sr-only">Needs human attention</span>
              </>
            )}
            {task.status === 'completed' && (
              <>
                <CheckCircle className="w-3 h-3 text-hud-green" aria-hidden="true" />
                <span className="sr-only">Completed</span>
              </>
            )}
            {task.status === 'failed' && (
              <>
                <XCircle className="w-3 h-3 text-hud-red" aria-hidden="true" />
                <span className="sr-only">Failed</span>
              </>
            )}
            {['assigned', 'in_progress'].includes(task.status) && (
              <>
                <Clock className="w-3 h-3 text-hud-blue animate-spin" style={{ animationDuration: '3s' }} aria-hidden="true" />
                <span className="sr-only">In progress</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'task-card',
        statusColors[task.status],
        isSelected && 'active',
        getAnimationClass(),
        task.status === 'in_progress' && 'status-glow-active',
        task.status === 'needs_human' && 'status-glow-warning'
      )}
      onClick={handleClick}
      role="article"
      aria-label={`${task.title}, ${task.status} status, priority ${task.priority}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {/* Header - Compact */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5">
          <div className={clsx(
            'w-6 h-6 rounded flex items-center justify-center',
            task.requiredAgent === 'coder' ? 'bg-agent-coder/20' :
            task.requiredAgent === 'qa' ? 'bg-agent-qa/20' : 'bg-gray-500/20'
          )} aria-hidden="true">
            <TaskIcon className={clsx(
              'w-3 h-3',
              task.requiredAgent === 'coder' ? 'text-agent-coder' :
              task.requiredAgent === 'qa' ? 'text-agent-qa' : 'text-gray-400'
            )} />
          </div>
          <div>
            <h3 className="text-xs font-medium truncate">{task.title}</h3>
            <span className="text-[10px] text-gray-500 capitalize">{task.taskType}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {task.status === 'pending' && (
            <button
              onClick={handleEdit}
              className="p-1 hover:bg-command-accent rounded transition-colors"
              aria-label="Edit task"
            >
              <Edit className="w-3 h-3 text-gray-400" aria-hidden="true" />
            </button>
          )}
          {isCompleted && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 hover:bg-hud-red/20 rounded transition-colors disabled:opacity-50"
              aria-label="Delete task"
            >
              <Trash2 className="w-3 h-3 text-hud-red" aria-hidden="true" />
            </button>
          )}
          <span className={clsx(
            'text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider',
            priorityColors[priorityLevel]
          )} aria-label={`Priority ${task.priority}`}>
            P{task.priority}
          </span>
        </div>
      </div>

      {/* Description - Compact */}
      {task.description && (
        <p className="text-[10px] text-gray-400 line-clamp-1 mb-1">
          {task.description}
        </p>
      )}

      {/* Footer - Compact */}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <div className="flex items-center gap-1" aria-label={`Status: ${task.status}`}>
          {task.status === 'pending' && (
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex items-center gap-0.5 px-1.5 py-0.5 bg-hud-green/20 hover:bg-hud-green/30 text-hud-green rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[10px]"
              aria-label="Execute task"
            >
              <Play className="w-2.5 h-2.5" aria-hidden="true" />
              {executing ? 'Start' : 'Exec'}
            </button>
          )}
          {task.status === 'needs_human' && (
            <span className="flex items-center gap-0.5 text-hud-amber" aria-label="Needs human attention">
              <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
              Human
            </span>
          )}
          {task.status === 'completed' && (
            <span className="flex items-center gap-0.5 text-hud-green" aria-label="Completed">
              <CheckCircle className="w-2.5 h-2.5" aria-hidden="true" />
              Done
            </span>
          )}
          {task.status === 'failed' && (
            <span className="flex items-center gap-0.5 text-hud-red" aria-label="Failed">
              <XCircle className="w-2.5 h-2.5" aria-hidden="true" />
              Fail
            </span>
          )}
          {['assigned', 'in_progress'].includes(task.status) && (
            <span className="flex items-center gap-0.5 text-hud-blue" aria-label="In progress">
              <Clock className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '3s' }} aria-hidden="true" />
              Work
            </span>
          )}
        </div>
        <span className="text-[9px]" aria-label={`Iteration ${task.currentIteration} of ${task.maxIterations}`}>
          {task.currentIteration}/{task.maxIterations}
        </span>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditTaskModal task={task} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
