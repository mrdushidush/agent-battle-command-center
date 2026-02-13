import { useCallback, useState } from 'react';
import { tasksApi, executeApi } from '../api/client';
import { useUIStore } from '../store/uiState';
import type { TaskType, TaskPriority, AgentType } from '@abcc/shared';

export function useTasks() {
  const { tasks, setTasks, updateTask, selectTask, selectedTaskId, setLoading } = useUIStore();
  const [loading, setLoadingLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (filters?: { status?: string; requiredAgent?: string }) => {
    setLoadingLocal(true);
    setLoading('tasks', true);
    setError(null);
    try {
      const data = await tasksApi.list(filters);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoadingLocal(false);
      setLoading('tasks', false);
    }
  }, [setTasks, setLoading]);

  const createTask = useCallback(async (data: {
    title: string;
    description?: string;
    taskType: TaskType;
    requiredAgent?: AgentType;
    priority?: TaskPriority;
    maxIterations?: number;
    lockedFiles?: string[];
  }) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const task = await tasksApi.create(data);
      updateTask(task);
      return task;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateTask]);

  const updateTaskData = useCallback(async (id: string, data: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    maxIterations?: number;
  }) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const task = await tasksApi.update(id, data);
      updateTask(task);
      return task;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateTask]);

  const deleteTask = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      await tasksApi.delete(id);
      if (selectedTaskId === id) {
        selectTask(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [selectedTaskId, selectTask]);

  const retryTask = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const task = await tasksApi.retry(id);
      updateTask(task);
      return task;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry task');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateTask]);

  const abortTask = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const task = await tasksApi.abort(id);
      updateTask(task);
      return task;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abort task');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateTask]);

  const submitHumanInput = useCallback(async (
    id: string,
    input: string,
    action: 'approve' | 'reject' | 'modify',
    modifiedContent?: string
  ) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const task = await tasksApi.submitHumanInput(id, { input, action, modifiedContent });
      updateTask(task);
      return task;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit human input');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateTask]);

  const startExecution = useCallback(async (
    taskId: string,
    options?: {
      useClaude?: boolean;
      model?: string;
      allowFallback?: boolean;
    }
  ) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const result = await executeApi.start(taskId, options);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start execution');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  // Computed values
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const activeTasks = tasks.filter(t => ['assigned', 'in_progress', 'needs_human'].includes(t.status));
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => ['failed', 'aborted'].includes(t.status));

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

  return {
    tasks,
    pendingTasks,
    activeTasks,
    completedTasks,
    failedTasks,
    selectedTask,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask: updateTaskData,
    deleteTask,
    retryTask,
    abortTask,
    submitHumanInput,
    startExecution,
    selectTask,
  };
}
