import { useEffect, useState } from 'react';

interface ComplexityBucket {
  range: string;
  count: number;
  completed: number;
  failed: number;
  successRate: number;
}

interface ComplexityData {
  distribution: ComplexityBucket[];
  totalTasks: number;
}

export function ComplexityDistribution() {
  const [data, setData] = useState<ComplexityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/metrics/complexity-distribution');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch complexity distribution:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-command-text-secondary">
        Loading complexity distribution...
      </div>
    );
  }

  if (!data || data.distribution.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-command-text-secondary">
        No complexity data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-command-text">Task Complexity Distribution</h2>
        <p className="text-command-text-secondary text-sm">
          How tasks are distributed across complexity levels (1-10 scale)
        </p>
      </div>

      {/* Histogram */}
      <div className="flex-1">
        <Histogram data={data.distribution} />
      </div>

      {/* Legend */}
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span className="text-command-text-secondary">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span className="text-command-text-secondary">Failed</span>
        </div>
      </div>
    </div>
  );
}

interface HistogramProps {
  data: ComplexityBucket[];
}

function Histogram({ data }: HistogramProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-command-text-secondary">
        No data points
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="h-full flex items-end gap-4 px-4">
      {data.map((bucket) => {
        const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
        const completedHeight = bucket.count > 0 ? (bucket.completed / bucket.count) * height : 0;
        const failedHeight = bucket.count > 0 ? (bucket.failed / bucket.count) * height : 0;

        // Color based on complexity range
        const getComplexityColor = (range: string) => {
          if (range === '1-2') return 'border-green-500';
          if (range === '3-4') return 'border-blue-500';
          if (range === '5-6') return 'border-yellow-500';
          if (range === '7-8') return 'border-orange-500';
          if (range === '9-10') return 'border-red-500';
          return 'border-command-border';
        };

        return (
          <div key={bucket.range} className="flex-1 flex flex-col items-center">
            {/* Bar */}
            <div className="w-full flex flex-col-reverse" style={{ height: '240px' }}>
              {bucket.count > 0 && (
                <div
                  className={`w-full border-2 ${getComplexityColor(bucket.range)} bg-command-surface rounded-t-lg relative overflow-hidden transition-all hover:opacity-80`}
                  style={{ height: `${height}%` }}
                >
                  {/* Completed portion */}
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-green-500 opacity-60"
                    style={{ height: `${(completedHeight / height) * 100}%` }}
                  />
                  {/* Failed portion */}
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-red-500 opacity-60"
                    style={{
                      height: `${(failedHeight / height) * 100}%`,
                      bottom: `${(completedHeight / height) * 100}%`
                    }}
                  />

                  {/* Count label */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-command-text font-semibold text-lg">
                      {bucket.count}
                    </span>
                  </div>

                  {/* Tooltip */}
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-command-bg bg-opacity-90 p-2 text-xs transition-opacity">
                    <div className="text-command-text font-semibold mb-1">
                      Complexity {bucket.range}
                    </div>
                    <div className="text-green-400">✓ {bucket.completed} completed</div>
                    <div className="text-red-400">✗ {bucket.failed} failed</div>
                    <div className="text-command-text-secondary mt-1">
                      Success: {bucket.successRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Label */}
            <div className="mt-2 text-center">
              <div className="text-command-text font-semibold">{bucket.range}</div>
              <div className="text-command-text-secondary text-xs">
                {bucket.successRate.toFixed(0)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
