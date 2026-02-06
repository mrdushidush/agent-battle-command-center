import { useEffect, useState, useRef, useMemo } from 'react';
import { Flame, Zap, TrendingUp, DollarSign } from 'lucide-react';
import { apiGet } from '../../lib/api';

interface TokenEntry {
  id: string;
  timestamp: Date;
  agentId: string;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  action: string;
}

// Model tier pricing (per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number; tier: string }> = {
  'qwen2.5-coder:7b': { input: 0, output: 0, tier: 'ollama' },
  'ollama/qwen2.5-coder:7b': { input: 0, output: 0, tier: 'ollama' },
  'claude-haiku-4-5-20251001': { input: 1, output: 5, tier: 'haiku' },
  'anthropic/claude-haiku-4-5-20251001': { input: 1, output: 5, tier: 'haiku' },
  'claude-sonnet-4-20250514': { input: 3, output: 15, tier: 'sonnet' },
  'anthropic/claude-sonnet-4-20250514': { input: 3, output: 15, tier: 'sonnet' },
  'claude-opus-4-5-20251101': { input: 5, output: 25, tier: 'opus' },
  'anthropic/claude-opus-4-5-20251101': { input: 5, output: 25, tier: 'opus' },
};

function getModelTier(model: string): { tier: string; color: string } {
  const pricing = MODEL_PRICING[model];
  if (pricing) {
    switch (pricing.tier) {
      case 'ollama': return { tier: 'OLLAMA', color: 'text-gray-400' };
      case 'haiku': return { tier: 'HAIKU', color: 'text-green-400' };
      case 'sonnet': return { tier: 'SONNET', color: 'text-blue-400' };
      case 'opus': return { tier: 'OPUS', color: 'text-purple-400' };
    }
  }
  // Try to detect from model name
  if (model?.includes('ollama') || model?.includes('qwen')) return { tier: 'OLLAMA', color: 'text-gray-400' };
  if (model?.includes('haiku')) return { tier: 'HAIKU', color: 'text-green-400' };
  if (model?.includes('sonnet')) return { tier: 'SONNET', color: 'text-blue-400' };
  if (model?.includes('opus')) return { tier: 'OPUS', color: 'text-purple-400' };
  return { tier: 'UNKNOWN', color: 'text-gray-500' };
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// Generate mock data for demonstration
function generateMockEntries(): TokenEntry[] {
  const models = [
    'ollama/qwen2.5-coder:7b',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-20250514',
    'claude-opus-4-5-20251101',
  ];
  const actions = ['file_write', 'shell_run', 'file_read', 'code_search', 'file_edit'];
  const entries: TokenEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < 25; i++) {
    const model = models[Math.floor(Math.random() * models.length)];
    const isOllama = model.includes('ollama');
    entries.push({
      id: `mock-${i}`,
      timestamp: new Date(now - (25 - i) * 8000), // 8 seconds apart
      agentId: isOllama ? 'coder-01' : (model.includes('opus') ? 'cto-01' : 'qa-01'),
      modelUsed: model,
      inputTokens: isOllama ? 0 : Math.floor(Math.random() * 2000) + 500,
      outputTokens: isOllama ? 0 : Math.floor(Math.random() * 800) + 100,
      action: actions[Math.floor(Math.random() * actions.length)],
    });
  }
  return entries;
}

export function TokenBurnLog() {
  const [entries, setEntries] = useState<TokenEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [useMockData, setUseMockData] = useState(false);

  // Fetch execution logs with token data
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await apiGet<any[]>('/api/execution-logs?limit=100');

        // Filter and transform logs that have token data
        const tokenEntries: TokenEntry[] = data
          .filter((log: any) => log.inputTokens || log.outputTokens)
          .map((log: any) => ({
            id: log.id,
            timestamp: new Date(log.timestamp),
            agentId: log.agentId,
            modelUsed: log.modelUsed || 'unknown',
            inputTokens: log.inputTokens || 0,
            outputTokens: log.outputTokens || 0,
            action: log.action,
          }));

        // Use mock data if no real token data and mock mode enabled
        if (tokenEntries.length === 0 && useMockData) {
          setEntries(generateMockEntries());
        } else if (tokenEntries.length > 0) {
          setEntries(tokenEntries);
          setUseMockData(false); // Switch to real data when available
        } else if (useMockData) {
          // Add a new mock entry periodically to simulate real-time
          setEntries(prev => {
            const newEntry: TokenEntry = {
              id: `mock-live-${Date.now()}`,
              timestamp: new Date(),
              agentId: ['coder-01', 'qa-01', 'cto-01'][Math.floor(Math.random() * 3)],
              modelUsed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514', 'ollama/qwen2.5-coder:7b'][Math.floor(Math.random() * 3)],
              inputTokens: Math.floor(Math.random() * 1500) + 300,
              outputTokens: Math.floor(Math.random() * 600) + 50,
              action: ['file_write', 'shell_run', 'file_read'][Math.floor(Math.random() * 3)],
            };
            return [...prev, newEntry].slice(-50); // Keep last 50
          });
        }
      } catch (error) {
        console.error('Failed to fetch token logs:', error);
        if (useMockData) {
          setEntries(generateMockEntries());
        }
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [useMockData]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll, isPaused]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalInput = entries.reduce((sum, e) => sum + e.inputTokens, 0);
    const totalOutput = entries.reduce((sum, e) => sum + e.outputTokens, 0);
    const totalCost = entries.reduce((sum, e) => sum + calculateCost(e.modelUsed, e.inputTokens, e.outputTokens), 0);

    // Calculate burn rate (tokens per minute over last 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEntries = entries.filter(e => e.timestamp > fiveMinAgo);
    const recentTokens = recentEntries.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0);

    // Calculate actual time span
    if (recentEntries.length > 1) {
      const minTime = Math.min(...recentEntries.map(e => e.timestamp.getTime()));
      const maxTime = Math.max(...recentEntries.map(e => e.timestamp.getTime()));
      const minutes = Math.max((maxTime - minTime) / 60000, 1);
      return {
        totalInput,
        totalOutput,
        totalCost,
        burnRate: Math.round(recentTokens / minutes),
      };
    }

    return {
      totalInput,
      totalOutput,
      totalCost,
      burnRate: 0,
    };
  }, [entries]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="h-full flex flex-col bg-command-bg border border-command-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-command-panel border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="font-display text-sm uppercase tracking-wider text-gray-400">
            Token Burn Rate
          </h3>
          {useMockData && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">DEMO</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Burn rate indicator */}
          <div className="flex items-center gap-1">
            <TrendingUp className={`w-3 h-3 ${stats.burnRate > 0 ? 'text-orange-400' : 'text-gray-500'}`} />
            <span className={stats.burnRate > 0 ? 'text-orange-400' : 'text-gray-500'}>
              {formatNumber(stats.burnRate)}/min
            </span>
          </div>

          {/* Total cost */}
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-hud-green" />
            <span className="text-hud-green">
              ${stats.totalCost.toFixed(4)}
            </span>
          </div>

          {/* Demo mode toggle */}
          {entries.length === 0 && !useMockData && (
            <button
              onClick={() => setUseMockData(true)}
              className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
            >
              Demo
            </button>
          )}

          <label className="flex items-center gap-2 text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto
          </label>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-1.5 bg-command-panel/50 border-b border-command-border flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-blue-400" />
          <span className="text-gray-400">In:</span>
          <span className="text-blue-400 font-mono">{formatNumber(stats.totalInput)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className="text-gray-400">Out:</span>
          <span className="text-amber-400 font-mono">{formatNumber(stats.totalOutput)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Total:</span>
          <span className="text-white font-mono">{formatNumber(stats.totalInput + stats.totalOutput)}</span>
        </div>
      </div>

      {/* Token entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {entries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600">
            No token usage yet
          </div>
        ) : (
          entries.map((entry) => {
            const { tier, color } = getModelTier(entry.modelUsed);
            const cost = calculateCost(entry.modelUsed, entry.inputTokens, entry.outputTokens);

            return (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-command-panel/50"
              >
                {/* Timestamp */}
                <span className="text-gray-500 w-20 flex-shrink-0">
                  [{formatTime(entry.timestamp)}]
                </span>

                {/* Model tier badge */}
                <span className={`w-16 text-center px-1.5 py-0.5 rounded text-[10px] font-bold ${color} bg-gray-800/50 flex-shrink-0`}>
                  {tier}
                </span>

                {/* Token counts */}
                <span className="text-blue-400 w-16 text-right flex-shrink-0">
                  +{formatNumber(entry.inputTokens)}
                </span>
                <span className="text-gray-600">/</span>
                <span className="text-amber-400 w-16 flex-shrink-0">
                  {formatNumber(entry.outputTokens)}
                </span>

                {/* Action */}
                <span className="text-gray-400 flex-1 truncate">
                  {entry.action}
                </span>

                {/* Cost */}
                {cost > 0 && (
                  <span className="text-hud-green w-16 text-right flex-shrink-0">
                    ${cost.toFixed(4)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
