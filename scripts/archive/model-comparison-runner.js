#!/usr/bin/env node

/**
 * Model Comparison Runner
 * Runs the same 20 tasks on two different Ollama models and compares results
 */

const fs = require('fs');

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';

// Configuration
const MODELS_TO_TEST = [
  { name: 'qwen2.5-coder:7b', alias: 'qwen25-coder' },
  { name: 'qwen3:8b', alias: 'qwen3' },
];

const EXECUTE_TIMEOUT_MS = 600000; // 10 minutes per task (Ollama can be slow)
const INTER_TASK_DELAY_MS = 3000;  // 3 seconds between tasks
const AGENT_IDLE_WAIT_MS = 60000;  // 60 seconds max wait for agent

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Wait for agent to become idle
 */
async function waitForAgentIdle(agentId, maxWaitMs = AGENT_IDLE_WAIT_MS) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`);
      const agent = await response.json();

      if (agent.status === 'idle') {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return false;
}

/**
 * Reset a single task to pending status
 */
async function resetTask(taskId) {
  const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'pending',
      currentIteration: 0,
      result: null,
      error: null,
      completedAt: null,
      timeSpentMs: 0,
      assignedAgentId: null,
      assignedAt: null,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.log(`   ⚠️  Reset task failed: ${text}`);
    return false;
  }

  // Verify the reset worked
  const verifyResponse = await fetch(`${API_BASE}/tasks/${taskId}`);
  const task = await verifyResponse.json();
  if (task.status !== 'pending') {
    console.log(`   ⚠️  Task reset but status is ${task.status}, not pending`);
    return false;
  }

  return true;
}

/**
 * Reset agent to idle
 */
async function resetAgent(agentId) {
  await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'idle',
      currentTaskId: null,
    }),
  });
}

/**
 * Clean workspace test files (remove files created by test tasks)
 */
async function cleanWorkspace() {
  console.log('🧹 Cleaning workspace test files...');
  try {
    const { execSync } = require('child_process');
    // Remove test files but keep __init__.py and __pycache__
    const testFiles = [
      'math_add.py', 'math_multiply.py', 'math_factorial.py', 'math_prime.py',
      'str_reverse.py', 'str_vowels.py', 'str_palindrome.py', 'str_capitalize.py',
      'list_sum.py', 'list_max.py', 'list_evens.py', 'list_dedup.py',
      'conv_temp.py', 'conv_distance.py', 'conv_time.py', 'conv_color.py',
      'val_email.py', 'val_leap.py', 'val_positive.py', 'val_password.py',
    ];
    for (const file of testFiles) {
      try {
        execSync(`docker exec abcc-agents rm -f /app/workspace/tasks/${file}`, { encoding: 'utf8' });
      } catch (e) {
        // Ignore if file doesn't exist
      }
    }
    console.log('   Workspace cleaned (removed test files)');
  } catch (error) {
    console.log('   Workspace clean failed:', error.message);
  }
}

/**
 * Run validation command in the agents container
 */
async function runValidation(validationCommand) {
  if (!validationCommand) return { passed: false, output: 'No validation command' };

  try {
    const { execSync } = require('child_process');
    // Run validation in the workspace directory via docker
    const cmd = `docker exec -w /app/workspace abcc-agents ${validationCommand}`;
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return { passed: output.includes('PASS'), output: output.trim() };
  } catch (error) {
    return { passed: false, output: error.message };
  }
}

/**
 * Execute a single task with specified model
 */
async function executeTask(task, modelName, agentId = 'coder-01') {
  const startTime = Date.now();

  // Get full task details including validation command
  let validationCommand = null;
  try {
    const taskResponse = await fetch(`${API_BASE}/tasks/${task.id}`);
    const fullTask = await taskResponse.json();
    validationCommand = fullTask.validationCommand;
  } catch (e) {
    // Ignore
  }

  try {
    // Assign task to agent
    const assignResponse = await fetch(`${API_BASE}/queue/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.id,
        agentId: agentId,
      }),
    });

    if (!assignResponse.ok) {
      const errorText = await assignResponse.text();
      throw new Error(`Assignment failed: ${errorText}`);
    }

    const assignedTask = await assignResponse.json();

    // Execute with Ollama model
    const executeResponse = await fetchWithTimeout(`${AGENTS_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: task.id,
        agent_id: agentId,
        task_description: assignedTask.description,
        expected_output: assignedTask.acceptanceCriteria || null,
        use_claude: false,  // Force Ollama
        model: `ollama/${modelName}`,  // Specify exact model
      }),
    }, EXECUTE_TIMEOUT_MS);

    const executeTime = Date.now() - startTime;

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();

      // Mark task as failed
      await fetch(`${API_BASE}/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Execution error: ${errorText}`,
        }),
      });

      return {
        taskId: task.id,
        title: task.title,
        model: modelName,
        status: 'failed',
        error: errorText,
        durationMs: executeTime,
        validationPassed: false,
      };
    }

    const executeResult = await executeResponse.json();
    const resultOutput = executeResult.output ? JSON.parse(executeResult.output) : {};
    const taskSuccess = executeResult.success && resultOutput.success;

    // Run actual validation command
    const validation = await runValidation(validationCommand);

    // Mark task as complete
    await fetch(`${API_BASE}/tasks/${task.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: validation.passed,
        result: { ...resultOutput, actualValidation: validation },
        error: validation.passed ? null : (validation.output || 'Validation failed'),
      }),
    });

    return {
      taskId: task.id,
      title: task.title,
      model: modelName,
      status: validation.passed ? 'completed' : 'failed',
      resultStatus: resultOutput.status,
      durationMs: executeTime,
      filesCreated: resultOutput.files_created?.length || 0,
      confidence: resultOutput.confidence || 0,
      validationPassed: validation.passed,
      validationOutput: validation.output,
      error: validation.passed ? null : validation.output,
    };

  } catch (error) {
    const executeTime = Date.now() - startTime;

    // Force reset agent
    await resetAgent(agentId);

    return {
      taskId: task.id,
      title: task.title,
      model: modelName,
      status: 'error',
      error: error.message,
      durationMs: executeTime,
      validationPassed: false,
    };
  }
}

/**
 * Run all tasks with a specific model
 */
async function runTestSuite(tasks, modelName, modelAlias) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 RUNNING TEST SUITE: ${modelName}`);
  console.log(`${'='.repeat(70)}\n`);

  const results = [];
  const agentId = 'coder-01';

  // Reset agent before starting
  await resetAgent(agentId);
  await new Promise(resolve => setTimeout(resolve, 2000));

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskNum = i + 1;

    console.log(`\n[${taskNum}/${tasks.length}] ${task.title}`);
    console.log(`   Task ID: ${task.id}`);

    // Reset task to pending
    const resetOk = await resetTask(task.id);
    if (!resetOk) {
      results.push({
        taskId: task.id,
        title: task.title,
        model: modelName,
        status: 'error',
        error: 'Failed to reset task to pending',
        durationMs: 0,
        validationPassed: false,
      });
      continue;
    }

    // Small delay after reset
    await new Promise(resolve => setTimeout(resolve, 500));

    // Execute task
    const result = await executeTask(task, modelName, agentId);
    results.push(result);

    // Log result
    const statusIcon = result.status === 'completed' ? '✅' : '❌';
    const validIcon = result.validationPassed ? '✓' : '✗';
    console.log(`   ${statusIcon} Status: ${result.status} | Validation: ${validIcon} | Time: ${Math.round(result.durationMs / 1000)}s`);

    if (result.error) {
      console.log(`   Error: ${result.error.substring(0, 100)}...`);
    }

    // Wait for agent to be ready
    await waitForAgentIdle(agentId);

    // Inter-task delay
    if (i < tasks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, INTER_TASK_DELAY_MS));
    }
  }

  // Save results
  const resultsFile = `scripts/results-${modelAlias}-${Date.now()}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to ${resultsFile}`);

  return results;
}

/**
 * Generate comparison report
 */
function generateComparisonReport(allResults) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 MODEL COMPARISON REPORT');
  console.log(`${'='.repeat(70)}\n`);

  const report = {
    generatedAt: new Date().toISOString(),
    models: {},
    taskComparison: [],
    summary: {},
  };

  // Process each model's results
  for (const [modelName, results] of Object.entries(allResults)) {
    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const errors = results.filter(r => r.status === 'error').length;
    const validationPassed = results.filter(r => r.validationPassed).length;
    const avgDuration = results.reduce((sum, r) => sum + (r.durationMs || 0), 0) / results.length;

    report.models[modelName] = {
      total: results.length,
      completed,
      failed,
      errors,
      validationPassed,
      successRate: ((completed / results.length) * 100).toFixed(1) + '%',
      validationRate: ((validationPassed / results.length) * 100).toFixed(1) + '%',
      avgDurationMs: Math.round(avgDuration),
      avgDurationSec: Math.round(avgDuration / 1000),
    };

    console.log(`\n📦 ${modelName}`);
    console.log(`   Total: ${results.length}`);
    console.log(`   ✅ Completed: ${completed} (${report.models[modelName].successRate})`);
    console.log(`   ✓  Validation Passed: ${validationPassed} (${report.models[modelName].validationRate})`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   💥 Errors: ${errors}`);
    console.log(`   ⏱️  Avg Duration: ${Math.round(avgDuration / 1000)}s`);
  }

  // Task-by-task comparison
  const modelNames = Object.keys(allResults);
  if (modelNames.length === 2) {
    const [model1, model2] = modelNames;
    const results1 = allResults[model1];
    const results2 = allResults[model2];

    console.log(`\n${'─'.repeat(70)}`);
    console.log('📋 TASK-BY-TASK COMPARISON');
    console.log(`${'─'.repeat(70)}`);
    console.log(`\n${'Task'.padEnd(45)} | ${model1.padEnd(10)} | ${model2.padEnd(10)}`);
    console.log(`${'-'.repeat(45)}-+-${'-'.repeat(10)}-+-${'-'.repeat(10)}`);

    let model1Wins = 0;
    let model2Wins = 0;
    let ties = 0;

    for (let i = 0; i < results1.length; i++) {
      const r1 = results1[i];
      const r2 = results2[i];

      const title = r1.title.substring(0, 43).padEnd(45);
      const s1 = r1.validationPassed ? '✅ PASS' : '❌ FAIL';
      const s2 = r2.validationPassed ? '✅ PASS' : '❌ FAIL';

      console.log(`${title} | ${s1.padEnd(10)} | ${s2.padEnd(10)}`);

      report.taskComparison.push({
        task: r1.title,
        [model1]: { status: r1.status, validation: r1.validationPassed, duration: r1.durationMs },
        [model2]: { status: r2.status, validation: r2.validationPassed, duration: r2.durationMs },
      });

      if (r1.validationPassed && !r2.validationPassed) model1Wins++;
      else if (!r1.validationPassed && r2.validationPassed) model2Wins++;
      else ties++;
    }

    console.log(`\n📊 Head-to-Head:`);
    console.log(`   ${model1} wins: ${model1Wins}`);
    console.log(`   ${model2} wins: ${model2Wins}`);
    console.log(`   Ties: ${ties}`);

    report.summary = {
      [`${model1}_wins`]: model1Wins,
      [`${model2}_wins`]: model2Wins,
      ties,
      recommendation: model1Wins > model2Wins ? model1 : (model2Wins > model1Wins ? model2 : 'TIE'),
    };

    // Determine winner
    const v1 = report.models[model1].validationPassed;
    const v2 = report.models[model2].validationPassed;

    console.log(`\n${'='.repeat(70)}`);
    if (v1 > v2) {
      console.log(`🏆 WINNER: ${model1} (${v1}/${results1.length} validations passed)`);
    } else if (v2 > v1) {
      console.log(`🏆 WINNER: ${model2} (${v2}/${results2.length} validations passed)`);
    } else {
      console.log(`🤝 TIE: Both models passed ${v1}/${results1.length} validations`);
    }
    console.log(`${'='.repeat(70)}\n`);
  }

  // Save report
  const reportFile = `scripts/model-comparison-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`💾 Full report saved to ${reportFile}`);

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔬 MODEL COMPARISON TEST SUITE');
  console.log('==============================\n');
  console.log(`Testing models: ${MODELS_TO_TEST.map(m => m.name).join(' vs ')}`);
  console.log(`Tasks: 20 simple coding tasks (complexity < 4)`);
  console.log(`Timeout per task: ${EXECUTE_TIMEOUT_MS / 1000}s`);

  // Load task IDs
  const tasks = JSON.parse(fs.readFileSync('scripts/test-task-ids-v1.json', 'utf8'));
  console.log(`\nLoaded ${tasks.length} tasks from test-task-ids-v1.json`);

  // Check services are running
  try {
    await fetch(`${API_BASE}/agents`);
    await fetch(`${AGENTS_BASE}/health`);
    console.log('✅ Services are running\n');
  } catch (error) {
    console.error('❌ Services not available. Start with: docker compose up');
    process.exit(1);
  }

  // Reset all agents individually (don't use reset-all as it marks tasks as failed)
  console.log('🔄 Resetting all agents...');
  const agentIds = ['coder-01', 'coder-02', 'qa-alpha', 'cto-prime'];
  for (const agentId of agentIds) {
    await resetAgent(agentId);
  }
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Reset all test tasks to pending
  console.log('🔄 Resetting all test tasks to pending...');
  let resetCount = 0;
  for (const task of tasks) {
    const ok = await resetTask(task.id);
    if (ok) resetCount++;
  }
  console.log(`   Reset ${resetCount}/${tasks.length} tasks`);

  const allResults = {};
  const startTime = Date.now();

  // Run tests for each model
  for (const model of MODELS_TO_TEST) {
    // Clean workspace before each model run
    await cleanWorkspace();

    const results = await runTestSuite(tasks, model.name, model.alias);
    allResults[model.name] = results;

    // Wait between models
    if (MODELS_TO_TEST.indexOf(model) < MODELS_TO_TEST.length - 1) {
      console.log('\n⏳ Waiting 10s before next model...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Reset agents between runs (individually, not reset-all)
      for (const agentId of ['coder-01', 'coder-02', 'qa-alpha', 'cto-prime']) {
        await resetAgent(agentId);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Generate comparison report
  const report = generateComparisonReport(allResults);

  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);
  console.log(`\n⏰ Total test time: ${totalTime} minutes`);

  return report;
}

// Run
main()
  .then(() => {
    console.log('\n✅ Model comparison complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
