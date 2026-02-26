#!/usr/bin/env node

/**
 * Ollama Quick Test - 5 tasks for fast UI verification
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';
const REST_DELAY_MS = 3000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TASKS = [
  {
    complexity: 1,
    name: "double",
    description: "Create tasks/c1_double.py with: def double(n): return n * 2",
    code: "def double(n):\n    return n * 2",
    validation: "from tasks.c1_double import double; assert double(5)==10; print('PASS')"
  },
  {
    complexity: 3,
    name: "absolute",
    description: "Create tasks/c3_absolute.py with function absolute(n) that returns the absolute value without using abs()",
    code: "def absolute(n):\n    if n < 0:\n        return -n\n    return n",
    validation: "from tasks.c3_absolute import absolute; assert absolute(-5)==5; assert absolute(3)==3; print('PASS')"
  },
  {
    complexity: 5,
    name: "fizzbuzz_single",
    description: "Create tasks/c5_fizzbuzz.py with function fizzbuzz(n) that returns 'Fizz' if n divisible by 3, 'Buzz' if by 5, 'FizzBuzz' if both, else str(n)",
    code: "def fizzbuzz(n):\n    if n % 15 == 0:\n        return 'FizzBuzz'\n    if n % 3 == 0:\n        return 'Fizz'\n    if n % 5 == 0:\n        return 'Buzz'\n    return str(n)",
    validation: "from tasks.c5_fizzbuzz import fizzbuzz; assert fizzbuzz(15)=='FizzBuzz'; assert fizzbuzz(9)=='Fizz'; assert fizzbuzz(10)=='Buzz'; assert fizzbuzz(7)=='7'; print('PASS')"
  },
  {
    complexity: 6,
    name: "is_prime",
    description: "Create tasks/c6_is_prime.py with function is_prime(n) that returns True if n is a prime number",
    code: "def is_prime(n):\n    if n < 2:\n        return False\n    if n == 2:\n        return True\n    if n % 2 == 0:\n        return False\n    for i in range(3, int(n**0.5) + 1, 2):\n        if n % i == 0:\n            return False\n    return True",
    validation: "from tasks.c6_is_prime import is_prime; assert is_prime(17)==True; assert is_prime(4)==False; assert is_prime(2)==True; assert is_prime(1)==False; print('PASS')"
  },
  {
    complexity: 8,
    name: "binary_search",
    description: "Create tasks/c8_binary_search.py with function binary_search(arr, target) that returns index of target in sorted array, or -1 if not found",
    code: "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
    validation: "from tasks.c8_binary_search import binary_search; assert binary_search([1,2,3,4,5],3)==2; assert binary_search([1,2,3,4,5],6)==-1; print('PASS')"
  }
];

async function resetSystem() {
  console.log('🔄 Resetting system...');
  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    console.log('   ✓ Agents reset');
  } catch (e) {
    console.log('   ⚠ Could not reset agents');
  }
  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/c*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
    console.log('   ✓ Workspace cleaned');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace');
  }
  await sleep(2000);
}

async function createTask(task) {
  const fileName = `c${task.complexity}_${task.name}`;
  const fullDescription = `IMPORTANT: You MUST use the file_write tool to create the file.

Step 1: Use file_write to create tasks/${fileName}.py with this content:
${task.code}

Step 2: Verify the file was created.

DO NOT just output the code - you MUST call file_write(path="tasks/${fileName}.py", content="...")`;

  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      title: `[QUICK-C${task.complexity}] ${task.name}`,
      description: fullDescription,
      expectedOutput: `File tasks/${fileName}.py created with ${task.name} function`,
      taskType: 'code',
      priority: task.complexity <= 4 ? 3 : task.complexity,
      maxIterations: 5,
      validationCommand: task.validation
    })
  });
  if (!response.ok) throw new Error(`Failed to create task: ${response.status}`);
  return response.json();
}

async function executeTask(taskId, description) {
  return fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, agent_id: 'coder-01', task_description: description, use_claude: false, model: null })
  });
}

async function waitForAgent(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const r = await fetch(`${API_BASE}/agents/coder-01`, { headers: { 'X-API-Key': API_KEY } });
      const agent = await r.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(1000);
  }
  return false;
}

async function runValidation(validation) {
  try {
    const { execSync } = require('child_process');
    const result = execSync(`docker exec -w /app/workspace abcc-agents python -c "${validation}"`, { encoding: 'utf8', timeout: 10000 });
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('═'.repeat(50));
  console.log('⚡ OLLAMA QUICK TEST - 5 TASKS');
  console.log('═'.repeat(50) + '\n');

  await resetSystem();

  let passed = 0;
  const startTime = Date.now();

  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    console.log(`\n[${i + 1}/5] C${task.complexity} ${task.name}`);
    console.log('─'.repeat(40));

    const taskStart = Date.now();
    try {
      const created = await createTask(task);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      console.log('   Executing...');
      const execResponse = await executeTask(created.id, task.description);
      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (!execResponse.ok) throw new Error(`Exec failed: ${(await execResponse.text()).substring(0, 100)}`);

      const execJson = await execResponse.json();
      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ success: Boolean(execJson.success) })
      });

      console.log('   Validating...');
      if (await runValidation(task.validation)) {
        passed++;
        console.log(`   ✅ PASSED (${duration}s)`);
      } else {
        console.log(`   ❌ FAILED (${duration}s)`);
      }

      await waitForAgent();
    } catch (e) {
      console.log(`   💥 ERROR: ${e.message.substring(0, 60)}`);
      await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } }).catch(() => {});
      await sleep(2000);
    }

    if (i < TASKS.length - 1) {
      console.log(`   💤 Resting ${REST_DELAY_MS/1000}s...`);
      await sleep(REST_DELAY_MS);
    }
  }

  const totalDuration = Math.floor((Date.now() - startTime) / 1000);
  console.log('\n' + '═'.repeat(50));
  console.log(`📊 RESULT: ${passed}/5 passed (${Math.round(passed/5*100)}%) in ${Math.floor(totalDuration/60)}m ${totalDuration%60}s`);
  console.log('═'.repeat(50));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
