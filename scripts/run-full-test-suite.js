#!/usr/bin/env node

/**
 * Full End-to-End Test Suite
 *
 * Tests the complete system with 10 tasks across all complexity tiers:
 * - Simple (≤3): Coder/Ollama
 * - Medium (3-7): QA/Haiku
 * - Complex (>7): CTO/Opus
 */

const fs = require('fs');

const TEST_TASKS = [
  // SIMPLE TASKS (Complexity ≤3) - Should route to Coder/Ollama
  {
    title: "Test 1: Create greeting function",
    description: "Create a file tasks/greeting.py with a function greet(name) that returns 'Hello, {name}!'",
    taskType: "code",
    priority: 3,
    expectedAgent: "coder",
    expectedComplexity: "simple"
  },
  {
    title: "Test 2: Create basic math utility",
    description: "Create tasks/math_util.py with a function square(n) that returns n * n",
    taskType: "code",
    priority: 3,
    expectedAgent: "coder",
    expectedComplexity: "simple"
  },
  {
    title: "Test 3: Create string reverser",
    description: "Create tasks/string_ops.py with a function reverse_string(s) that returns the reversed string",
    taskType: "code",
    priority: 4,
    expectedAgent: "coder",
    expectedComplexity: "simple"
  },

  // MEDIUM TASKS (Complexity 3-7) - Should route to QA/Haiku
  {
    title: "Test 4: Create validator module with tests",
    description: "Step 1: Create tasks/validator.py with function validate_email(email) using regex\nStep 2: Return True if valid email format, False otherwise\nStep 3: Test with valid and invalid emails",
    taskType: "code",
    priority: 5,
    expectedAgent: "qa",
    expectedComplexity: "medium"
  },
  {
    title: "Test 5: Create data converter with error handling",
    description: "Step 1: Create tasks/converter.py\nStep 2: Add function celsius_to_fahrenheit(c) that converts temperature\nStep 3: Add function fahrenheit_to_celsius(f)\nStep 4: Handle invalid input types with try/except",
    taskType: "code",
    priority: 6,
    expectedAgent: "qa",
    expectedComplexity: "medium"
  },
  {
    title: "Test 6: Create list utilities module",
    description: "Step 1: Create tasks/list_utils.py\nStep 2: Add function find_max(lst) that returns maximum value\nStep 3: Add function find_min(lst) that returns minimum value\nStep 4: Add function calculate_average(lst)\nStep 5: Handle empty list edge cases",
    taskType: "code",
    priority: 6,
    expectedAgent: "qa",
    expectedComplexity: "medium"
  },
  {
    title: "Test 7: Debug and fix validation",
    description: "Step 1: Read tasks/validator.py\nStep 2: Verify the regex pattern is correct\nStep 3: Fix any issues found\nStep 4: Test the validation function",
    taskType: "debug",
    priority: 7,
    expectedAgent: "qa",
    expectedComplexity: "medium"
  },

  // COMPLEX TASKS (Complexity >7) - Should route to CTO/Opus
  {
    title: "Test 8: Design and implement API client architecture",
    description: "Step 1: Create tasks/api_client/__init__.py\nStep 2: Create tasks/api_client/base.py with BaseClient class\nStep 3: Create tasks/api_client/http.py with HTTPClient that extends BaseClient\nStep 4: Implement get() and post() methods with error handling\nStep 5: Create tasks/api_client/auth.py for authentication\nStep 6: Integrate all components",
    taskType: "code",
    priority: 9,
    expectedAgent: "cto",
    expectedComplexity: "complex"
  },
  {
    title: "Test 9: Refactor existing modules for consistency",
    description: "Step 1: Read all files in tasks/ directory\nStep 2: Analyze code patterns and inconsistencies\nStep 3: Refactor functions to follow consistent naming conventions\nStep 4: Add docstrings to all functions\nStep 5: Ensure consistent error handling patterns\nStep 6: Document changes made",
    taskType: "refactor",
    priority: 8,
    expectedAgent: "cto",
    expectedComplexity: "complex"
  },
  {
    title: "Test 10: Review code quality and generate report",
    description: "Step 1: Review all Python files in tasks/\nStep 2: Check for code quality issues\nStep 3: Identify potential bugs or edge cases\nStep 4: Generate a quality report in tasks/QUALITY_REPORT.md\nStep 5: Prioritize issues by severity",
    taskType: "review",
    priority: 10,
    expectedAgent: "cto",
    expectedComplexity: "complex"
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resetAgents() {
  console.log('🔄 Resetting all agents...');
  await fetch('http://localhost:3001/api/agents/reset-all', { method: 'POST' });
  await sleep(2000);
}

async function createTask(task) {
  const response = await fetch('http://localhost:3001/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      priority: task.priority,
      maxIterations: 10,
      humanTimeoutMinutes: 15
    })
  });
  return response.json();
}

async function getRoutingRecommendation(taskId) {
  const response = await fetch(`http://localhost:3001/api/queue/${taskId}/route`);
  return response.json();
}

async function waitForAgentIdle(agentId, maxWait = 120) {
  const start = Date.now();
  while ((Date.now() - start) < maxWait * 1000) {
    const res = await fetch(`http://localhost:3001/api/agents/${agentId}`);
    const agent = await res.json();
    if (agent.status === 'idle') return true;
    await sleep(2000);
  }
  return false;
}

async function assignTask(taskId, agentId) {
  const response = await fetch('http://localhost:3001/api/queue/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, agentId })
  });
  return response.json();
}

async function executeTask(taskId, agentId, description) {
  // Check agent config for Claude requirement
  const agentRes = await fetch(`http://localhost:3001/api/agents/${agentId}`);
  const agent = await agentRes.json();
  const useClaude = agent.config?.alwaysUseClaude || false;

  const response = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: agentId,
      task_description: description,
      expected_output: 'Task completed successfully',
      use_claude: useClaude
    })
  });
  return response.json();
}

async function completeTask(taskId, result) {
  // Force iteration to max
  await fetch(`http://localhost:3001/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentIteration: 10 })
  });

  // Complete the task
  let output = {};
  try {
    output = result.output ? JSON.parse(result.output) : {};
  } catch {
    output = { status: 'UNKNOWN' };
  }

  await fetch(`http://localhost:3001/api/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: output.status === 'SUCCESS',
      result: output,
      error: output.status !== 'SUCCESS' ? (output.failure_reason || 'Task incomplete') : null
    })
  });

  return output;
}

async function runTest(testTask, index, total) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 TEST ${index + 1}/${total}: ${testTask.title}`);
  console.log(`   Expected: ${testTask.expectedComplexity} → ${testTask.expectedAgent}`);
  console.log(`${'─'.repeat(60)}`);

  const startTime = Date.now();

  try {
    // Create task
    const task = await createTask(testTask);
    console.log(`   ✅ Created task: ${task.id.substring(0, 8)}...`);

    // Get routing recommendation
    const routing = await getRoutingRecommendation(task.id);
    console.log(`   🎯 Routing: ${routing.agentName} (${routing.reason})`);

    const routedCorrectly = routing.agentId.includes(testTask.expectedAgent);
    console.log(`   ${routedCorrectly ? '✅' : '⚠️'} Route ${routedCorrectly ? 'CORRECT' : 'UNEXPECTED'}`);

    // Wait for agent
    const agentId = routing.agentId;
    console.log(`   ⏳ Waiting for ${agentId}...`);
    const idle = await waitForAgentIdle(agentId);

    if (!idle) {
      console.log(`   ⚠️ Agent busy, resetting...`);
      await resetAgents();
      await sleep(3000);
    }

    // Assign task
    const assigned = await assignTask(task.id, agentId);
    if (assigned.error) {
      throw new Error(`Assignment failed: ${assigned.error}`);
    }
    console.log(`   ✅ Assigned to ${agentId}`);

    // Execute
    console.log(`   🚀 Executing...`);
    const execResult = await executeTask(task.id, agentId, testTask.description);

    // Complete
    const output = await completeTask(task.id, execResult);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    const status = output.status || 'UNKNOWN';
    const icon = status === 'SUCCESS' ? '✅' : status === 'SOFT_FAILURE' ? '⚠️' : '❌';

    console.log(`   ${icon} Status: ${status} (${elapsed}s)`);
    console.log(`   📁 Files created: ${(output.files_created || []).length}`);

    return {
      test: index + 1,
      title: testTask.title,
      taskId: task.id,
      expectedAgent: testTask.expectedAgent,
      actualAgent: agentId,
      routedCorrectly,
      expectedComplexity: testTask.expectedComplexity,
      status,
      elapsed,
      filesCreated: output.files_created || [],
      success: status === 'SUCCESS' || status === 'SOFT_FAILURE'
    };

  } catch (error) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`   ❌ ERROR: ${error.message}`);
    return {
      test: index + 1,
      title: testTask.title,
      taskId: null,
      expectedAgent: testTask.expectedAgent,
      actualAgent: null,
      routedCorrectly: false,
      expectedComplexity: testTask.expectedComplexity,
      status: 'ERROR',
      elapsed,
      filesCreated: [],
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        AGENT BATTLE COMMAND CENTER - FULL TEST SUITE       ║');
  console.log('║                                                            ║');
  console.log('║  Testing all complexity tiers:                             ║');
  console.log('║  • Simple (≤3)  → Coder/Ollama (FREE)                      ║');
  console.log('║  • Medium (3-7) → QA/Haiku (~$0.001)                       ║');
  console.log('║  • Complex (>7) → CTO/Opus (~$0.04)                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n🕐 Started: ${new Date().toISOString()}\n`);

  // Reset agents first
  await resetAgents();

  const results = [];

  for (let i = 0; i < TEST_TASKS.length; i++) {
    const result = await runTest(TEST_TASKS[i], i, TEST_TASKS.length);
    results.push(result);

    // Small delay between tests
    await sleep(3000);
  }

  // Generate report
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL REPORT');
  console.log('═'.repeat(60));

  const successful = results.filter(r => r.success).length;
  const routedCorrectly = results.filter(r => r.routedCorrectly).length;
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);

  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total Tests:     ${results.length}`);
  console.log(`   Successful:      ${successful}/${results.length} (${Math.round(successful/results.length*100)}%)`);
  console.log(`   Routing Correct: ${routedCorrectly}/${results.length} (${Math.round(routedCorrectly/results.length*100)}%)`);
  console.log(`   Total Time:      ${totalTime}s`);

  console.log(`\n📋 BY COMPLEXITY TIER:`);

  const simple = results.filter(r => r.expectedComplexity === 'simple');
  const medium = results.filter(r => r.expectedComplexity === 'medium');
  const complex = results.filter(r => r.expectedComplexity === 'complex');

  console.log(`   Simple (Coder/Ollama):  ${simple.filter(r => r.success).length}/${simple.length} success, ${simple.filter(r => r.routedCorrectly).length}/${simple.length} routed correctly`);
  console.log(`   Medium (QA/Haiku):      ${medium.filter(r => r.success).length}/${medium.length} success, ${medium.filter(r => r.routedCorrectly).length}/${medium.length} routed correctly`);
  console.log(`   Complex (CTO/Opus):     ${complex.filter(r => r.success).length}/${complex.length} success, ${complex.filter(r => r.routedCorrectly).length}/${complex.length} routed correctly`);

  console.log(`\n📝 DETAILED RESULTS:`);
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const routeIcon = r.routedCorrectly ? '🎯' : '⚠️';
    console.log(`   ${icon} ${routeIcon} Test ${r.test}: ${r.title.substring(0, 40)}...`);
    console.log(`      Agent: ${r.actualAgent || 'N/A'} | Status: ${r.status} | Time: ${r.elapsed}s`);
  });

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      successful,
      routedCorrectly,
      totalTimeSeconds: totalTime,
      successRate: Math.round(successful/results.length*100),
      routingAccuracy: Math.round(routedCorrectly/results.length*100)
    },
    byTier: {
      simple: {
        total: simple.length,
        successful: simple.filter(r => r.success).length,
        routedCorrectly: simple.filter(r => r.routedCorrectly).length
      },
      medium: {
        total: medium.length,
        successful: medium.filter(r => r.success).length,
        routedCorrectly: medium.filter(r => r.routedCorrectly).length
      },
      complex: {
        total: complex.length,
        successful: complex.filter(r => r.success).length,
        routedCorrectly: complex.filter(r => r.routedCorrectly).length
      }
    },
    results
  };

  fs.writeFileSync('test-suite-results.json', JSON.stringify(report, null, 2));
  console.log(`\n💾 Results saved to test-suite-results.json`);
  console.log(`\n🕐 Completed: ${new Date().toISOString()}`);

  // Exit with appropriate code
  const allPassed = successful === results.length;
  console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
