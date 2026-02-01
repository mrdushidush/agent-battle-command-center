#!/usr/bin/env node

/**
 * Format diagnostic report as human-readable markdown
 */

const fs = require('fs');

function formatReport() {
  console.log('📝 Formatting diagnostic report...\n');

  const dataDir = 'scripts/diagnostic-data';
  const report = JSON.parse(fs.readFileSync(`${dataDir}/DIAGNOSTIC_REPORT.json`, 'utf8'));

  const markdown = generateMarkdown(report);

  const outputPath = `${dataDir}/DIAGNOSTIC_REPORT.md`;
  fs.writeFileSync(outputPath, markdown);

  console.log(`✅ Markdown report generated: ${outputPath}`);
  console.log(`\n📄 Preview:\n`);
  console.log(markdown.substring(0, 500) + '...\n');

  return outputPath;
}

function generateMarkdown(report) {
  const date = new Date(report.metadata.generatedAt).toLocaleString();

  let md = `# Agent Battle Command Center - Diagnostic Report

**Generated:** ${date}
**Total Tasks:** ${report.summary.totalTasks}
**Data Location:** \`${report.metadata.dataDirectory}\`

---

## Executive Summary

- **Total Tasks:** ${report.summary.totalTasks}
- **Completed:** ${report.summary.completed} (${(report.summary.completed / report.summary.totalTasks * 100).toFixed(0)}%)
- **Failed:** ${report.summary.failed} (${(report.summary.failed / report.summary.totalTasks * 100).toFixed(0)}%)
- **Aborted:** ${report.summary.aborted}
- **Avg Execution Time:** ${report.summary.avgExecutionTime}s (${Math.floor(report.summary.totalExecutionTime / 60)}m ${report.summary.totalExecutionTime % 60}s total)
- **Files Created:** ${report.summary.totalFilesCreated}
- **Files Modified:** ${report.summary.totalFilesModified}
- **Commands Executed:** ${report.summary.totalCommandsExecuted}
- **Total Tool Calls:** ${report.summary.totalToolCalls}
- **Tasks with Tests:** ${report.summary.tasksWithTests}
- **Tasks with Loops:** ${report.summary.tasksWithLoops}

---

## Local Agent (Ollama) Performance

**Tasks Assigned:** ${report.localAgentPerformance.tasksAssigned}
**Success Rate:** ${report.localAgentPerformance.successRate}% (${report.localAgentPerformance.tasksCompleted}/${report.localAgentPerformance.tasksAssigned})

### Strengths
`;

  // Add local agent strengths based on successful tasks
  const localSuccessful = report.taskBreakdown.filter(t =>
    !t.assignedAgentId.startsWith('cto') && t.success
  );

  if (localSuccessful.length > 0) {
    md += localSuccessful.slice(0, 5).map(t =>
      `- ✅ ${t.title} (complexity: ${t.complexity}/10, ${t.executionTime}s)`
    ).join('\n') + '\n\n';
  } else {
    md += '- No successful tasks\n\n';
  }

  md += `### Performance Metrics
- **Avg Complexity Handled:** ${report.localAgentPerformance.avgComplexity}/10
- **Max Complexity Succeeded:** ${report.localAgentPerformance.maxComplexitySucceeded}/10
- **Avg Execution Time:** ${report.localAgentPerformance.avgExecutionTime}s
- **Avg Iterations:** ${report.localAgentPerformance.avgIterations}
- **Files Created:** ${report.localAgentPerformance.filesCreated}
- **Tests Run:** ${report.localAgentPerformance.testsRun} tasks

### Weaknesses
`;

  // Add local agent failures
  const localFailed = report.taskBreakdown.filter(t =>
    !t.assignedAgentId.startsWith('cto') && !t.success
  );

  if (localFailed.length > 0) {
    md += localFailed.map(t =>
      `- ❌ ${t.title} (complexity: ${t.complexity}/10, status: ${t.status})`
    ).join('\n') + '\n\n';

    if (report.localAgentPerformance.loopIssues > 0) {
      md += `- ⚠️ Loop detection triggered ${report.localAgentPerformance.loopIssues} times\n\n`;
    }
  } else {
    md += '- No failed tasks\n\n';
  }

  md += `---

## CTO Agent (Claude) Performance

**Tasks Assigned:** ${report.ctoAgentPerformance.tasksAssigned}
**Success Rate:** ${report.ctoAgentPerformance.successRate}% (${report.ctoAgentPerformance.tasksCompleted}/${report.ctoAgentPerformance.tasksAssigned})

### Strengths
`;

  // Add CTO successes
  const ctoSuccessful = report.taskBreakdown.filter(t =>
    t.assignedAgentId.startsWith('cto') && t.success
  );

  if (ctoSuccessful.length > 0) {
    md += ctoSuccessful.map(t =>
      `- ✅ ${t.title} (complexity: ${t.complexity}/10, ${t.executionTime}s)`
    ).join('\n') + '\n\n';
  } else {
    md += '- No tasks assigned yet\n\n';
  }

  md += `### Performance Metrics
- **Avg Complexity:** ${report.ctoAgentPerformance.avgComplexity}/10
- **Avg Execution Time:** ${report.ctoAgentPerformance.avgExecutionTime}s
- **Avg Iterations:** ${report.ctoAgentPerformance.avgIterations}
- **Files Created:** ${report.ctoAgentPerformance.filesCreated}
- **Tests Run:** ${report.ctoAgentPerformance.testsRun} tasks

`;

  // Add CTO failures if any
  const ctoFailed = report.taskBreakdown.filter(t =>
    t.assignedAgentId.startsWith('cto') && !t.success
  );

  if (ctoFailed.length > 0) {
    md += `### Issues\n`;
    md += ctoFailed.map(t =>
      `- ❌ ${t.title} (complexity: ${t.complexity}/10, status: ${t.status})`
    ).join('\n') + '\n\n';
  }

  md += `---

## Task Routing Analysis

**Routing Accuracy:** ${report.routingAccuracy.accuracy}% (${report.routingAccuracy.correctRoutes}/${report.routingAccuracy.totalTasks} correct)

`;

  if (report.routingAccuracy.misroutedTasks.length > 0) {
    md += `### Misrouted Tasks\n`;
    md += report.routingAccuracy.misroutedTasks.map(t =>
      `- **${t.title}**  \n  Expected: ${t.expectedAgent} | Actual: ${t.assignedAgentId} | Complexity: ${t.complexity}/10`
    ).join('\n\n') + '\n\n';
  } else {
    md += `✅ All tasks routed correctly!\n\n`;
  }

  md += `## Complexity Analysis

### Task Distribution by Complexity
- **Simple (0-3.9):** ${report.complexityAnalysis.byComplexityRange.simple} tasks
- **Medium (4.0-6.9):** ${report.complexityAnalysis.byComplexityRange.medium} tasks
- **Complex (7.0-8.9):** ${report.complexityAnalysis.byComplexityRange.complex} tasks
- **Very Complex (9.0-10):** ${report.complexityAnalysis.byComplexityRange.veryComplex} tasks

### Success Rate by Complexity
- **Simple:** ${report.complexityAnalysis.successByComplexity.simple.toFixed(0)}%
- **Medium:** ${report.complexityAnalysis.successByComplexity.medium.toFixed(0)}%
- **Complex:** ${report.complexityAnalysis.successByComplexity.complex.toFixed(0)}%
- **Very Complex:** ${report.complexityAnalysis.successByComplexity.veryComplex.toFixed(0)}%

---

## Training Data Collected

- **Total Entries:** ${report.trainingDataQuality.total}
- **Claude Executions:** ${report.trainingDataQuality.claudeExecutions}
- **Local Executions:** ${report.trainingDataQuality.localExecutions}
- **Comparison Pairs:** ${report.trainingDataQuality.comparisonPairs}
- **Good Examples:** ${report.trainingDataQuality.goodExamples}
- **Avg Quality Score:** ${report.trainingDataQuality.avgQualityScore.toFixed(2)}

---

## Recommendations

`;

  // Add recommendations
  const recs = report.recommendations;

  if (recs.localAgentImprovements.length > 0) {
    md += `### For Local Agent Improvement:\n`;
    recs.localAgentImprovements.forEach((rec, i) => {
      md += `${i + 1}. **${rec.issue}**  \n`;
      if (rec.examples) {
        md += `   Examples: ${rec.examples.join(', ')}  \n`;
      }
      md += `   Suggestion: ${rec.suggestion}\n\n`;
    });
  }

  if (recs.taskRoutingChanges.length > 0) {
    md += `### For Task Routing:\n`;
    recs.taskRoutingChanges.forEach((rec, i) => {
      md += `${i + 1}. **${rec.issue}**  \n`;
      if (rec.examples) {
        md += `   Examples:\n`;
        rec.examples.forEach(ex => {
          md += `   - ${ex.title || ex}: expected ${ex.expected}, got ${ex.actual} (complexity: ${ex.complexity})\n`;
        });
      }
      md += `   Suggestion: ${rec.suggestion}\n\n`;
    });
  }

  if (recs.trainingDataActions.length > 0) {
    md += `### For Training Data:\n`;
    recs.trainingDataActions.forEach((rec, i) => {
      md += `${i + 1}. **${rec.issue}**  \n`;
      md += `   Suggestion: ${rec.suggestion}\n\n`;
    });
  }

  if (recs.systemOptimizations.length > 0) {
    md += `### For System Optimization:\n`;
    recs.systemOptimizations.forEach((rec, i) => {
      md += `${i + 1}. **${rec.issue}**  \n`;
      if (rec.impact) {
        md += `   Impact: ${rec.impact}  \n`;
      }
      md += `   Suggestion: ${rec.suggestion}\n\n`;
    });
  }

  md += `---

## Detailed Task Results

| # | Task | Type | Complexity | Agent | Status | Result | Time | Iterations | Files | Tests |
|---|------|------|-----------|-------|--------|--------|------|-----------|-------|-------|
`;

  report.taskBreakdown.forEach((task, i) => {
    const agentIcon = task.assignedAgentId.startsWith('cto') ? '👑' : '🤖';
    const statusIcon = task.success ? '✅' : task.status === 'failed' ? '❌' : '⏸️';

    md += `| ${i + 1} | ${task.title.substring(0, 40)}... | ${task.taskType} | ${task.complexity} | ${agentIcon} ${task.assignedAgent} | ${task.status} | ${statusIcon} ${task.resultStatus} | ${task.executionTime}s | ${task.iterationsUsed}/${task.maxIterations} | ${task.filesCreated} | ${task.testsRun ? '✅' : '❌'} |\n`;
  });

  md += `\n---

## Conclusion

`;

  const successRate = (report.summary.completed / report.summary.totalTasks * 100).toFixed(0);

  if (successRate >= 80) {
    md += `🎉 **Excellent performance!** ${successRate}% task completion rate demonstrates strong agent capabilities.\n\n`;
  } else if (successRate >= 60) {
    md += `✅ **Good performance.** ${successRate}% completion rate with room for improvement.\n\n`;
  } else {
    md += `⚠️ **Needs improvement.** ${successRate}% completion rate indicates agent reliability issues.\n\n`;
  }

  if (report.localAgentPerformance.maxComplexitySucceeded > 0) {
    md += `**Local Agent Ceiling:** Successfully handled complexity up to ${report.localAgentPerformance.maxComplexitySucceeded}/10.\n\n`;
  }

  if (report.ctoAgentPerformance.tasksAssigned > 0) {
    md += `**CTO Effectiveness:** ${report.ctoAgentPerformance.successRate}% success rate on high-complexity tasks.\n\n`;
  }

  md += `**Training Data:** ${report.trainingDataQuality.total} executions captured for future model fine-tuning.\n\n`;

  md += `---

*Report generated by Agent Battle Command Center Diagnostic Suite*
`;

  return md;
}

// Run if called directly
if (require.main === module) {
  formatReport();
}

module.exports = { formatReport };
