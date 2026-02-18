import { useEffect, useState, useRef } from 'react';
import { Terminal, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { apiGet } from '../../lib/api';

interface ExecutionLogEntry {
  id: string;
  taskId: string;
  agentId: string;
  action: string;
  input: string;
  observation: string;
  status: 'success' | 'error' | 'in_progress';
  timestamp: Date;
  durationMs?: number;
}

export function ToolLog() {
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch execution logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await apiGet<any[]>('/api/execution-logs?limit=50');

        // Transform API data to log entries
        const entries: ExecutionLogEntry[] = data.map((log: any) => ({
          id: log.id,
          taskId: log.taskId,
          agentId: log.agentId,
          action: log.action,
          input: log.input || '',
          observation: log.observation || '',
          status: log.observation?.includes('error') ? 'error' : 'success',
          timestamp: new Date(log.createdAt),
          durationMs: log.durationMs,
        }));

        setLogs(entries);
      } catch (error) {
        console.error('Failed to fetch execution logs:', error);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Poll every 10 seconds (was 2s - caused OOM)
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isPaused]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatAction = (action: string, input: string) => {
    // Extract key info from action
    if (action === 'file_write') {
      const match = input.match(/"file_path":\s*"([^"]+)"/);
      return match ? `file_write: ${match[1]}` : action;
    }
    if (action === 'shell_command') {
      const match = input.match(/"command":\s*"([^"]+)"/);
      return match ? `shell_command: ${match[1].substring(0, 40)}...` : action;
    }
    if (action === 'file_read') {
      const match = input.match(/"file_path":\s*"([^"]+)"/);
      return match ? `file_read: ${match[1]}` : action;
    }
    return action;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />;
      default:
        return <Clock className="w-3 h-3 text-yellow-400 flex-shrink-0 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-log-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
    }, 0);
  };

  return (
    <div className="h-full flex flex-col bg-command-bg border border-command-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-command-panel border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-hud-green" />
          <h3 className="font-display text-sm uppercase tracking-wider text-gray-400">
            Tool Execution Log
          </h3>
          <span className="text-xs text-gray-500">
            {logs.length} actions
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <button
            className="flex items-center gap-2 ml-2 text-gray-400 enabled:hover:text-gray-200 disabled:text-gray-600 disabled:cursor-not-allowed"
            disabled={logs.length === 0}
            onClick={handleExport}
            aria-label="Download logs as JSON"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs">Export</span>
          </button>

        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600">
            No execution logs yet
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2 px-2 py-1 rounded hover:bg-command-panel/50 ${
                getStatusColor(log.status)
              }`}
            >
              {/* Timestamp */}
              <span className="text-gray-500 w-20 flex-shrink-0">
                [{formatTime(log.timestamp)}]
              </span>

              {/* Agent ID */}
              <span className="text-gray-400 w-24 truncate flex-shrink-0">
                {log.agentId.substring(0, 12)}
              </span>

              {/* Status icon */}
              {getStatusIcon(log.status)}

              {/* Action */}
              <span className="flex-1 truncate">
                {formatAction(log.action, log.input)}
              </span>

              {/* Duration */}
              {log.durationMs !== undefined && (
                <span className="text-gray-500 w-16 text-right flex-shrink-0">
                  {log.durationMs}ms
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
