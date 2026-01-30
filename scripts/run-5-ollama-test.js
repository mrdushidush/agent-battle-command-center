#!/usr/bin/env node

/**
 * Quick 5-Task Ollama Test (subset of 20-task suite)
 * For verifying temperature=0 fix
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';

function makeTask(funcName, code, testCode, fileName) {
  return {
    title: `Create ${funcName} function`,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/${fileName}.py with this exact content:
${code}

Step 2: Verify the file was created successfully.

DO NOT just output the code - you MUST call file_write(path="tasks/${fileName}.py", content="...")`,
    expectedOutput: `File tasks/${fileName}.py created with ${funcName} function`,
    validation: `python -c "${testCode}"`
  };
}

const tasks = [
  makeTask("greet", "def greet(name):\\n    return f'Hello, {name}!'",
    "from tasks.greet import greet; assert greet('World')=='Hello, World!'; print('PASS')", "greet"),
  makeTask("add", "def add(a, b):\\n    return a + b",
    "from tasks.add import add; assert add(2,3)==5; print('PASS')", "add"),
  makeTask("multiply", "def multiply(a, b):\\n    return a * b",
    "from tasks.multiply import multiply; assert multiply(3,4)==12; print('PASS')", "multiply"),
  makeTask("reverse_string", "def reverse_string(s):\\n    return s[::-1]",
    "from tasks.reverse_string import reverse_string; assert reverse_string('hello')=='olleh'; print('PASS')", "reverse_string"),
  makeTask("find_max", "def find_max(numbers):\\n    return max(numbers)",
    "from tasks.find_max import find_max; assert find_max([3,1,4,1,5])==5; print('PASS')", "find_max"),
];

const TASK_PRIORITY = 3;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resetSystem() {
  console.log('🔄 Resetting system...');
  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST' });
    console.log('   ✓ Agents reset');
  } catch (e) {
    console.log('   ⚠ Could not reset agents');
  }

  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
    console.log('   ✓ Workspace cleaned + __init__.py created');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace');
  }
  await sleep(2000);
}

async function createTask(task) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[TEST-5] ${task.title}`,
      description: task.description,
      expectedOutput: task.expectedOutput,
      taskType: 'code',
      priority: TASK_PRIORITY,
      maxIterations: 5
    })
  });
  return response.json();
}

async function executeTask(taskId, agentId, description, expectedOutput) {
  return await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: agentId,
      task_description: description,
      expected_output: expectedOutput,
      use_claude: false,
      model: null
    })
  });
}

async function waitForAgent(agentId) {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`);
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(1000);
  }
  return false;
}

async function runValidation(validation) {
  try {
    const { execSync } = require('child_process');
    const result = execSync(`docker exec -w /app/workspace abcc-agents ${validation}`, {
      encoding: 'utf8',
      timeout: 10000
    });
    return result.includes('PASS');
  } catch (e) {
    console.log(`   Validation error: ${e.message.substring(0, 50)}`);
    return false;
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🧪 QUICK 5-TASK OLLAMA TEST (temperature=0 verification)');
  console.log('═'.repeat(60));

  await resetSystem();

  let passed = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`\n[${i + 1}/${tasks.length}] ${task.title}`);
    console.log('─'.repeat(40));

    try {
      const created = await createTask(task);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      console.log('   Executing...');
      const execResponse = await executeTask(created.id, 'coder-01', task.description, task.expectedOutput);

      if (!execResponse.ok) {
        throw new Error('Execution failed');
      }

      await execResponse.json();

      console.log('   Validating...');
      if (await runValidation(task.validation)) {
        passed++;
        console.log('   ✅ PASSED');
      } else {
        failed++;
        console.log('   ❌ FAILED');
      }

      await waitForAgent('coder-01');

    } catch (e) {
      failed++;
      console.log(`   💥 ERROR: ${e.message.substring(0, 40)}`);
      await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST' }).catch(() => {});
      await sleep(2000);
    }
  }

  const duration = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`   ✅ Passed: ${passed}/5 (${passed * 20}%)`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
  console.log('═'.repeat(60));

  if (passed >= 4) {
    console.log('\n🎉 Temperature fix appears to work! Run full 20-task suite.');
  } else {
    console.log('\n⚠️  Still having issues. Need further investigation.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
