import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost } from '../../lib/api';

interface TaskMemory {
  id: string;
  taskType: string;
  category: string | null;
  pattern: string;
  solution: string;
  errorPattern: string | null;
  keywords: string[];
  successCount: number;
  failureCount: number;
  approved: boolean;
  proposedByAgent: string | null;
  proposedByTask: string | null;
  createdAt: string;
}

interface MemoryStats {
  total: number;
  approved: number;
  pending: number;
  byTaskType: { taskType: string; count: number; totalSuccesses: number }[];
}

export function MemoryApproval() {
  const [memories, setMemories] = useState<TaskMemory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [memoriesData, statsData] = await Promise.all([
        apiGet<{ memories: TaskMemory[] }>('/api/memories/pending'),
        apiGet<MemoryStats>('/api/memories/stats'),
      ]);

      setMemories(memoriesData.memories || []);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching memories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await apiPost(`/api/memories/${id}/approve`, { approvedBy: 'human' });
      setMemories(prev => prev.filter(m => m.id !== id));
      fetchData(); // Refresh stats
    } catch (err) {
      console.error('Error approving memory:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await apiPost(`/api/memories/${id}/reject`);
      setMemories(prev => prev.filter(m => m.id !== id));
      fetchData(); // Refresh stats
    } catch (err) {
      console.error('Error rejecting memory:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-command-surface border border-command-border rounded-lg p-6">
        <div className="text-command-text-secondary">Loading agent learnings...</div>
      </div>
    );
  }

  return (
    <div className="bg-command-surface border border-command-border rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-command-text">Agent Learnings</h2>
        {stats && (
          <div className="flex gap-4 text-sm">
            <span className="text-amber-400">{stats.pending} pending</span>
            <span className="text-green-400">{stats.approved} approved</span>
            <span className="text-command-text-secondary">{stats.total} total</span>
          </div>
        )}
      </div>

      {memories.length === 0 ? (
        <div className="text-center py-8 text-command-text-secondary">
          <p>No pending learnings to review</p>
          <p className="text-sm mt-2">Agents will propose learnings as they complete tasks</p>
        </div>
      ) : (
        <div className="space-y-4">
          {memories.map(memory => (
            <div
              key={memory.id}
              className="border border-command-border rounded-lg p-4 bg-command-bg"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="inline-block px-2 py-1 text-xs rounded bg-command-accent text-white">
                    {memory.taskType}
                  </span>
                  {memory.proposedByAgent && (
                    <span className="ml-2 text-xs text-command-text-secondary">
                      by {memory.proposedByAgent}
                    </span>
                  )}
                </div>
                <span className="text-xs text-command-text-secondary">
                  {new Date(memory.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mb-3">
                <h4 className="text-sm font-semibold text-command-text mb-1">Pattern</h4>
                <p className="text-sm text-command-text-secondary">{memory.pattern}</p>
              </div>

              <div className="mb-3">
                <h4 className="text-sm font-semibold text-command-text mb-1">Solution</h4>
                <p className="text-sm text-command-text-secondary whitespace-pre-wrap">
                  {memory.solution}
                </p>
              </div>

              {memory.errorPattern && (
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-red-400 mb-1">Error Pattern</h4>
                  <p className="text-sm text-command-text-secondary font-mono text-xs">
                    {memory.errorPattern}
                  </p>
                </div>
              )}

              {memory.keywords.length > 0 && (
                <div className="mb-3 flex gap-1 flex-wrap">
                  {memory.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs rounded bg-command-surface text-command-text-secondary"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleApprove(memory.id)}
                  disabled={actionLoading === memory.id}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
                >
                  {actionLoading === memory.id ? 'Processing...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReject(memory.id)}
                  disabled={actionLoading === memory.id}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats && stats.byTaskType.length > 0 && (
        <div className="mt-6 pt-4 border-t border-command-border">
          <h3 className="text-sm font-semibold text-command-text mb-2">
            Approved Memories by Type
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {stats.byTaskType.map(t => (
              <div
                key={t.taskType}
                className="px-3 py-2 rounded bg-command-bg text-center"
              >
                <div className="text-lg font-bold text-command-text">{t.count}</div>
                <div className="text-xs text-command-text-secondary">{t.taskType}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
