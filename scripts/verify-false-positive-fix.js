#!/usr/bin/env node

/**
 * Verification Test: False-Positive Completion Fix
 *
 * Tests that tasks with failing tests are properly caught as SOFT_FAILURE
 * instead of being marked as completed.
 *
 * Test 1: Files + failing tests → should get SOFT_FAILURE, success=false
 * Test 2: Files + passing tests → should get SUCCESS, success=true (no regression)
 * Test 3: Files + no tests     → should get SUCCESS, success=true (no regression)
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TESTS = [
  // ─── Test 1: Files + failing tests → SOFT_FAILURE ─────────────────────
  {
    name: 'Test 1: Files + FAILING tests → SOFT_FAILURE',
    description: `IMPORTANT: You MUST use the file_write tool to create the file, then use shell_run to run the test.

Step 1: Use file_write to create tasks/verify_add_fail.py with this content:
def add(a, b):
    return a + b

Step 2: Use file_write to create tests/test_verify_add_fail.py with this content:
import sys
sys.path.insert(0, '/app/workspace')
from tasks.verify_add_fail import add
import unittest

class TestAdd(unittest.TestCase):
    def test_add_basic(self):
        self.assertEqual(add(2, 3), 999)  # DELIBERATELY WRONG - should fail
    def test_add_negative(self):
        self.assertEqual(add(-1, 1), 888)  # DELIBERATELY WRONG - should fail

if __name__ == '__main__':
    unittest.main()

Step 3: Use shell_run to run: python tests/test_verify_add_fail.py

DO NOT just output code - you MUST call file_write and shell_run tools.`,
    expectedSuccess: false,
    expectedStatus: 'SOFT_FAILURE',
    label: 'SHOULD FAIL (tests fail)',
  },

  // ─── Test 2: Files + passing tests → SUCCESS ──────────────────────────
  {
    name: 'Test 2: Files + PASSING tests → SUCCESS',
    description: `IMPORTANT: You MUST use the file_write tool to create the file, then use shell_run to run the test.

Step 1: Use file_write to create tasks/verify_greet_pass.py with this content:
def greet(name):
    return f"Hello, {name}!"

Step 2: Use file_write to create tests/test_verify_greet_pass.py with this content:
import sys
sys.path.insert(0, '/app/workspace')
from tasks.verify_greet_pass import greet
import unittest

class TestGreet(unittest.TestCase):
    def test_greet_basic(self):
        self.assertEqual(greet("World"), "Hello, World!")
    def test_greet_name(self):
        self.assertEqual(greet("Alice"), "Hello, Alice!")

if __name__ == '__main__':
    unittest.main()

Step 3: Use shell_run to run: python tests/test_verify_greet_pass.py

DO NOT just output code - you MUST call file_write and shell_run tools.`,
    expectedSuccess: true,
    expectedStatus: 'SUCCESS',
    label: 'SHOULD PASS (tests pass)',
  },

  // ─── Test 3: Files + no tests → SUCCESS ───────────────────────────────
  {
    name: 'Test 3: Files + NO tests → SUCCESS',
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/verify_hello_notest.py with this content:
def hello():
    return "Hello, World!"

Step 2: Verify the file was created by reading it back.

DO NOT run any tests. DO NOT just output code - you MUST call file_write tool.`,
    expectedSuccess: true,
    expectedStatus: 'SUCCESS',
    label: 'SHOULD PASS (no tests)',
  },
];

async function createTask(test, index) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      title: `[VERIFY-FP-FIX] ${test.name}`,
      description: test.description,
      expectedOutput: `Verification test ${index + 1}`,
      taskType: 'code',
      priority: 3,
      maxIterations: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status}`);
  }

  return response.json();
}

async function executeTask(taskId, description) {
  const response = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: 'coder-01',
      task_description: description,
      use_claude: false, // Force Ollama
      model: null,
    }),
  });

  return response;
}

async function waitForAgent(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/coder-01`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(1000);
  }
  return false;
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function main() {
  console.log('═'.repeat(70));
  console.log('🔍 VERIFICATION: False-Positive Completion Fix');
  console.log('═'.repeat(70));
  console.log('Test 1: Files + failing tests  → expected SOFT_FAILURE');
  console.log('Test 2: Files + passing tests  → expected SUCCESS (no regression)');
  console.log('Test 3: Files + no tests       → expected SUCCESS (no regression)');
  console.log('═'.repeat(70) + '\n');

  // Clean workspace
  console.log('🔄 Cleaning workspace...');
  try {
    const { execSync } = require('child_process');
    execSync(
      'docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/verify_*.py /app/workspace/tests/test_verify_*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"',
      { stdio: 'pipe' }
    );
    console.log('   ✓ Workspace cleaned\n');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace\n');
  }

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`${CYAN}[${i + 1}/${TESTS.length}]${RESET} ${test.name}`);
    console.log(`   ${YELLOW}Expected: success=${test.expectedSuccess}, status=${test.expectedStatus}${RESET}`);
    console.log('─'.repeat(70));

    const taskStart = Date.now();

    try {
      // Create task
      const created = await createTask(test, i);
      console.log(`   📋 Created task: ${created.id.substring(0, 8)}...`);

      // Assign to coder-01
      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' }),
      });

      // Execute
      console.log('   🤖 Executing with Ollama...');
      const execResponse = await executeTask(created.id, test.description);
      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (!execResponse.ok) {
        throw new Error(`Execution failed: ${(await execResponse.text()).substring(0, 200)}`);
      }

      const execResult = await execResponse.json();

      // Parse the agent output
      let agentOutput = null;
      try {
        agentOutput = JSON.parse(execResult.output);
      } catch {
        agentOutput = {};
      }

      const actualSuccess = execResult.success;
      const actualStatus = agentOutput.status || 'UNKNOWN';

      console.log(`   ⏱️  Duration: ${duration}s`);
      console.log(`   📊 Agent output:`);
      console.log(`      success: ${actualSuccess}`);
      console.log(`      status: ${actualStatus}`);
      console.log(`      test_results: ${agentOutput.test_results || 'N/A'}`);
      console.log(`      failure_reason: ${agentOutput.failure_reason || 'N/A'}`);
      console.log(`      confidence: ${agentOutput.confidence}`);

      // Complete the task (pass through the actual success value)
      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({ success: execResult.success, result: execResult }),
      });

      // Check the task's final status in the database
      await sleep(1000);
      const taskResponse = await fetch(`${API_BASE}/tasks/${created.id}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const finalTask = await taskResponse.json();

      console.log(`   📦 Final task status in DB: ${finalTask.status}`);

      // Evaluate results
      const successMatch = actualSuccess === test.expectedSuccess;
      const statusMatch = actualStatus === test.expectedStatus;
      // For Test 1, task should NOT be completed in DB (should be assigned/pending for retry)
      const dbStatusCorrect = test.expectedSuccess
        ? finalTask.status === 'completed'
        : finalTask.status !== 'completed';

      const allCorrect = successMatch && statusMatch && dbStatusCorrect;

      if (allCorrect) {
        console.log(`\n   ${GREEN}✅ PASS${RESET} - ${test.label}`);
      } else {
        console.log(`\n   ${RED}❌ FAIL${RESET} - ${test.label}`);
        if (!successMatch)
          console.log(`      ${RED}success: expected ${test.expectedSuccess}, got ${actualSuccess}${RESET}`);
        if (!statusMatch)
          console.log(`      ${RED}status: expected ${test.expectedStatus}, got ${actualStatus}${RESET}`);
        if (!dbStatusCorrect)
          console.log(`      ${RED}DB status: expected ${test.expectedSuccess ? 'completed' : 'not completed'}, got ${finalTask.status}${RESET}`);
      }

      results.push({
        name: test.name,
        passed: allCorrect,
        actualSuccess,
        actualStatus,
        dbStatus: finalTask.status,
        expectedSuccess: test.expectedSuccess,
        expectedStatus: test.expectedStatus,
        duration,
      });

      // Wait for agent to become idle + rest delay
      await waitForAgent();
      await sleep(3000);
    } catch (err) {
      console.log(`   ${RED}💥 ERROR: ${err.message}${RESET}`);
      results.push({
        name: test.name,
        passed: false,
        error: err.message,
        duration: Math.floor((Date.now() - taskStart) / 1000),
      });

      // Wait and continue
      await waitForAgent(60000);
      await sleep(3000);
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────
  const totalTime = Math.floor((Date.now() - startTime) / 1000);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n${'═'.repeat(70)}`);
  console.log('📊 VERIFICATION RESULTS');
  console.log('═'.repeat(70));

  for (const r of results) {
    const icon = r.passed ? `${GREEN}✅` : `${RED}❌`;
    const details = r.error
      ? `ERROR: ${r.error}`
      : `success=${r.actualSuccess} status=${r.actualStatus} db=${r.dbStatus}`;
    console.log(`${icon} ${r.name}${RESET}`);
    console.log(`   ${details}`);
  }

  console.log('─'.repeat(70));
  console.log(
    `Total: ${passed}/${results.length} passed | ${failed} failed | ${totalTime}s`
  );

  if (passed === results.length) {
    console.log(`\n${GREEN}🎉 ALL VERIFICATION TESTS PASSED - False-positive fix is working!${RESET}`);
  } else {
    console.log(`\n${RED}⚠️  SOME TESTS FAILED - Review results above${RESET}`);
  }

  console.log('═'.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
