import { Loader2, CheckCircle, XCircle, ChevronRight, AlertTriangle, Download } from 'lucide-react';
import { useUIStore } from '../../store/uiState';
import { missionsApi } from '../../api/client';
import { useState } from 'react';

const STAGES = ['decomposing', 'executing', 'reviewing', 'awaiting_approval', 'approved'] as const;

const STAGE_LABELS: Record<string, string> = {
  decomposing: 'Decompose',
  executing: 'Execute',
  reviewing: 'Review',
  awaiting_approval: 'Approval',
  approved: 'Complete',
};

function getStageState(stage: string, currentStatus: string, failed: boolean) {
  if (failed && stage === currentStatus) return 'failed';
  const currentIdx = STAGES.indexOf(currentStatus as typeof STAGES[number]);
  const stageIdx = STAGES.indexOf(stage as typeof STAGES[number]);
  if (stageIdx < 0 || currentIdx < 0) return 'pending';
  if (stageIdx < currentIdx) return 'done';
  if (stageIdx === currentIdx) return 'active';
  return 'pending';
}

interface MissionProgressTrackerProps {
  conversationId?: string | null;
}

export function MissionProgressTracker(_props: MissionProgressTrackerProps) {
  const { missions } = useUIStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Find the active mission for this conversation
  const activeMission = Object.entries(missions).find(
    ([, m]) => {
      // Show tracker for any non-terminal mission, or recently completed ones
      const isActive = m.status && !['failed'].includes(m.status);
      return isActive;
    }
  );

  if (!activeMission) return null;

  const [missionId, mission] = activeMission;
  const isFailed = mission.status === 'failed';
  const isComplete = mission.status === 'approved';

  const handleApprove = async () => {
    setActionLoading('approve');
    try {
      await missionsApi.approve(missionId);
    } catch {
      // Fallback handled elsewhere
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading('reject');
    try {
      await missionsApi.reject(missionId);
    } catch {
      // Fallback handled elsewhere
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async () => {
    setActionLoading('download');
    try {
      await missionsApi.download(missionId);
    } catch {
      // Download error — silent
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-3 mb-2 border border-command-border rounded-lg bg-command-bg/50 overflow-hidden">
      {/* Stage Pipeline */}
      <div className="flex items-center px-3 py-2 gap-0.5 overflow-x-auto">
        {STAGES.map((stage, i) => {
          const state = getStageState(stage, mission.status || '', isFailed);
          return (
            <div key={stage} className="flex items-center">
              {i > 0 && (
                <ChevronRight className="w-3 h-3 text-gray-600 mx-0.5 shrink-0" />
              )}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  state === 'active'
                    ? 'bg-hud-amber/20 text-hud-amber border border-hud-amber/30'
                    : state === 'done'
                    ? 'bg-green-500/10 text-green-400'
                    : state === 'failed'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : 'text-gray-500'
                }`}
              >
                {state === 'active' && <Loader2 className="w-3 h-3 animate-spin" />}
                {state === 'done' && <CheckCircle className="w-3 h-3" />}
                {state === 'failed' && <XCircle className="w-3 h-3" />}
                {STAGE_LABELS[stage]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtask Progress Bar (during executing) */}
      {mission.status === 'executing' && mission.subtaskCount && mission.subtaskCount > 0 && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Subtasks</span>
            <span className="text-hud-green">
              {mission.completedCount || 0}/{mission.subtaskCount}
            </span>
          </div>
          <div className="h-1.5 bg-command-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-hud-green rounded-full transition-all duration-500"
              style={{
                width: `${((mission.completedCount || 0) / mission.subtaskCount) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Review Score */}
      {(mission.status === 'awaiting_approval' || isComplete) && mission.reviewScore != null && (
        <div className="px-3 pb-2 flex items-center gap-2 text-xs">
          <span className="text-gray-400">Review Score:</span>
          <span
            className={`font-mono font-bold ${
              mission.reviewScore >= 7
                ? 'text-green-400'
                : mission.reviewScore >= 5
                ? 'text-hud-amber'
                : 'text-red-400'
            }`}
          >
            {mission.reviewScore}/10
          </span>
        </div>
      )}

      {/* Approve/Reject/Download Buttons */}
      {mission.status === 'awaiting_approval' && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {actionLoading === 'approve' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {actionLoading === 'reject' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            Reject
          </button>
          <button
            onClick={handleDownload}
            disabled={actionLoading !== null}
            className="flex items-center gap-1.5 px-4 py-1.5 ml-auto bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {actionLoading === 'download' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download ZIP
          </button>
        </div>
      )}

      {/* Error Display */}
      {isFailed && mission.error && (
        <div className="px-3 pb-2 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-400">{mission.error}</span>
        </div>
      )}

      {/* Complete indicator */}
      {isComplete && (
        <div className="px-3 pb-2 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="font-medium">Mission complete</span>
          </div>
          <button
            onClick={handleDownload}
            disabled={actionLoading !== null}
            className="flex items-center gap-1 ml-auto px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            {actionLoading === 'download' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            Download ZIP
          </button>
        </div>
      )}
    </div>
  );
}
