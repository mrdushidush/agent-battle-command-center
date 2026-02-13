import { useCallback, useState } from 'react';
import { agentsApi, queueApi } from '../api/client';
import { useUIStore } from '../store/uiState';
import type { AgentConfig } from '@abcc/shared';

export function useAgents() {
  const { agents, setAgents, updateAgent, selectAgent, selectedAgentId, setLoading } = useUIStore();
  const [loading, setLoadingLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async (filters?: { type?: string; status?: string }) => {
    setLoadingLocal(true);
    setLoading('agents', true);
    setError(null);
    try {
      const data = await agentsApi.list(filters);
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setLoadingLocal(false);
      setLoading('agents', false);
    }
  }, [setAgents, setLoading]);

  const getAgent = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const data = await agentsApi.get(id);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, []);

  const updateAgentConfig = useCallback(async (id: string, config: Partial<AgentConfig>) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const agent = await agentsApi.update(id, config);
      updateAgent(agent);
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateAgent]);

  const pauseAgent = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const agent = await agentsApi.pause(id);
      updateAgent(agent);
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause agent');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateAgent]);

  const resumeAgent = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const agent = await agentsApi.resume(id);
      updateAgent(agent);
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume agent');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateAgent]);

  const abortAgentTask = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const agent = await agentsApi.abort(id);
      updateAgent(agent);
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abort agent task');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateAgent]);

  const setAgentOffline = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const agent = await agentsApi.setOffline(id);
      updateAgent(agent);
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set agent offline');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateAgent]);

  const setAgentOnline = useCallback(async (id: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const agent = await agentsApi.setOnline(id);
      updateAgent(agent);
      return agent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set agent online');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [updateAgent]);

  const assignTaskToAgent = useCallback(async (taskId: string, agentId: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      await queueApi.assign(taskId, agentId);
      // Refresh agents to get updated status
      await fetchAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign task');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [fetchAgents]);

  const autoAssignTask = useCallback(async (agentId: string) => {
    setLoadingLocal(true);
    setError(null);
    try {
      const result = await queueApi.autoAssign(agentId);
      if (result.assigned) {
        await fetchAgents();
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-assign task');
      throw err;
    } finally {
      setLoadingLocal(false);
    }
  }, [fetchAgents]);

  // Computed values
  const idleAgents = agents.filter(a => a.status === 'idle');
  const busyAgents = agents.filter(a => a.status === 'busy');
  const stuckAgents = agents.filter(a => a.status === 'stuck');
  const offlineAgents = agents.filter(a => a.status === 'offline');

  const coderAgents = agents.filter(a => a.type === 'coder');
  const qaAgents = agents.filter(a => a.type === 'qa');

  const selectedAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;

  return {
    agents,
    idleAgents,
    busyAgents,
    stuckAgents,
    offlineAgents,
    coderAgents,
    qaAgents,
    selectedAgent,
    loading,
    error,
    fetchAgents,
    getAgent,
    updateAgentConfig,
    pauseAgent,
    resumeAgent,
    abortAgentTask,
    setAgentOffline,
    setAgentOnline,
    assignTaskToAgent,
    autoAssignTask,
    selectAgent,
  };
}
