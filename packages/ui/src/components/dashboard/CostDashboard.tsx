import { useEffect, useState } from 'react';
import { costMetricsApi } from '../../api/client';
import { useUIStore } from '../../store/uiState';

interface CostMetrics {
  totalCost: number;
  totalCostFormatted: string;
  byModelTier: {
    free: number;
    haiku: number;
    sonnet: number;
    opus: number;
  };
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  logCount: number;
}

interface PieSlice {
  color: string;
  label: string;
  value: number;
  percentage: number;
  startAngle: number;
  endAngle: number;
}

export function CostDashboard() {
  const [metrics, setMetrics] = useState<CostMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time cost updates from Zustand store
  const { costMetrics: liveMetrics } = useUIStore();

  useEffect(() => {
    fetchCostMetrics();
  }, []);

  // Update metrics when live metrics change
  useEffect(() => {
    if (liveMetrics.lastUpdated && metrics) {
      setMetrics({
        ...metrics,
        totalCost: liveMetrics.totalCost,
        totalCostFormatted: `$${liveMetrics.totalCost.toFixed(6)}`,
        byModelTier: liveMetrics.byModelTier,
        totalTokens: liveMetrics.totalTokens,
      });
    }
  }, [liveMetrics.lastUpdated]);

  const fetchCostMetrics = async () => {
    try {
      const data = await costMetricsApi.summary();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError('Failed to load cost metrics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-command-text-secondary">Loading cost metrics...</div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400">{error || 'No data available'}</div>
      </div>
    );
  }

  const pieData = calculatePieData(metrics);

  return (
    <div className="h-full flex flex-col p-6 bg-command-bg overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-command-text mb-2">Cost Tracking</h1>
        <p className="text-command-text-secondary">
          Monitor LLM usage costs across model tiers
        </p>
      </div>

      {/* Total Cost Card */}
      <div className="mb-6 bg-command-surface border border-command-border rounded-lg p-6">
        <div className="text-command-text-secondary text-sm mb-1">Total Cost</div>
        <div className="text-4xl font-bold text-command-accent">
          {metrics.totalCostFormatted}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-command-text-secondary">Input Tokens</div>
            <div className="text-command-text font-mono">
              {metrics.totalTokens.input.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-command-text-secondary">Output Tokens</div>
            <div className="text-command-text font-mono">
              {metrics.totalTokens.output.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-command-text-secondary">Total Tokens</div>
            <div className="text-command-text font-mono">
              {metrics.totalTokens.total.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="flex-1 grid grid-cols-2 gap-6">
        <div className="bg-command-surface border border-command-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-command-text mb-4">
            Cost by Model Tier
          </h2>
          <div className="flex items-center justify-center">
            <PieChart data={pieData} size={280} />
          </div>
        </div>

        <div className="bg-command-surface border border-command-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-command-text mb-4">
            Cost Breakdown
          </h2>
          <div className="space-y-3">
            {pieData.map((slice) => (
              <div
                key={slice.label}
                className="flex items-center justify-between p-3 bg-command-bg rounded border border-command-border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-command-text">{slice.label}</span>
                </div>
                <div className="text-right">
                  <div className="text-command-text font-mono">
                    ${slice.value.toFixed(4)}
                  </div>
                  <div className="text-command-text-secondary text-sm">
                    {slice.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function calculatePieData(metrics: CostMetrics): PieSlice[] {
  const { byModelTier } = metrics;

  const total = byModelTier.free + byModelTier.haiku + byModelTier.sonnet + byModelTier.opus;

  if (total === 0) {
    return [];
  }

  const slices: PieSlice[] = [];
  const tiers = [
    { label: 'Opus', value: byModelTier.opus, color: '#ef4444' },
    { label: 'Sonnet', value: byModelTier.sonnet, color: '#f59e0b' },
    { label: 'Haiku', value: byModelTier.haiku, color: '#10b981' },
    { label: 'Free', value: byModelTier.free, color: '#6b7280' },
  ];

  let currentAngle = -90; // Start at top

  for (const tier of tiers) {
    if (tier.value === 0) continue;

    const percentage = (tier.value / total) * 100;
    const angle = (percentage / 100) * 360;

    slices.push({
      label: tier.label,
      value: tier.value,
      percentage,
      color: tier.color,
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
    });

    currentAngle += angle;
  }

  return slices;
}

interface PieChartProps {
  data: PieSlice[];
  size: number;
}

function PieChart({ data, size }: PieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-command-text-secondary">
        No cost data yet
      </div>
    );
  }

  const center = size / 2;
  const radius = size / 2 - 10;
  const innerRadius = radius * 0.6;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {data.map((slice, i) => {
        const startAngleRad = (slice.startAngle * Math.PI) / 180;
        const endAngleRad = (slice.endAngle * Math.PI) / 180;

        // Outer arc
        const x1 = center + radius * Math.cos(startAngleRad);
        const y1 = center + radius * Math.sin(startAngleRad);
        const x2 = center + radius * Math.cos(endAngleRad);
        const y2 = center + radius * Math.sin(endAngleRad);

        // Inner arc
        const x3 = center + innerRadius * Math.cos(endAngleRad);
        const y3 = center + innerRadius * Math.sin(endAngleRad);
        const x4 = center + innerRadius * Math.cos(startAngleRad);
        const y4 = center + innerRadius * Math.sin(startAngleRad);

        const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;

        const path = [
          `M ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
          'Z',
        ].join(' ');

        return (
          <path
            key={i}
            d={path}
            fill={slice.color}
            opacity={0.9}
            className="transition-opacity hover:opacity-100"
          />
        );
      })}
      {/* Center circle */}
      <circle
        cx={center}
        cy={center}
        r={innerRadius - 5}
        fill="rgb(17, 24, 39)"
        stroke="rgb(55, 65, 81)"
        strokeWidth={2}
      />
    </svg>
  );
}
