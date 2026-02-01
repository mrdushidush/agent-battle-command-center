#!/usr/bin/env node

/**
 * 20-Task Ollama Simple Test Suite
 * All tasks are simple (priority ≤4) to ensure Ollama routing
 * Uses qwen2.5-coder:7b model (more reliable tool calling than qwen3:8b)
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const POLL_INTERVAL_MS = 3000;
const TASK_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes per task

// Task template with explicit tool usage
function makeTask(name, funcName, code, testCode, fileName) {
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
  makeTask("greet", "greet",
    "def greet(name):\\n    return f'Hello, {name}!'",
    "from tasks.greet import greet; assert greet('World')=='Hello, World!'; print('PASS')",
    "greet"),
  makeTask("add", "add",
    "def add(a, b):\\n    return a + b",
    "from tasks.add import add; assert add(2,3)==5; print('PASS')",
    "add"),
  makeTask("subtract", "subtract",
    "def subtract(a, b):\\n    return a - b",
    "from tasks.subtract import subtract; assert subtract(10,4)==6; print('PASS')",
    "subtract"),
  makeTask("multiply", "multiply",
    "def multiply(a, b):\\n    return a * b",
    "from tasks.multiply import multiply; assert multiply(3,4)==12; print('PASS')",
    "multiply"),
  makeTask("divide", "divide",
    "def divide(a, b):\\n    return a / b",
    "from tasks.divide import divide; assert divide(10,2)==5; print('PASS')",
    "divide"),
  makeTask("square", "square",
    "def square(n):\\n    return n * n",
    "from tasks.square import square; assert square(5)==25; print('PASS')",
    "square"),
  makeTask("is_even", "is_even",
    "def is_even(n):\\n    return n % 2 == 0",
    "from tasks.is_even import is_even; assert is_even(4)==True; assert is_even(3)==False; print('PASS')",
    "is_even"),
  makeTask("is_positive", "is_positive",
    "def is_positive(n):\\n    return n > 0",
    "from tasks.is_positive import is_positive; assert is_positive(5)==True; assert is_positive(-1)==False; print('PASS')",
    "is_positive"),
  makeTask("absolute", "absolute",
    "def absolute(n):\\n    return abs(n)",
    "from tasks.absolute import absolute; assert absolute(-5)==5; print('PASS')",
    "absolute"),
  makeTask("double", "double",
    "def double(n):\\n    return n * 2",
    "from tasks.double import double; assert double(7)==14; print('PASS')",
    "double"),
  makeTask("reverse_string", "reverse_string",
    "def reverse_string(s):\\n    return s[::-1]",
    "from tasks.reverse_string import reverse_string; assert reverse_string('hello')=='olleh'; print('PASS')",
    "reverse_string"),
  makeTask("string_length", "string_length",
    "def string_length(s):\\n    return len(s)",
    "from tasks.string_length import string_length; assert string_length('hello')==5; print('PASS')",
    "string_length"),
  makeTask("to_uppercase", "to_uppercase",
    "def to_uppercase(s):\\n    return s.upper()",
    "from tasks.to_uppercase import to_uppercase; assert to_uppercase('hello')=='HELLO'; print('PASS')",
    "to_uppercase"),
  makeTask("to_lowercase", "to_lowercase",
    "def to_lowercase(s):\\n    return s.lower()",
    "from tasks.to_lowercase import to_lowercase; assert to_lowercase('HELLO')=='hello'; print('PASS')",
    "to_lowercase"),
  makeTask("first_char", "first_char",
    "def first_char(s):\\n    return s[0] if s else ''",
    "from tasks.first_char import first_char; assert first_char('hello')=='h'; print('PASS')",
    "first_char"),
  makeTask("last_char", "last_char",
    "def last_char(s):\\n    return s[-1] if s else ''",
    "from tasks.last_char import last_char; assert last_char('hello')=='o'; print('PASS')",
    "last_char"),
  makeTask("list_sum", "list_sum",
    "def list_sum(numbers):\\n    return sum(numbers)",
    "from tasks.list_sum import list_sum; assert list_sum([1,2,3,4])==10; print('PASS')",
    "list_sum"),
  makeTask("list_length", "list_length",
    "def list_length(items):\\n    return len(items)",
    "from tasks.list_length import list_length; assert list_length([1,2,3])==3; print('PASS')",
    "list_length"),
  makeTask("find_max", "find_max",
    "def find_max(numbers):\\n    return max(numbers)",
    "from tasks.find_max import find_max; assert find_max([3,1,4,1,5])==5; print('PASS')",
    "find_max"),
  makeTask("find_min", "find_min",
    "def find_min(numbers):\\n    return min(numbers)",
    "from tasks.find_min import find_min; assert find_min([3,1,4,1,5])==1; print('PASS')",
    "find_min"),
];

// All tasks use priority 3 to ensure Ollama routing
const TASK_PRIORITY = 3;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resetSystem() {
  console.log('🔄 Resetting system...');

  // Reset agents
  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST' });
    console.log('   ✓ Agents reset');
  } catch (e) {
    console.log('   ⚠ Could not reset agents');
  }

  // Clean workspace and create __init__.py for Python imports
  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
    console.log('   ✓ Workspace cleaned + __init__.py created');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace: ' + e.message);
  }

  await sleep(2000);
}

async function createTask(task, index) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[OLLAMA-20] ${task.title}`,
      description: task.description,
      expectedOutput: task.expectedOutput,
      taskType: 'code',
      priority: TASK_PRIORITY,
      maxIterations: 5
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status}`);
  }

  return response.json();
}

async function executeTask(taskId, agentId, description, expectedOutput) {
  const response = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: agentId,
      task_description: description,
      expected_output: expectedOutput,
      use_claude: false,  // Force Ollama
      model: null
    })
  });

  return response;
}

async function waitForAgent(agentId, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
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
    // Run from workspace directory so 'tasks' package can be found
    const result = execSync(`docker exec -w /app/workspace abcc-agents ${validation}`, {
      encoding: 'utf8',
      timeout: 10000
    });
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🚀 20-TASK OLLAMA TEST SUITE (qwen3:8b)');
  console.log('═'.repeat(70));
  console.log(`Tasks: ${tasks.length} | Priority: ${TASK_PRIORITY} (Ollama tier)`);
  console.log('═'.repeat(70) + '\n');

  // Reset system
  await resetSystem();

  const results = {
    total: tasks.length,
    passed: 0,
    failed: 0,
    errors: 0,
    details: []
  };

  const startTime = Date.now();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskNum = i + 1;

    console.log(`\n[${taskNum}/${tasks.length}] ${task.title}`);
    console.log('─'.repeat(50));

    const taskStart = Date.now();
    let status = 'error';
    let error = null;

    try {
      // Create task
      const created = await createTask(task, i);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      // Assign to coder-01
      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });
      console.log('   Assigned to: coder-01');

      // Execute
      console.log('   Executing...');
      const execResponse = await executeTask(
        created.id,
        'coder-01',
        task.description,
        task.expectedOutput
      );

      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (!execResponse.ok) {
        const errText = await execResponse.text();
        throw new Error(`Execution failed: ${errText.substring(0, 100)}`);
      }

      const execResult = await execResponse.json();

      // Mark task complete
      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: execResult.success, result: execResult })
      });

      // Run validation
      console.log('   Validating...');
      const passed = await runValidation(task.validation);

      if (passed) {
        status = 'passed';
        results.passed++;
        console.log(`   ✅ PASSED (${duration}s)`);
      } else {
        status = 'failed';
        results.failed++;
        console.log(`   ❌ FAILED - validation failed (${duration}s)`);
      }

      // Wait for agent to be ready
      await waitForAgent('coder-01');

    } catch (e) {
      error = e.message;
      results.errors++;
      console.log(`   💥 ERROR: ${e.message.substring(0, 60)}`);

      // Reset agent on error
      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST' });
      } catch (resetErr) {}

      await sleep(2000);
    }

    results.details.push({
      task: task.title,
      status,
      error,
      duration: Math.floor((Date.now() - taskStart) / 1000)
    });
  }

  // Final report
  const totalDuration = Math.floor((Date.now() - startTime) / 1000);
  const successRate = Math.round((results.passed / results.total) * 100);

  console.log('\n' + '═'.repeat(70));
  console.log('📊 FINAL RESULTS');
  console.log('═'.repeat(70));
  console.log(`   ✅ Passed:  ${results.passed}/${results.total} (${successRate}%)`);
  console.log(`   ❌ Failed:  ${results.failed}`);
  console.log(`   💥 Errors:  ${results.errors}`);
  console.log(`   ⏱️  Duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);
  console.log('═'.repeat(70));

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/ollama-20-results.json',
    JSON.stringify({ ...results, totalDuration, successRate }, null, 2)
  );
  console.log('\n💾 Results saved to scripts/ollama-20-results.json');

  // List failures
  const failures = results.details.filter(d => d.status !== 'passed');
  if (failures.length > 0) {
    console.log('\n❌ Failed tasks:');
    failures.forEach(f => console.log(`   - ${f.task}: ${f.error || f.status}`));
  }

  return results;
}

main()
  .then(results => process.exit(results.errors > 0 || results.failed > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
