import { useEffect, useState } from 'react';

interface AgentStats {
  agentType: string;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
}

interface AgentCostStats {
  agentId: string;
  agentName: string;
  agentType: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  logCount: number;
}

export function AgentComparison() {
  const [successData, setSuccessData] = useState<AgentStats[]>([]);
  const [costData, setCostData] = useState<AgentCostStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [successRes, costRes] = await Promise.all([
        fetch('http://localhost:3001/api/metrics/success-rate/by-agent'),
        fetch('http://localhost:3001/api/cost-metrics/by-agent'),
      ]);

      const successResult = await successRes.json();
      const costResult = await costRes.json();

      setSuccessData(successResult);
      setCostData(costResult.agents || []);
    } catch (error) {
      console.error('Failed to fetch agent comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-command-text-secondary">
        Loading agent comparison...
      </div>
    );
  }

  // Merge success and cost data by agent type
  const mergedData = successData.map((success) => {
    // Find all agents of this type
    const agentsOfType = costData.filter((c) => c.agentType === success.agentType);

    const totalCost = agentsOfType.reduce((sum, a) => sum + a.totalCost, 0);
    const totalTokens = agentsOfType.reduce(
      (sum, a) => sum + a.inputTokens + a.outputTokens,
      0
    );

    return {
      agentType: success.agentType,
      successRate: success.successRate,
      totalTasks: success.total,
      completed: success.completed,
      failed: success.failed,
      totalCost,
      totalTokens,
      costPerTask: success.total > 0 ? totalCost / success.total : 0,
    };
  });

  // Sort by total tasks (most active first)
  mergedData.sort((a, b) => b.totalTasks - a.totalTasks);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-command-text">Agent Performance Comparison</h2>
        <p className="text-command-text-secondary text-sm">
          Compare success rates, costs, and efficiency across agent types
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-4">
          {mergedData.map((agent) => (
            <AgentCard key={agent.agentType} data={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface AgentCardData {
  agentType: string;
  successRate: number;
  totalTasks: number;
  completed: number;
  failed: number;
  totalCost: number;
  totalTokens: number;
  costPerTask: number;
}

function AgentCard({ data }: { data: AgentCardData }) {
  const getAgentColor = (type: string) => {
    if (type.includes('cto')) return 'border-purple-500';
    if (type.includes('qa')) return 'border-blue-500';
    if (type.includes('coder')) return 'border-green-500';
    return 'border-command-border';
  };

  const getAgentIcon = (type: string) => {
    if (type.includes('cto')) return '👔';
    if (type.includes('qa')) return '🔍';
    if (type.includes('coder')) return '⚡';
    return '🤖';
  };

  const successColor = data.successRate >= 80 ? 'text-green-400' : data.successRate >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className={`bg-command-surface border-2 ${getAgentColor(data.agentType)} rounded-lg p-4`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{getAgentIcon(data.agentType)}</div>
          <div>
            <h3 className="text-lg font-semibold text-command-text capitalize">
              {data.agentType}
            </h3>
            <div className="text-sm text-command-text-secondary">
              {data.totalTasks} total tasks
            </div>
          </div>
        </div>

        <div className={`text-2xl font-bold ${successColor}`}>
          {data.successRate.toFixed(1)}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Success Metrics */}
        <div className="space-y-2">
          <div className="text-xs text-command-text-secondary uppercase tracking-wide">
            Success Metrics
          </div>
          <div className="flex justify-between">
            <span className="text-command-text-secondary">Completed:</span>
            <span className="text-green-400 font-mono">{data.completed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-command-text-secondary">Failed:</span>
            <span className="text-red-400 font-mono">{data.failed}</span>
          </div>
        </div>

        {/* Cost Metrics */}
        <div className="space-y-2">
          <div className="text-xs text-command-text-secondary uppercase tracking-wide">
            Cost Metrics
          </div>
          <div className="flex justify-between">
            <span className="text-command-text-secondary">Total Cost:</span>
            <span className="text-command-accent font-mono">${data.totalCost.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-command-text-secondary">Per Task:</span>
            <span className="text-command-text font-mono">${data.costPerTask.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Success rate bar */}
      <div className="mt-4">
        <div className="h-2 bg-command-bg rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              data.successRate >= 80
                ? 'bg-green-500'
                : data.successRate >= 60
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${data.successRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
