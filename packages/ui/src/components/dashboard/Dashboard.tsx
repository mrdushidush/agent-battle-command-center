import { CostDashboard } from './CostDashboard';
import { SuccessRateChart } from './SuccessRateChart';
import { AgentComparison } from './AgentComparison';
import { ComplexityDistribution } from './ComplexityDistribution';

export function Dashboard() {
  return (
    <div className="h-full flex flex-col bg-command-bg overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-command-text mb-2">Dashboard</h1>
        <p className="text-command-text-secondary">
          System-wide analytics and performance metrics
        </p>
      </div>

      {/* Main dashboard grid */}
      <div className="flex-1 grid grid-cols-2 gap-6">
        {/* Top row - Cost and Success Rate */}
        <div className="bg-command-surface border border-command-border rounded-lg p-6">
          <CostDashboard />
        </div>

        <div className="bg-command-surface border border-command-border rounded-lg p-6">
          <SuccessRateChart />
        </div>

        {/* Bottom row - Agent Comparison and Complexity */}
        <div className="bg-command-surface border border-command-border rounded-lg p-6">
          <AgentComparison />
        </div>

        <div className="bg-command-surface border border-command-border rounded-lg p-6">
          <ComplexityDistribution />
        </div>
      </div>
    </div>
  );
}
