#!/usr/bin/env node

/**
 * Analyze all execution data and generate diagnostic report
 */

const fs = require('fs');

// Reimplemented complexity calculator (matches TaskRouter.ts logic)
function calculateComplexity(task) {
  let score = 0;

  const description = (task.description || '').toLowerCase();

  // Count steps
  const stepMatches = description.match(/step \d+:/gi);
  if (stepMatches) {
    score += stepMatches.length * 0.5;
  }

  // High complexity keywords (+2 each)
  const highKeywords = ['multi-file', 'architecture', 'refactor', 'design', 'integrate', 'complex'];
  for (const keyword of highKeywords) {
    if (description.includes(keyword)) score += 2;
  }

  // Medium complexity keywords (+1 each)
  const mediumKeywords = ['test', 'debug', 'fix', 'api', 'database', 'async', 'validate', 'verify'];
  for (const keyword of mediumKeywords) {
    if (description.includes(keyword)) score += 1;
  }

  // Low complexity keywords (-0.5 each)
  const lowKeywords = ['create', 'simple', 'basic'];
  for (const keyword of lowKeywords) {
    if (description.includes(keyword)) score -= 0.5;
  }

  // Task type weight
  const typeWeights = {
    code: 1,
    test: 2,
    refactor: 2,
    review: 2,
    debug: 1.5
  };
  score += typeWeights[task.taskType] || 1;

  // Priority weight
  score += (task.priority || 5) * 0.05;

  // Previous failures
  score += (task.currentIteration || 0) * 1.5;

  return Math.max(0, Math.min(10, score));
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function sum(arr) {
  return arr.reduce((sum, val) => sum + val, 0);
}

function max(arr) {
  if (arr.length === 0) return 0;
  return Math.max(...arr);
}

function calculateSuccessRate(tasks) {
  if (tasks.length === 0) return 0;
  const successful = tasks.filter(t => t.success).length;
  return successful / tasks.length;
}

function analyzeResults() {
  console.log('📊 Analyzing execution results...\n');

  const dataDir = 'scripts/diagnostic-data';

  // Load all data
  const tasks = JSON.parse(fs.readFileSync(`${dataDir}/post-execution-tasks.json`, 'utf8'));
  const trainingData = JSON.parse(fs.readFileSync(`${dataDir}/training-data.json`, 'utf8'));
  const trainingStats = JSON.parse(fs.readFileSync(`${dataDir}/training-data-stats.json`, 'utf8'));
  const agents = JSON.parse(fs.readFileSync(`${dataDir}/post-execution-agents.json`, 'utf8'));
  const executionResults = JSON.parse(fs.readFileSync(`${dataDir}/execution-results.json`, 'utf8'));
  const routing = JSON.parse(fs.readFileSync(`${dataDir}/pre-execution-routing.json`, 'utf8'));

  // Analyze each task
  console.log('1️⃣  Analyzing individual tasks...');
  const taskAnalysis = tasks.map(task => {
    // Load execution logs
    let logs = [];
    const logFile = `${dataDir}/logs-${task.id.substring(0, 8)}.json`;
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }

    const result = task.result || {};
    const complexity = calculateComplexity(task);
    const execution = executionResults.find(e => e.taskId === task.id) || {};
    const expectedRouting = routing.find(r => r.taskId === task.id) || {};

    return {
      id: task.id.substring(0, 8),
      title: task.title,
      taskType: task.taskType,
      priority: task.priority,
      complexity: parseFloat(complexity.toFixed(1)),
      expectedAgent: expectedRouting.agentId || 'unknown',
      assignedAgent: task.assignedAgent?.name || 'none',
      assignedAgentId: task.assignedAgent?.id || 'none',
      status: task.status,
      success: result.status === 'SUCCESS',
      confidence: result.confidence || 0,
      executionTime: execution.durationSec || task.timeSpentMs ? Math.floor(task.timeSpentMs / 1000) : 0,
      iterationsUsed: task.currentIteration || 0,
      maxIterations: task.maxIterations || 25,
      filesCreated: result.files_created?.length || 0,
      filesModified: result.files_modified?.length || 0,
      commandsExecuted: result.commands_executed?.length || 0,
      testsRun: result.test_results ? true : false,
      testResults: result.test_results || null,
      loopsDetected: logs.filter(l => l.isLoop).length,
      toolCallsCount: logs.length,
      resultStatus: result.status || 'UNKNOWN',
      requiresHumanReview: result.requires_human_review || false
    };
  });

  console.log('2️⃣  Calculating performance metrics...');

  // Local agent performance
  const localAgentTasks = taskAnalysis.filter(t => !t.assignedAgentId.startsWith('cto'));
  const localSuccessful = localAgentTasks.filter(t => t.success);

  // CTO agent performance
  const ctoTasks = taskAnalysis.filter(t => t.assignedAgentId.startsWith('cto'));
  const ctoSuccessful = ctoTasks.filter(t => t.success);

  // Routing accuracy
  const correctRoutes = taskAnalysis.filter(t => t.expectedAgent === t.assignedAgentId).length;

  // Generate report
  console.log('3️⃣  Generating diagnostic report...');

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      dataDirectory: dataDir
    },

    summary: {
      totalTasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      aborted: tasks.filter(t => t.status === 'aborted').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      avgExecutionTime: Math.floor(average(taskAnalysis.map(t => t.executionTime))),
      totalExecutionTime: sum(taskAnalysis.map(t => t.executionTime)),
      totalFilesCreated: sum(taskAnalysis.map(t => t.filesCreated)),
      totalFilesModified: sum(taskAnalysis.map(t => t.filesModified)),
      totalCommandsExecuted: sum(taskAnalysis.map(t => t.commandsExecuted)),
      totalToolCalls: sum(taskAnalysis.map(t => t.toolCallsCount)),
      tasksWithTests: taskAnalysis.filter(t => t.testsRun).length,
      tasksWithLoops: taskAnalysis.filter(t => t.loopsDetected > 0).length
    },

    localAgentPerformance: {
      tasksAssigned: localAgentTasks.length,
      tasksCompleted: localSuccessful.length,
      successRate: parseFloat((calculateSuccessRate(localAgentTasks) * 100).toFixed(1)),
      avgComplexity: parseFloat(average(localAgentTasks.map(t => t.complexity)).toFixed(1)),
      avgComplexityHandled: parseFloat(average(localSuccessful.map(t => t.complexity)).toFixed(1)),
      maxComplexitySucceeded: max(localSuccessful.map(t => t.complexity)),
      avgExecutionTime: Math.floor(average(localAgentTasks.map(t => t.executionTime))),
      avgIterations: Math.floor(average(localAgentTasks.map(t => t.iterationsUsed))),
      loopIssues: localAgentTasks.filter(t => t.loopsDetected > 0).length,
      filesCreated: sum(localAgentTasks.map(t => t.filesCreated)),
      testsRun: localAgentTasks.filter(t => t.testsRun).length
    },

    ctoAgentPerformance: {
      tasksAssigned: ctoTasks.length,
      tasksCompleted: ctoSuccessful.length,
      successRate: parseFloat((calculateSuccessRate(ctoTasks) * 100).toFixed(1)),
      avgComplexity: parseFloat(average(ctoTasks.map(t => t.complexity)).toFixed(1)),
      avgExecutionTime: Math.floor(average(ctoTasks.map(t => t.executionTime))),
      avgIterations: Math.floor(average(ctoTasks.map(t => t.iterationsUsed))),
      filesCreated: sum(ctoTasks.map(t => t.filesCreated)),
      testsRun: ctoTasks.filter(t => t.testsRun).length
    },

    routingAccuracy: {
      correctRoutes: correctRoutes,
      totalTasks: tasks.length,
      accuracy: parseFloat((correctRoutes / tasks.length * 100).toFixed(1)),
      misroutedTasks: taskAnalysis.filter(t => t.expectedAgent !== t.assignedAgentId)
    },

    trainingDataQuality: {
      ...trainingStats,
      avgQualityScore: trainingStats.total > 0 ?
        parseFloat((trainingData.reduce((sum, d) => sum + (d.qualityScore || 0), 0) / trainingStats.total).toFixed(2)) : 0
    },

    complexityAnalysis: {
      byComplexityRange: {
        simple: taskAnalysis.filter(t => t.complexity < 4).length,
        medium: taskAnalysis.filter(t => t.complexity >= 4 && t.complexity < 7).length,
        complex: taskAnalysis.filter(t => t.complexity >= 7 && t.complexity < 9).length,
        veryComplex: taskAnalysis.filter(t => t.complexity >= 9).length
      },
      successByComplexity: {
        simple: calculateSuccessRate(taskAnalysis.filter(t => t.complexity < 4)) * 100,
        medium: calculateSuccessRate(taskAnalysis.filter(t => t.complexity >= 4 && t.complexity < 7)) * 100,
        complex: calculateSuccessRate(taskAnalysis.filter(t => t.complexity >= 7 && t.complexity < 9)) * 100,
        veryComplex: calculateSuccessRate(taskAnalysis.filter(t => t.complexity >= 9)) * 100
      }
    },

    taskBreakdown: taskAnalysis,

    recommendations: generateRecommendations(taskAnalysis, localAgentTasks, ctoTasks)
  };

  // Save report
  const reportPath = `${dataDir}/DIAGNOSTIC_REPORT.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n✅ Diagnostic report generated: ${reportPath}`);
  console.log('\n📊 Quick Summary:');
  console.log(`   Total Tasks: ${report.summary.totalTasks}`);
  console.log(`   Completed: ${report.summary.completed} (${(report.summary.completed / report.summary.totalTasks * 100).toFixed(0)}%)`);
  console.log(`   Local Agent Success: ${report.localAgentPerformance.successRate}%`);
  console.log(`   CTO Agent Success: ${report.ctoAgentPerformance.successRate}%`);
  console.log(`   Routing Accuracy: ${report.routingAccuracy.accuracy}%`);
  console.log(`   Training Data Collected: ${report.trainingDataQuality.total} entries`);

  return report;
}

function generateRecommendations(allTasks, localTasks, ctoTasks) {
  const recommendations = {
    localAgentImprovements: [],
    taskRoutingChanges: [],
    trainingDataActions: [],
    systemOptimizations: []
  };

  // Analyze local agent failures
  const localFailed = localTasks.filter(t => !t.success);
  if (localFailed.length > 0) {
    const failurePatterns = {};
    localFailed.forEach(t => {
      const key = t.taskType;
      if (!failurePatterns[key]) failurePatterns[key] = [];
      failurePatterns[key].push(t.title);
    });

    for (const [type, tasks] of Object.entries(failurePatterns)) {
      recommendations.localAgentImprovements.push({
        issue: `${tasks.length} ${type} task(s) failed`,
        examples: tasks.slice(0, 2),
        suggestion: `Review backstory and tool usage for ${type} tasks`
      });
    }
  }

  // Check loop detection
  const loopTasks = allTasks.filter(t => t.loopsDetected > 0);
  if (loopTasks.length > 0) {
    recommendations.systemOptimizations.push({
      issue: `${loopTasks.length} task(s) triggered loop detection`,
      impact: 'Wastes iterations and prevents completion',
      suggestion: 'Loop detection is working - consider more aggressive stop conditions'
    });
  }

  // Check routing mismatches
  const misrouted = allTasks.filter(t => t.expectedAgent !== t.assignedAgentId);
  if (misrouted.length > 0) {
    recommendations.taskRoutingChanges.push({
      issue: `${misrouted.length} task(s) routed differently than expected`,
      examples: misrouted.slice(0, 3).map(t => ({
        title: t.title,
        expected: t.expectedAgent,
        actual: t.assignedAgentId,
        complexity: t.complexity
      })),
      suggestion: 'Review complexity scoring thresholds'
    });
  }

  // Check complexity ceiling for local agents
  const localSuccessful = localTasks.filter(t => t.success);
  if (localSuccessful.length > 0) {
    const maxSuccess = max(localSuccessful.map(t => t.complexity));
    const minFailure = localFailed.length > 0 ? Math.min(...localFailed.map(t => t.complexity)) : 10;

    if (minFailure < 7 && minFailure < maxSuccess + 1) {
      recommendations.taskRoutingChanges.push({
        issue: `Local agent ceiling unclear - succeeded at ${maxSuccess.toFixed(1)} but failed at ${minFailure.toFixed(1)}`,
        suggestion: `Consider routing tasks with complexity > ${((maxSuccess + minFailure) / 2).toFixed(1)} to CTO`
      });
    }
  }

  // Training data recommendations
  const trainingDataCount = allTasks.filter(t => t.success).length;
  if (trainingDataCount < 20) {
    recommendations.trainingDataActions.push({
      issue: `Only ${trainingDataCount} successful executions captured`,
      suggestion: 'Need 20+ examples for statistically significant training set'
    });
  }

  return recommendations;
}

// Run if called directly
if (require.main === module) {
  analyzeResults();
}

module.exports = { analyzeResults, calculateComplexity };
