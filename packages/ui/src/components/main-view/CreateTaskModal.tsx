import { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import type { TaskType, TaskPriority, AgentType } from '@abcc/shared';

interface CreateTaskModalProps {
  onClose: () => void;
}

export function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const { createTask, loading, error } = useTasks();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('code');
  const [requiredAgent, setRequiredAgent] = useState<AgentType | ''>('');
  const [priority, setPriority] = useState<TaskPriority>(5);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationCommand, setValidationCommand] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createTask({
        title,
        description: description || undefined,
        taskType,
        requiredAgent: requiredAgent || undefined,
        priority,
        validationCommand: validationCommand.trim() || undefined,
      });
      onClose();
    } catch (err) {
      // Error is handled by the hook
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-command-panel border border-command-border rounded-lg w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-command-border flex items-center justify-between">
          <h2 className="font-display text-sm uppercase tracking-wider">Create Task</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-command-accent rounded-sm transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-command-bg border border-command-border rounded-sm px-3 py-2 text-sm focus:outline-hidden focus:border-hud-blue"
              placeholder="Task title..."
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-command-bg border border-command-border rounded-sm px-3 py-2 text-sm focus:outline-hidden focus:border-hud-blue h-24 resize-none"
              placeholder="Task description..."
            />
          </div>

          {/* Type and Agent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
                className="w-full bg-command-bg border border-command-border rounded-sm px-3 py-2 text-sm focus:outline-hidden focus:border-hud-blue"
              >
                <option value="code">Code</option>
                <option value="test">Test</option>
                <option value="review">Review</option>
                <option value="debug">Debug</option>
                <option value="refactor">Refactor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Required Agent</label>
              <select
                value={requiredAgent}
                onChange={(e) => setRequiredAgent(e.target.value as AgentType | '')}
                className="w-full bg-command-bg border border-command-border rounded-sm px-3 py-2 text-sm focus:outline-hidden focus:border-hud-blue"
              >
                <option value="">Any</option>
                <option value="coder">Coder</option>
                <option value="qa">QA</option>
              </select>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Priority: {priority}
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) as TaskPriority)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
              Advanced Options
            </button>
            {showAdvanced && (
              <div className="mt-2">
                <label className="block text-xs text-gray-400 mb-1">
                  Validation Command
                </label>
                <textarea
                  value={validationCommand}
                  onChange={(e) => setValidationCommand(e.target.value)}
                  className="w-full bg-command-bg border border-command-border rounded-sm px-3 py-2 text-sm font-mono focus:outline-hidden focus:border-hud-blue h-20 resize-none"
                  placeholder='python -c "from tasks.example import fn; assert fn(1) == 2"'
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Shell command to validate task output. Enables auto-retry on failure.
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-hud-red bg-hud-red/10 border border-hud-red/30 rounded-sm p-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn bg-command-accent text-gray-300 hover:bg-command-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
