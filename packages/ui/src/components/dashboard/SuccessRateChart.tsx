import { useEffect, useState } from 'react';

interface SuccessRateDataPoint {
  timestamp: Date;
  hour: string;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
}

interface SuccessRateData {
  overall: {
    completed: number;
    failed: number;
    total: number;
    successRate: number;
  };
  timeline: SuccessRateDataPoint[];
  trend: {
    direction: 'up' | 'down' | 'stable';
    change: number;
  };
}

interface SuccessRateChartProps {
  period?: 'hourly' | 'daily';
  hours?: number;
}

export function SuccessRateChart({ period = 'hourly', hours = 24 }: SuccessRateChartProps) {
  const [data, setData] = useState<SuccessRateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod] = useState(period);
  const [selectedHours, setSelectedHours] = useState(hours);

  useEffect(() => {
    fetchData();
  }, [selectedPeriod, selectedHours]);

  const fetchData = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/metrics/success-rate?period=${selectedPeriod}&hours=${selectedHours}`
      );
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch success rate data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-command-text-secondary">
        Loading success rate data...
      </div>
    );
  }

  if (!data || data.timeline.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-command-text-secondary">
        No success rate data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-command-text">Success Rate Over Time</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-2xl font-bold text-command-accent">
              {data.overall.successRate.toFixed(1)}%
            </div>
            <TrendIndicator trend={data.trend} />
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex gap-2">
          <select
            value={selectedHours}
            onChange={(e) => setSelectedHours(parseInt(e.target.value))}
            className="px-3 py-1 bg-command-surface border border-command-border rounded text-command-text text-sm"
          >
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={168}>1 week</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1">
        <LineChart data={data.timeline} />
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="bg-command-surface border border-command-border rounded p-3">
          <div className="text-command-text-secondary">Completed</div>
          <div className="text-lg font-semibold text-green-400">{data.overall.completed}</div>
        </div>
        <div className="bg-command-surface border border-command-border rounded p-3">
          <div className="text-command-text-secondary">Failed</div>
          <div className="text-lg font-semibold text-red-400">{data.overall.failed}</div>
        </div>
        <div className="bg-command-surface border border-command-border rounded p-3">
          <div className="text-command-text-secondary">Total</div>
          <div className="text-lg font-semibold text-command-text">{data.overall.total}</div>
        </div>
      </div>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: { direction: string; change: number } }) {
  const color =
    trend.direction === 'up'
      ? 'text-green-400'
      : trend.direction === 'down'
      ? 'text-red-400'
      : 'text-command-text-secondary';

  const arrow =
    trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→';

  return (
    <div className={`text-sm ${color} flex items-center gap-1`}>
      <span>{arrow}</span>
      <span>{Math.abs(trend.change).toFixed(1)}%</span>
    </div>
  );
}

interface LineChartProps {
  data: SuccessRateDataPoint[];
}

function LineChart({ data }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-command-text-secondary">
        No data points
      </div>
    );
  }

  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max values
  const maxRate = 100; // Success rate is always 0-100%

  // Create points for the line
  const points = data.map((point, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - (point.successRate / maxRate) * chartHeight;
    return { x, y, point };
  });

  // Create path for the line
  const linePath = points
    .map((p, i) => {
      if (i === 0) {
        return `M ${p.x} ${p.y}`;
      }
      return `L ${p.x} ${p.y}`;
    })
    .join(' ');

  // Create path for the area under the line
  const areaPath =
    linePath +
    ` L ${padding.left + chartWidth} ${padding.top + chartHeight}` +
    ` L ${padding.left} ${padding.top + chartHeight}` +
    ' Z';

  return (
    <svg width={width} height={height} className="w-full h-full">
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((value) => {
        const y = padding.top + chartHeight - (value / maxRate) * chartHeight;
        return (
          <g key={value}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + chartWidth}
              y2={y}
              stroke="rgb(55, 65, 81)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={y}
              textAnchor="end"
              alignmentBaseline="middle"
              className="text-xs fill-command-text-secondary"
            >
              {value}%
            </text>
          </g>
        );
      })}

      {/* Area under the line */}
      <path
        d={areaPath}
        fill="rgb(59, 130, 246)"
        opacity={0.1}
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="rgb(59, 130, 246)"
        strokeWidth={2}
      />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={4}
            fill="rgb(59, 130, 246)"
            className="cursor-pointer hover:r-6 transition-all"
          />
          <title>
            {new Date(p.point.hour).toLocaleString()}
            {'\n'}
            Success Rate: {p.point.successRate.toFixed(1)}%
            {'\n'}
            Completed: {p.point.completed}, Failed: {p.point.failed}
          </title>
        </g>
      ))}

      {/* X-axis labels (show a few time labels) */}
      {points
        .filter((_, i) => i % Math.max(1, Math.floor(points.length / 6)) === 0)
        .map((p, i) => {
          const time = new Date(p.point.hour);
          const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <text
              key={i}
              x={p.x}
              y={padding.top + chartHeight + 20}
              textAnchor="middle"
              className="text-xs fill-command-text-secondary"
            >
              {label}
            </text>
          );
        })}
    </svg>
  );
}
