#!/usr/bin/env node

/**
 * Parallel Task Execution Test
 *
 * Tests parallel execution of Ollama tasks and Claude tasks.
 * - 5 Ollama tasks (simple, priority 3) - uses local GPU
 * - 3 Claude tasks (medium, priority 5) - uses cloud API
 *
 * Expected result: ~40-60% faster than sequential execution
 * because Ollama and Claude tasks run simultaneously.
 */

const API_BASE = 'http://localhost:3001/api';
const API_KEY = process.env.API_KEY || '';

// Simple Ollama task template
function makeOllamaTask(funcName, code, testCode, fileName) {
  return {
    title: `Create ${funcName} function`,
    description: `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/${fileName}.py with this exact content:
${code}

Step 2: Verify the file was created successfully.

DO NOT just output the code - you MUST call file_write(path="tasks/${fileName}.py", content="...")`,
    expectedOutput: `File tasks/${fileName}.py created with ${funcName} function`,
    validation: `python -c "${testCode}"`,
    priority: 3,
    tier: 'ollama',
    fileName
  };
}

// Medium Claude task template (Haiku tier)
function makeClaudeTask(title, description, expectedOutput, validation, fileName) {
  return {
    title,
    description,
    expectedOutput,
    validation,
    priority: 5,
    tier: 'haiku',
    fileName
  };
}

const tasks = [
  // === OLLAMA TASKS (5 simple tasks) ===
  makeOllamaTask("square", "def square(n):\\n    return n * n",
    "from tasks.square import square; assert square(4)==16; print('PASS')", "square"),
  makeOllamaTask("double", "def double(n):\\n    return n * 2",
    "from tasks.double import double; assert double(5)==10; print('PASS')", "double"),
  makeOllamaTask("negate", "def negate(n):\\n    return -n",
    "from tasks.negate import negate; assert negate(3)==-3; print('PASS')", "negate"),
  makeOllamaTask("is_even", "def is_even(n):\\n    return n % 2 == 0",
    "from tasks.is_even import is_even; assert is_even(4)==True; assert is_even(3)==False; print('PASS')", "is_even"),
  makeOllamaTask("absolute", "def absolute(n):\\n    return abs(n)",
    "from tasks.absolute import absolute; assert absolute(-5)==5; print('PASS')", "absolute"),

  // === CLAUDE TASKS (3 medium tasks) ===
  makeClaudeTask(
    "Create factorial function",
    `Create a Python function factorial(n) that calculates factorial:
- Return n! (n factorial)
- Handle n=0 (return 1)
- Handle negative numbers (raise ValueError)
- Use iterative approach

Save to tasks/factorial.py`,
    "Factorial function",
    `python -c "from tasks.factorial import factorial; assert factorial(0)==1; assert factorial(5)==120; print('PASS')"`,
    "factorial"
  ),

  makeClaudeTask(
    "Create prime checker",
    `Create a Python function is_prime(n) that checks if a number is prime:
- Return True if n is prime, False otherwise
- Handle n <= 1 (return False)
- Handle n == 2 (return True)

Save to tasks/prime.py`,
    "Prime checker",
    `python -c "from tasks.prime import is_prime; assert is_prime(2)==True; assert is_prime(17)==True; assert is_prime(4)==False; assert is_prime(1)==False; print('PASS')"`,
    "prime"
  ),

  makeClaudeTask(
    "Create list deduplicator",
    `Create a Python function dedupe(items) that removes duplicates preserving order:
- Remove duplicate items from list
- Preserve the original order (keep first occurrence)
- Handle empty list (return empty list)

Save to tasks/dedupe.py`,
    "List deduplicator",
    `python -c "from tasks.dedupe import dedupe; assert dedupe([1,2,1,3,2])==[1,2,3]; assert dedupe([])==[]; print('PASS')"`,
    "dedupe"
  ),
];

// Model mapping for each tier
const TIER_MODELS = {
  'ollama': null,
  'haiku': 'claude-haiku-4-5-20251001',
};

const TIER_INFO = {
  'ollama': { icon: '📦', name: 'Ollama', agent: 'coder-01' },
  'haiku':  { icon: '🐰', name: 'Haiku',  agent: 'qa-01' },
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resetSystem() {
  console.log('🔄 Resetting system...');
  try {
    await fetch(`${API_BASE}/agents/reset-all`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
    await fetch(`${API_BASE}/queue/resources/clear`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('   ✓ Agents and resources reset');
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
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      title: `[PARALLEL] ${task.title}`,
      description: task.description,
      expectedOutput: task.expectedOutput,
      taskType: 'code',
      priority: task.priority,
      maxIterations: task.tier === 'haiku' ? 10 : 5
    })
  });
  return response.json();
}

async function assignTask(taskId, agentId) {
  const response = await fetch(`${API_BASE}/queue/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ taskId, agentId })
  });
  return response.json();
}

async function executeTask(taskId, agentId, description, expectedOutput, tier) {
  const useClaude = tier !== 'ollama';
  const model = TIER_MODELS[tier];

  // Use API endpoint instead of calling agents service directly
  return await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.API_KEY || ''
    },
    body: JSON.stringify({
      taskId: taskId,
      useClaude: useClaude,
      model: model
    })
  });
}

async function completeTask(taskId, result) {
  await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ success: result.success, result })
  });
}

async function waitForAgent(agentId, maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(1000);
  }
  return false;
}

async function waitForTaskCompletion(taskId, maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      const task = await response.json();
      if (['completed', 'failed', 'aborted'].includes(task.status)) {
        return task;
      }
    } catch (e) {}
    await sleep(2000);
  }
  throw new Error('Task timeout');
}

async function runValidation(validation) {
  try {
    const { execSync } = require('child_process');
    const match = validation.match(/python -c "(.+)"/);
    if (!match) {
      console.log(`   Validation error: Invalid format`);
      return false;
    }
    const pythonCode = match[1];
    const b64Code = Buffer.from(pythonCode).toString('base64');
    const cmd = `docker exec -e PYTHONPATH=/app/workspace abcc-agents python3 -c "import sys; sys.path.insert(0,'/app/workspace'); import base64; exec(base64.b64decode('${b64Code}').decode())"`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    return result.includes('PASS');
  } catch (e) {
    const errMsg = e.stderr || e.message || '';
    if (errMsg.includes('ModuleNotFoundError') || errMsg.includes('No module')) {
      console.log(`   Validation error: Module not found`);
    } else {
      console.log(`   Validation error: ${errMsg.substring(0, 50)}`);
    }
    return false;
  }
}

async function getResourceStatus() {
  try {
    const response = await fetch(`${API_BASE}/queue/resources`, {
      headers: { 'X-API-Key': API_KEY }
    });
    return await response.json();
  } catch (e) {
    return null;
  }
}

/**
 * Run a single task end-to-end
 */
async function runTask(task, taskId, logPrefix) {
  const tierInfo = TIER_INFO[task.tier];
  const agentId = tierInfo.agent;
  const taskStart = Date.now();

  try {
    // Assign
    await assignTask(taskId, agentId);
    console.log(`${logPrefix} ${tierInfo.icon} Assigned: ${task.title.substring(0, 30)}...`);

    // Execute (starts async execution)
    const execResponse = await executeTask(
      taskId, agentId, task.description, task.expectedOutput, task.tier
    );

    if (!execResponse.ok) {
      throw new Error('Execution start failed');
    }

    // Wait for task to actually complete
    const completedTask = await waitForTaskCompletion(taskId);

    if (completedTask.status === 'failed' || completedTask.status === 'aborted') {
      throw new Error(`Task ${completedTask.status}`);
    }

    // Validate
    const elapsed = Math.floor((Date.now() - taskStart) / 1000);
    const passed = await runValidation(task.validation);

    console.log(`${logPrefix} ${passed ? '✅' : '❌'} ${tierInfo.icon} ${task.title.substring(0, 30)}... (${elapsed}s)`);

    return { tier: task.tier, passed, elapsed };
  } catch (e) {
    const elapsed = Math.floor((Date.now() - taskStart) / 1000);
    console.log(`${logPrefix} 💥 ${tierInfo.icon} ${task.title.substring(0, 30)}... ERROR: ${e.message.substring(0, 30)}`);

    // Try to reset agent on error
    await fetch(`${API_BASE}/agents/reset-all`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    }).catch(() => {});
    await sleep(2000);

    return { tier: task.tier, passed: false, elapsed };
  }
}

async function main() {
  const ollamaTasks = tasks.filter(t => t.tier === 'ollama');
  const claudeTasks = tasks.filter(t => t.tier === 'haiku');

  console.log('═'.repeat(70));
  console.log('🚀 PARALLEL TASK EXECUTION TEST');
  console.log('═'.repeat(70));
  console.log(`   📦 Ollama tasks: ${ollamaTasks.length} (simple, local GPU)`);
  console.log(`   🐰 Claude tasks: ${claudeTasks.length} (medium, cloud API)`);
  console.log('═'.repeat(70));
  console.log('');
  console.log('This test runs Ollama and Claude tasks in PARALLEL.');
  console.log('Ollama uses coder-01, Claude uses qa-01 - both run simultaneously!');
  console.log('');

  await resetSystem();

  // Create all tasks first
  console.log('📝 Creating tasks...');
  const createdTasks = [];
  for (const task of tasks) {
    const created = await createTask(task);
    createdTasks.push({ ...task, id: created.id });
    console.log(`   Created: ${task.title.substring(0, 40)}... (${task.tier})`);
  }
  console.log('');

  // Separate tasks by tier
  const ollamaCreated = createdTasks.filter(t => t.tier === 'ollama');
  const claudeCreated = createdTasks.filter(t => t.tier === 'haiku');

  const results = { ollama: { passed: 0, failed: 0 }, haiku: { passed: 0, failed: 0 } };
  const startTime = Date.now();

  console.log('⚡ Starting PARALLEL execution...');
  console.log('   Ollama tasks run on coder-01, Claude tasks run on qa-01');
  console.log('─'.repeat(70));

  // Run Ollama and Claude task queues in parallel
  // Each queue runs sequentially (one agent per type), but both queues run simultaneously
  const ollamaPromise = (async () => {
    for (let i = 0; i < ollamaCreated.length; i++) {
      const task = ollamaCreated[i];
      const result = await runTask(task, task.id, `[Ollama ${i+1}/${ollamaCreated.length}]`);
      if (result.passed) results.ollama.passed++;
      else results.ollama.failed++;
    }
  })();

  const claudePromise = (async () => {
    for (let i = 0; i < claudeCreated.length; i++) {
      const task = claudeCreated[i];
      const result = await runTask(task, task.id, `[Claude ${i+1}/${claudeCreated.length}]`);
      if (result.passed) results.haiku.passed++;
      else results.haiku.failed++;
    }
  })();

  // Wait for both queues to complete
  await Promise.all([ollamaPromise, claudePromise]);

  const duration = Math.floor((Date.now() - startTime) / 1000);
  const totalPassed = results.ollama.passed + results.haiku.passed;
  const totalTasks = createdTasks.length;

  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESULTS');
  console.log('═'.repeat(70));
  console.log(`   📦 Ollama: ${results.ollama.passed}/${ollamaTasks.length} passed`);
  console.log(`   🐰 Haiku:  ${results.haiku.passed}/${claudeTasks.length} passed`);
  console.log('─'.repeat(70));
  console.log(`   📈 Total:  ${totalPassed}/${totalTasks} passed (${Math.round(totalPassed/totalTasks*100)}%)`);
  console.log(`   ⏱️  Duration: ${duration}s (parallel)`);
  console.log('═'.repeat(70));

  // Estimate sequential time based on actual execution
  const avgOllamaTime = 15; // seconds per Ollama task
  const avgClaudeTime = 25; // seconds per Claude task
  const estimatedSequential = (ollamaTasks.length * avgOllamaTime) + (claudeTasks.length * avgClaudeTime);
  const improvement = Math.round((1 - duration / estimatedSequential) * 100);

  console.log('');
  console.log(`📉 Estimated sequential time: ~${estimatedSequential}s`);
  console.log(`📈 Parallel improvement: ~${improvement > 0 ? improvement : 0}% faster`);
  console.log('');

  if (totalPassed === totalTasks) {
    console.log('✅ All tasks passed! Parallel execution working correctly.');
  } else {
    console.log(`⚠️  ${totalTasks - totalPassed} task(s) failed.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
