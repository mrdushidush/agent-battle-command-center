#!/usr/bin/env node

/**
 * 30-Task Comprehensive Test Suite Runner (SEQUENTIAL)
 *
 * This script:
 * 1. Deletes all existing tasks
 * 2. Cleans workspace files
 * 3. Resets agents and stuck tasks
 * 4. Creates the 30-task test suite
 * 5. Executes tasks ONE BY ONE sequentially (in creation order)
 * 6. Reports progress every 2 minutes
 */

const { execSync } = require('child_process');
const { createTasks } = require('./create-comprehensive-suite.js');

const API_BASE = 'http://localhost:3001/api';
const POLL_INTERVAL_MS = 5000; // 5 seconds between status checks
const REPORT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between full reports
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max per task

async function deleteAllTasks() {
  console.log('\n🗑️  Deleting all existing tasks...');

  const response = await fetch(`${API_BASE}/tasks`);
  const tasks = await response.json();

  if (tasks.length === 0) {
    console.log('   No tasks to delete');
    return;
  }

  let deleted = 0;
  for (const task of tasks) {
    try {
      await fetch(`${API_BASE}/tasks/${task.id}`, { method: 'DELETE' });
      deleted++;
    } catch (e) {
      console.log(`   Failed to delete ${task.id}: ${e.message}`);
    }
  }

  console.log(`   ✅ Deleted ${deleted}/${tasks.length} tasks`);
}

async function cleanWorkspace() {
  console.log('\n🧹 Cleaning workspace...');

  try {
    execSync('docker exec abcc-agents sh -c "rm -rf /app/workspace/tasks/*.py 2>/dev/null; rm -rf /app/workspace/tests/*.py 2>/dev/null"', { stdio: 'pipe' });
    console.log('   ✅ Workspace cleaned');
  } catch (e) {
    console.log('   ⚠️  Could not clean workspace (may already be clean)');
  }
}

async function resetAgents() {
  console.log('\n🔄 Resetting agents...');

  try {
    const response = await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST' });
    const result = await response.json();
    console.log(`   ✅ Reset ${result.agentsReset} agents, fixed ${result.tasksFixed} stuck tasks`);

    // Keep Coder-02 offline (it has issues)
    await fetch(`${API_BASE}/agents/coder-02`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'offline' })
    });
    console.log(`   ✅ Coder-02 set to offline`);
  } catch (e) {
    console.log(`   ⚠️  Could not reset agents: ${e.message}`);
  }
}

function getTierName(priority) {
  if (priority <= 4) return 'OLLAMA';
  if (priority <= 7) return 'HAIKU';
  return 'SONNET';
}

function getTierColor(tier) {
  if (tier === 'OLLAMA') return '\x1b[36m'; // Cyan
  if (tier === 'HAIKU') return '\x1b[33m';  // Yellow
  return '\x1b[35m'; // Magenta for Sonnet
}

const RESET = '\x1b[0m';

async function getTaskStatus(taskId) {
  const response = await fetch(`${API_BASE}/tasks/${taskId}`);
  return response.json();
}

async function getRouting(taskId) {
  const response = await fetch(`${API_BASE}/queue/${taskId}/route`);
  return response.json();
}

async function assignTaskToAgent(taskId, agentId) {
  const response = await fetch(`${API_BASE}/queue/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, agentId })
  });
  return response.json();
}

async function triggerExecution(taskId, useClaude, model) {
  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId,
      useClaude: useClaude,
      model: model,
      allowFallback: true,
      stepByStep: false
    })
  });
  return response.json();
}

async function waitForAgentIdle(agentId, maxWaitMs = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${API_BASE}/agents/${agentId}`);
    const agent = await response.json();
    if (agent.status === 'idle') {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

async function waitForTaskCompletion(taskId, taskNum, totalTasks, tier, routing) {
  const startTime = Date.now();
  const tierColor = getTierColor(tier);

  while (true) {
    const task = await getTaskStatus(taskId);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    if (task.status === 'completed') {
      console.log(`   ${tierColor}→ ${tier}${RESET} (${routing.agentName})`);
      console.log(`   ✅ ${elapsed}s\n`);
      return { success: true, duration: elapsed };
    }

    if (task.status === 'failed') {
      const errorMsg = task.error ? task.error.substring(0, 60) : 'Unknown error';
      console.log(`   ${tierColor}→ ${tier}${RESET} (${routing.agentName})`);
      console.log(`   ❌ ${elapsed}s - ${errorMsg}\n`);
      return { success: false, duration: elapsed, error: errorMsg };
    }

    // Check for timeout
    if (Date.now() - startTime > TASK_TIMEOUT_MS) {
      console.log(`   ${tierColor}→ ${tier}${RESET} (${routing.agentName})`);
      console.log(`   ⏰ TIMEOUT after ${elapsed}s\n`);
      return { success: false, duration: elapsed, error: 'Timeout' };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

async function main() {
  console.log('🚀 30-TASK COMPREHENSIVE TIER TEST (SEQUENTIAL)');
  console.log('='.repeat(70));
  console.log('Testing: Ollama (≤4) | Haiku (5-7) | Sonnet (≥8)');
  console.log('='.repeat(70));

  // Step 1: Delete all tasks
  await deleteAllTasks();

  // Step 2: Clean workspace
  await cleanWorkspace();

  // Step 3: Reset agents
  await resetAgents();

  // Step 4: Create 30-task suite
  console.log('\n📝 Creating 30-task test suite...');
  const createdTasks = await createTasks();

  // Step 5: Execute tasks sequentially IN ORDER
  console.log('\n' + '='.repeat(70));
  console.log('🎯 EXECUTING TASKS SEQUENTIALLY (in creation order)');
  console.log('='.repeat(70) + '\n');

  const results = {
    total: createdTasks.length,
    completed: 0,
    failed: 0,
    byTier: {
      OLLAMA: { total: 0, completed: 0, failed: 0, totalTime: 0 },
      HAIKU: { total: 0, completed: 0, failed: 0, totalTime: 0 },
      SONNET: { total: 0, completed: 0, failed: 0, totalTime: 0 }
    }
  };

  const startTime = Date.now();
  let lastReportTime = startTime;

  for (let i = 0; i < createdTasks.length; i++) {
    const task = createdTasks[i];
    const tier = getTierName(task.priority);

    results.byTier[tier].total++;

    console.log(`${i + 1}/${results.total}: ${task.title.replace('[TIER-TEST] ', '')}`);

    // Get routing decision for this specific task
    const routing = await getRouting(task.id);

    if (!routing || !routing.agentId) {
      console.log(`   ⚠️  Could not get routing for task\n`);
      results.failed++;
      results.byTier[tier].failed++;
      continue;
    }

    // Wait for the agent to be idle
    const agentReady = await waitForAgentIdle(routing.agentId);
    if (!agentReady) {
      console.log(`   ⚠️  Agent ${routing.agentName} not available\n`);
      results.failed++;
      results.byTier[tier].failed++;
      continue;
    }

    // Assign this specific task to the routed agent
    const assignment = await assignTaskToAgent(task.id, routing.agentId);

    if (assignment.error) {
      console.log(`   ⚠️  Could not assign task: ${assignment.error}\n`);
      results.failed++;
      results.byTier[tier].failed++;
      continue;
    }

    // Trigger execution - determine useClaude based on tier
    const useClaude = tier !== 'OLLAMA';
    const model = tier === 'SONNET' ? 'claude-sonnet-4-5-20250929' :
                  tier === 'HAIKU' ? 'claude-haiku-4-5-20251001' : null;

    const execResult = await triggerExecution(task.id, useClaude, model);
    if (!execResult.started) {
      console.log(`   ⚠️  Could not start execution\n`);
      results.failed++;
      results.byTier[tier].failed++;
      continue;
    }

    // Wait for completion
    const result = await waitForTaskCompletion(task.id, i + 1, results.total, tier, routing);

    if (result.success) {
      results.completed++;
      results.byTier[tier].completed++;
    } else {
      results.failed++;
      results.byTier[tier].failed++;
    }
    results.byTier[tier].totalTime += result.duration;

    // Print periodic summary every 2 minutes
    if (Date.now() - lastReportTime >= REPORT_INTERVAL_MS) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log('\n' + '-'.repeat(50));
      console.log(`📊 Progress: ${results.completed + results.failed}/${results.total} | ✅ ${results.completed} | ❌ ${results.failed} | Elapsed: ${formatDuration(elapsed)}`);
      console.log('-'.repeat(50) + '\n');
      lastReportTime = Date.now();
    }
  }

  // Final report
  const totalTime = Math.floor((Date.now() - startTime) / 1000);

  console.log('\n' + '='.repeat(70));
  console.log('🎉 TEST SUITE COMPLETE');
  console.log('='.repeat(70));

  console.log(`\n📊 Final Results:`);
  console.log(`   Total Tasks:    ${results.total}`);
  console.log(`   Completed:      ${results.completed} (${Math.round(results.completed / results.total * 100)}%)`);
  console.log(`   Failed:         ${results.failed}`);
  console.log(`   Total Duration: ${formatDuration(totalTime)}`);

  console.log(`\n📦 By Tier:`);
  for (const [tier, stats] of Object.entries(results.byTier)) {
    const rate = stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0;
    const avgTime = stats.total > 0 ? Math.round(stats.totalTime / stats.total) : 0;
    const tierColor = getTierColor(tier);
    console.log(`   ${tierColor}${tier}${RESET}: ${stats.completed}/${stats.total} (${rate}%) | Avg: ${avgTime}s`);
  }

  console.log('\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Test interrupted.');
  process.exit(0);
});

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
