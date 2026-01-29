import { useEffect, useState } from 'react';

interface CodeReviewFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
  suggestion?: string;
}

interface CodeReview {
  id: string;
  taskId: string;
  reviewerId: string | null;
  reviewerModel: string | null;
  initialComplexity: number;
  opusComplexity: number | null;
  findings: CodeReviewFinding[];
  summary: string | null;
  codeQualityScore: number | null;
  status: 'pending' | 'approved' | 'needs_fixes' | 'rejected';
  fixAttempts: number;
  fixedByAgentId: string | null;
  fixedByModel: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalCost: number | null;
  createdAt: string;
  updatedAt: string;
}

interface CodeReviewPanelProps {
  taskId: string;
}

export function CodeReviewPanel({ taskId }: CodeReviewPanelProps) {
  const [review, setReview] = useState<CodeReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReview();
  }, [taskId]);

  const fetchReview = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/code-reviews/task/${taskId}`);

      if (response.status === 404) {
        setReview(null);
        setError(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch code review');
      }

      const data = await response.json();
      setReview(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching code review:', err);
      setError('Failed to load code review');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-command-surface border border-command-border rounded-lg p-4">
        <div className="text-command-text-secondary">Loading code review...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-command-surface border border-command-border rounded-lg p-4">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="bg-command-surface border border-command-border rounded-lg p-4">
        <div className="text-command-text-secondary">No code review available for this task</div>
      </div>
    );
  }

  return (
    <div className="bg-command-surface border border-command-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-command-text flex items-center gap-2">
            Code Review
            <StatusBadge status={review.status} />
          </h3>
          <div className="text-sm text-command-text-secondary mt-1">
            Reviewed by {review.reviewerModel || 'Unknown'}
          </div>
        </div>

        {review.codeQualityScore !== null && (
          <div className="text-right">
            <div className="text-sm text-command-text-secondary">Quality Score</div>
            <div className={`text-2xl font-bold ${getScoreColor(review.codeQualityScore)}`}>
              {review.codeQualityScore.toFixed(1)}/10
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {review.summary && (
        <div className="bg-command-bg border border-command-border rounded p-3">
          <div className="text-sm text-command-text-secondary mb-1">Summary</div>
          <div className="text-command-text">{review.summary}</div>
        </div>
      )}

      {/* Complexity Comparison */}
      {review.opusComplexity && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-command-bg border border-command-border rounded p-3">
            <div className="text-sm text-command-text-secondary">Initial Complexity</div>
            <div className="text-xl font-semibold text-command-text">
              {review.initialComplexity.toFixed(1)}
            </div>
          </div>
          <div className="bg-command-bg border border-command-border rounded p-3">
            <div className="text-sm text-command-text-secondary">Opus Assessment</div>
            <div className="text-xl font-semibold text-command-accent">
              {review.opusComplexity.toFixed(1)}
            </div>
          </div>
        </div>
      )}

      {/* Findings */}
      {review.findings && review.findings.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-command-text mb-2">
            Findings ({review.findings.length})
          </div>
          <div className="space-y-2">
            {review.findings.map((finding, index) => (
              <FindingCard key={index} finding={finding} />
            ))}
          </div>
        </div>
      )}

      {/* Fix Attempts */}
      {review.fixAttempts > 0 && (
        <div className="bg-command-bg border border-command-border rounded p-3">
          <div className="text-sm text-command-text-secondary">
            Fix attempts: {review.fixAttempts}
            {review.fixedByModel && ` (by ${review.fixedByModel})`}
          </div>
        </div>
      )}

      {/* Cost */}
      {review.totalCost && (
        <div className="flex justify-between text-sm">
          <span className="text-command-text-secondary">Review Cost:</span>
          <span className="text-command-accent font-mono">${review.totalCost.toFixed(6)}</span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    needs_fixes: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const color = colors[status as keyof typeof colors] || colors.pending;

  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-semibold uppercase ${color}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function FindingCard({ finding }: { finding: CodeReviewFinding }) {
  const severityColors = {
    critical: 'border-red-500 bg-red-500/10',
    high: 'border-orange-500 bg-orange-500/10',
    medium: 'border-yellow-500 bg-yellow-500/10',
    low: 'border-blue-500 bg-blue-500/10',
  };

  const severityIcons = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
  };

  return (
    <div className={`border rounded p-3 ${severityColors[finding.severity]}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg">{severityIcons[finding.severity]}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-command-text uppercase">
              {finding.severity}
            </span>
            <span className="text-sm text-command-text-secondary">
              • {finding.category}
            </span>
          </div>
          <div className="text-command-text text-sm mb-2">{finding.description}</div>

          {finding.location && (
            <div className="text-xs text-command-text-secondary mb-1">
              📍 {finding.location}
            </div>
          )}

          {finding.suggestion && (
            <div className="mt-2 text-sm bg-command-surface rounded p-2 border border-command-border">
              <div className="text-command-text-secondary text-xs mb-1">💡 Suggestion:</div>
              <div className="text-command-text">{finding.suggestion}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-400';
  if (score >= 6) return 'text-yellow-400';
  if (score >= 4) return 'text-orange-400';
  return 'text-red-400';
}
