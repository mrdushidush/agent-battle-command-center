import { useState, useEffect } from 'react';
import { X, Play, RefreshCw, Square, MessageSquare, Clock, Zap, Star, AlertTriangle, DollarSign, Hash, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import type { Task } from '@abcc/shared';
import { StatusBadge } from '../shared/StatusBadge';
import { useUIStore } from '../../store/uiState';
import { useTasks } from '../../hooks/useTasks';
import { codeReviewsApi, validationApi, type CodeReview, type TaskValidationResult } from '../../api/client';

interface TaskDetailProps {
  task: Task;
}

export function TaskDetail({ task }: TaskDetailProps) {
  const { selectTask, agents, validationStatus } = useUIStore();
  const { retryTask, abortTask, submitHumanInput, startExecution, loading } = useTasks();
  const [humanInput, setHumanInput] = useState('');
  const [codeReview, setCodeReview] = useState<CodeReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<TaskValidationResult | null>(null);
  const [cmdExpanded, setCmdExpanded] = useState(false);

  // Fetch code review for completed tasks
  useEffect(() => {
    if (['completed', 'failed'].includes(task.status)) {
      setReviewLoading(true);
      codeReviewsApi.getForTask(task.id)
        .then(setCodeReview)
        .catch(() => setCodeReview(null))
        .finally(() => setReviewLoading(false));
    } else {
      setCodeReview(null);
    }
  }, [task.id, task.status]);

  // Fetch validation result for tasks with validationCommand
  useEffect(() => {
    if (task.validationCommand && ['completed', 'failed'].includes(task.status)) {
      validationApi.getResult(task.id)
        .then(setValidationResult)
        .catch(() => setValidationResult(null));
    } else {
      setValidationResult(null);
    }
  }, [task.id, task.status, task.validationCommand]);

  const assignedAgent = task.assignedAgentId
    ? agents.find(a => a.id === task.assignedAgentId)
    : null;

  const handleStartExecution = async () => {
    if (!task.assignedAgentId) return;
    await startExecution(task.id);
  };

  const handleSubmitInput = async (action: 'approve' | 'reject' | 'modify') => {
    await submitHumanInput(task.id, humanInput, action);
    setHumanInput('');
  };

  return (
    <div className="h-full flex flex-col bg-command-panel">
      {/* Header */}
      <div className="p-4 border-b border-command-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm uppercase tracking-wider">Task Details</h3>
        </div>
        <button
          onClick={() => selectTask(null)}
          className="p-1 hover:bg-command-accent rounded-sm transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Title & Status */}
        <div className="mb-4">
          <h4 className="text-lg font-medium mb-2">{task.title}</h4>
          <StatusBadge status={task.status} type="task" />
        </div>

        {/* Description */}
        {task.description && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</div>
            <p className="text-sm text-gray-300">{task.description}</p>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-command-bg rounded-sm p-3">
            <div className="text-xs text-gray-500">Type</div>
            <div className="text-sm capitalize">{task.taskType}</div>
          </div>
          <div className="bg-command-bg rounded-sm p-3">
            <div className="text-xs text-gray-500">Priority</div>
            <div className="text-sm">P{task.priority}</div>
          </div>
          <div className="bg-command-bg rounded-sm p-3">
            <div className="text-xs text-gray-500">Required Agent</div>
            <div className="text-sm capitalize">{task.requiredAgent || 'Any'}</div>
          </div>
          <div className="bg-command-bg rounded-sm p-3">
            <div className="text-xs text-gray-500">Iterations</div>
            <div className="text-sm">{task.currentIteration}/{task.maxIterations}</div>
          </div>
        </div>

        {/* Assigned Agent */}
        {assignedAgent && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Assigned To</div>
            <div className="bg-command-bg rounded-sm p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded flex items-center justify-center ${
                assignedAgent.type === 'coder' ? 'bg-agent-coder/20' : 'bg-agent-qa/20'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  assignedAgent.status === 'busy' ? 'bg-status-active animate-pulse' :
                  assignedAgent.status === 'stuck' ? 'bg-status-stuck' : 'bg-status-completed'
                }`} />
              </div>
              <div>
                <div className="text-sm font-medium">{assignedAgent.name}</div>
                <div className="text-xs text-gray-500 capitalize">{assignedAgent.status}</div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Metrics</div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-hud-green" />
              <span>{task.metrics?.apiCreditsUsed?.toFixed(2) || 0} credits</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-hud-blue" />
              <span>{Math.round((task.metrics?.timeSpentMs || 0) / 1000)}s</span>
            </div>
          </div>
        </div>

        {/* Validation Section */}
        {(task.validationCommand || validationStatus[task.id]) && (() => {
          const wsStatus = validationStatus[task.id];
          const displayStatus = wsStatus?.status || (validationResult?.passed ? 'passed' : validationResult?.passed === false ? 'failed' : null);
          const displayError = wsStatus?.error || validationResult?.error;

          return (
            <div className="mb-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Validation
              </div>

              <div className="bg-command-bg rounded-sm p-3 space-y-2">
                {/* Validation Command */}
                {task.validationCommand && (
                  <div>
                    <button
                      onClick={() => setCmdExpanded(!cmdExpanded)}
                      className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-400 transition-colors"
                    >
                      {cmdExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      Command
                    </button>
                    {cmdExpanded ? (
                      <pre className="text-xs text-gray-400 font-mono mt-1 whitespace-pre-wrap break-all bg-black/30 rounded p-2">
                        {task.validationCommand}
                      </pre>
                    ) : (
                      <div className="text-xs text-gray-400 font-mono mt-1 truncate">
                        {task.validationCommand}
                      </div>
                    )}
                  </div>
                )}

                {/* Status */}
                {displayStatus && (
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      displayStatus === 'passed' ? 'bg-hud-green' :
                      displayStatus === 'failed' ? 'bg-hud-red' :
                      displayStatus === 'retrying' ? 'bg-hud-blue animate-pulse' :
                      displayStatus === 'validating' ? 'bg-hud-amber animate-pulse' :
                      'bg-gray-500'
                    }`} />
                    <span className={`text-sm ${
                      displayStatus === 'passed' ? 'text-hud-green' :
                      displayStatus === 'failed' ? 'text-hud-red' :
                      displayStatus === 'retrying' ? 'text-hud-blue' :
                      displayStatus === 'validating' ? 'text-hud-amber' :
                      'text-gray-400'
                    }`}>
                      {displayStatus === 'passed' ? 'Passed' :
                       displayStatus === 'failed' ? 'Failed' :
                       displayStatus === 'retrying' ? 'Retrying...' :
                       displayStatus === 'validating' ? 'Validating...' :
                       'Pending'}
                    </span>
                    {validationResult?.validatedAt && displayStatus === 'passed' && (
                      <span className="text-[10px] text-gray-600">
                        {new Date(validationResult.validatedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Error */}
                {displayError && displayStatus === 'failed' && (
                  <div className="bg-hud-red/10 border border-hud-red/20 rounded p-2 text-xs text-hud-red font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {displayError}
                  </div>
                )}

                {/* Retry Info */}
                {wsStatus?.status === 'retrying' && (
                  <div className="text-xs text-hud-blue flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Phase {wsStatus.retryPhase} ({wsStatus.retryTier}), Attempt {wsStatus.retryAttempt}
                  </div>
                )}
                {validationResult?.retryPhase && displayStatus === 'passed' && (
                  <div className="text-[10px] text-gray-500">
                    Saved by {validationResult.retryPhase} retry (attempt {validationResult.retryAttempts})
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Human Input Section */}
        {task.status === 'needs_human' && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              <MessageSquare className="w-3 h-3 inline mr-1" />
              Human Input Required
            </div>
            <textarea
              value={humanInput}
              onChange={(e) => setHumanInput(e.target.value)}
              className="w-full bg-command-bg border border-command-border rounded-sm px-3 py-2 text-sm focus:outline-hidden focus:border-hud-blue h-24 resize-none mb-2"
              placeholder="Enter your input or instructions..."
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleSubmitInput('approve')}
                disabled={loading}
                className="flex-1 btn-success text-xs py-1.5"
              >
                Approve
              </button>
              <button
                onClick={() => handleSubmitInput('modify')}
                disabled={loading || !humanInput}
                className="flex-1 btn-primary text-xs py-1.5"
              >
                Modify
              </button>
              <button
                onClick={() => handleSubmitInput('reject')}
                disabled={loading}
                className="flex-1 btn-danger text-xs py-1.5"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {task.error && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Error</div>
            <div className="bg-hud-red/10 border border-hud-red/30 rounded-sm p-3 text-sm text-hud-red">
              {task.error}
            </div>
          </div>
        )}

        {/* Result Display */}
        {task.result && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Result</div>
            <div className="bg-hud-green/10 border border-hud-green/30 rounded-sm p-3 text-sm">
              <pre className="whitespace-pre-wrap text-xs max-h-32 overflow-y-auto">
                {JSON.stringify(task.result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Code Review Section - Only for completed/failed tasks */}
        {['completed', 'failed'].includes(task.status) && (
          <div className="mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Star className="w-3 h-3" />
              Code Review (Opus)
            </div>

            {reviewLoading ? (
              <div className="bg-command-bg rounded-sm p-3 text-sm text-gray-400 animate-pulse">
                Loading review data...
              </div>
            ) : codeReview ? (
              <div className="space-y-3">
                {/* Quality Score & Status */}
                <div className="flex items-center gap-3">
                  {codeReview.codeQualityScore !== undefined && (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      codeReview.codeQualityScore >= 8 ? 'bg-hud-green/20 text-hud-green' :
                      codeReview.codeQualityScore >= 5 ? 'bg-hud-amber/20 text-hud-amber' :
                      'bg-hud-red/20 text-hud-red'
                    }`}>
                      {codeReview.codeQualityScore.toFixed(1)}/10
                    </div>
                  )}
                  <div className={`px-2 py-0.5 rounded text-xs uppercase ${
                    codeReview.status === 'approved' ? 'bg-hud-green/20 text-hud-green' :
                    codeReview.status === 'needs_fixes' ? 'bg-hud-amber/20 text-hud-amber' :
                    codeReview.status === 'rejected' ? 'bg-hud-red/20 text-hud-red' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {codeReview.status.replace('_', ' ')}
                  </div>
                  {codeReview.fixAttempts > 0 && (
                    <span className="text-xs text-gray-500">
                      {codeReview.fixAttempts} fix attempt{codeReview.fixAttempts > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Summary */}
                {codeReview.summary && (
                  <div className="bg-command-bg rounded-sm p-2 text-xs text-gray-300">
                    {codeReview.summary}
                  </div>
                )}

                {/* Findings */}
                {codeReview.findings && codeReview.findings.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase">
                      Findings ({codeReview.findings.length})
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {codeReview.findings.map((finding, i) => (
                        <div
                          key={i}
                          className={`text-xs p-2 rounded border-l-2 ${
                            finding.severity === 'critical' ? 'bg-hud-red/10 border-hud-red' :
                            finding.severity === 'high' ? 'bg-hud-red/5 border-hud-red/50' :
                            finding.severity === 'medium' ? 'bg-hud-amber/10 border-hud-amber' :
                            'bg-gray-500/10 border-gray-500'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] uppercase font-medium ${
                              finding.severity === 'critical' || finding.severity === 'high' ? 'text-hud-red' :
                              finding.severity === 'medium' ? 'text-hud-amber' : 'text-gray-400'
                            }`}>
                              {finding.severity}
                            </span>
                            <span className="text-gray-500">{finding.category}</span>
                          </div>
                          <div className="text-gray-300">{finding.description}</div>
                          {finding.suggestion && (
                            <div className="text-gray-500 mt-1 italic">→ {finding.suggestion}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Complexity Comparison */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-command-bg rounded-sm p-2 text-center">
                    <div className="text-[10px] text-gray-500">Initial Complexity</div>
                    <div className="text-sm font-medium">{codeReview.initialComplexity.toFixed(1)}</div>
                  </div>
                  {codeReview.opusComplexity !== undefined && (
                    <div className="bg-command-bg rounded-sm p-2 text-center">
                      <div className="text-[10px] text-gray-500">Opus Assessment</div>
                      <div className="text-sm font-medium">{codeReview.opusComplexity.toFixed(1)}</div>
                    </div>
                  )}
                </div>

                {/* Token Usage & Cost */}
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  {codeReview.inputTokens && (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {codeReview.inputTokens.toLocaleString()} in
                    </span>
                  )}
                  {codeReview.outputTokens && (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {codeReview.outputTokens.toLocaleString()} out
                    </span>
                  )}
                  {codeReview.totalCost && (
                    <span className="flex items-center gap-1 text-hud-green">
                      <DollarSign className="w-3 h-3" />
                      ${parseFloat(codeReview.totalCost).toFixed(4)}
                    </span>
                  )}
                </div>

                {/* Reviewer Info */}
                {codeReview.reviewerModel && (
                  <div className="text-[10px] text-gray-600">
                    Reviewed by: {codeReview.reviewerModel}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-command-bg rounded-sm p-3 text-xs text-gray-500 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" />
                No code review yet
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-command-border flex gap-2">
        {task.status === 'assigned' && (
          <button
            onClick={handleStartExecution}
            disabled={loading}
            className="flex-1 btn-primary"
          >
            <Play className="w-4 h-4 inline mr-1" />
            Start
          </button>
        )}
        {['failed', 'aborted'].includes(task.status) && (
          <button
            onClick={() => retryTask(task.id)}
            disabled={loading}
            className="flex-1 btn-primary"
          >
            <RefreshCw className="w-4 h-4 inline mr-1" />
            Retry
          </button>
        )}
        {['assigned', 'in_progress', 'needs_human'].includes(task.status) && (
          <button
            onClick={() => abortTask(task.id)}
            disabled={loading}
            className="flex-1 btn-danger"
          >
            <Square className="w-4 h-4 inline mr-1" />
            Abort
          </button>
        )}
      </div>
    </div>
  );
}
