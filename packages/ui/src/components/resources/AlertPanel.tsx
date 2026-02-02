import { X, AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { useUIStore } from '../../store/uiState';
import type { Alert } from '@abcc/shared';

const severityIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

const severityColors = {
  info: 'text-hud-blue border-hud-blue/30 bg-hud-blue/10',
  warning: 'text-hud-amber border-hud-amber/30 bg-hud-amber/10',
  error: 'text-hud-red border-hud-red/30 bg-hud-red/10',
};

function AlertItem({ alert, onAcknowledge }: { alert: Alert; onAcknowledge: () => void }) {
  const Icon = severityIcons[alert.severity];
  const colorClass = severityColors[alert.severity];

  return (
    <div
      className={`p-3 rounded border ${colorClass} ${
        alert.acknowledged ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{alert.title}</span>
            {!alert.acknowledged && (
              <button
                onClick={onAcknowledge}
                className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-xs opacity-80 mt-1">{alert.message}</p>
          <div className="flex items-center gap-2 mt-2 text-xs opacity-60">
            <span>{new Date(alert.createdAt).toLocaleTimeString()}</span>
            {alert.taskId && <span>Task: {alert.taskId.slice(0, 8)}...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertPanel() {
  const { alerts, acknowledgeAlert, clearAlerts, toggleAlertsPanel } = useUIStore();

  return (
    <div className="h-full flex flex-col bg-command-panel">
      {/* Header */}
      <div className="p-3 border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-hud-amber" />
          <span className="font-display text-sm uppercase tracking-wider">Alerts</span>
          <span className="text-xs text-gray-500">
            ({alerts.filter(a => a && a.acknowledged === false).length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {alerts.length > 0 && (
            <button
              onClick={clearAlerts}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
            >
              Clear All
            </button>
          )}
          <button
            onClick={toggleAlertsPanel}
            className="p-1 hover:bg-command-accent rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No alerts
          </div>
        ) : (
          alerts.map(alert => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onAcknowledge={() => acknowledgeAlert(alert.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
