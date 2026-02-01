import type { Task, ExecutionLog } from '@prisma/client';

/**
 * Calculate actual complexity based on task execution results
 *
 * This provides a post-execution complexity score that can be compared
 * to the initial complexity assessment to improve routing accuracy.
 */
export function calculateActualComplexity(
  task: Task & { executionLogs?: ExecutionLog[] },
  logs: ExecutionLog[]
): number {
  const { status, currentIteration, maxIterations, complexity: taskComplexity } = task;

  // Base complexity from task status
  let baseComplexity = 0;

  if (status === 'completed') {
    // Successful completion - complexity based on effort
    baseComplexity = 3; // Baseline for success
  } else if (status === 'failed' || status === 'aborted') {
    // Failed tasks are complex by definition
    baseComplexity = 7; // High baseline for failure
  } else if (status === 'needs_human') {
    // Needed escalation - moderately complex
    baseComplexity = 6;
  } else {
    // Unknown/pending - use estimated complexity
    return taskComplexity ?? 5;
  }

  // Adjust based on tool calls (more tool calls = more complexity)
  const toolCallCount = logs.length;

  let toolCallAdjustment = 0;
  if (toolCallCount < 5) {
    toolCallAdjustment = -1; // Simple task
  } else if (toolCallCount < 10) {
    toolCallAdjustment = 0; // Average
  } else if (toolCallCount < 20) {
    toolCallAdjustment = +1; // Complex
  } else {
    toolCallAdjustment = +2; // Very complex
  }

  // Adjust based on retries (more retries = more complexity)
  const retryAdjustment = Math.min(currentIteration - 1, 3); // Cap at +3

  // Adjust based on loops detected
  const loopCount = logs.filter(log => log.isLoop).length;
  const loopAdjustment = Math.min(loopCount, 2); // Cap at +2

  // Calculate final actual complexity
  let actualComplexity = baseComplexity + toolCallAdjustment + retryAdjustment + loopAdjustment;

  // For failed tasks, cap at complexity + 2
  // (don't assume task was super complex just because it failed)
  if (status === 'failed' || status === 'aborted') {
    const cap = (taskComplexity ?? 8) + 2;
    actualComplexity = Math.min(actualComplexity, cap);
  }

  // Clamp to 1-10 range
  actualComplexity = Math.max(1, Math.min(10, actualComplexity));

  return actualComplexity;
}

/**
 * Categorize errors from task execution
 */
export function categorizeError(task: Task, logs: ExecutionLog[]): string | null {
  const { status, error } = task;

  if (status !== 'failed' && status !== 'aborted') {
    return null;
  }

  const errorMsg = error?.toLowerCase() ?? '';

  // Check for loop detection
  const hasLoops = logs.some(log => log.isLoop);
  if (hasLoops) {
    return 'loop_detected';
  }

  // Check for timeout
  if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    return 'timeout';
  }

  // Check for max iterations
  if (errorMsg.includes('max iterations')) {
    return 'max_iterations';
  }

  // Check for API errors
  if (errorMsg.includes('api error') || errorMsg.includes('rate limit')) {
    return 'api_error';
  }

  // Check for syntax errors
  if (errorMsg.includes('syntax error') || errorMsg.includes('syntaxerror')) {
    return 'syntax_error';
  }

  // Check for runtime errors
  if (
    errorMsg.includes('runtime error') ||
    errorMsg.includes('exception') ||
    errorMsg.includes('error:')
  ) {
    return 'runtime_error';
  }

  // Check for file/import errors
  if (errorMsg.includes('import') || errorMsg.includes('module not found')) {
    return 'import_error';
  }

  // Check for permission errors
  if (errorMsg.includes('permission') || errorMsg.includes('access denied')) {
    return 'permission_error';
  }

  // Default to unknown
  return 'unknown_error';
}
