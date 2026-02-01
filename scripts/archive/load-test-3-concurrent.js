/**
 * Load Test: 2 Concurrent Agents
 *
 * Tests parallel execution with resource pool constraints:
 * - 1 Ollama slot (simple tasks, local GPU)
 * - 1 Claude slot (moderate tasks, cloud API)
 *
 * This validates:
 * - Parallel task execution (Ollama + Claude simultaneously)
 * - Claude API rate limit handling
 * - MCP Gateway integration (if USE_MCP=true)
 * - Real-time progress monitoring
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test configuration
const TEST_CONFIG = {
  ollamaTasks: 2,      // Simple tasks for Ollama (1 concurrent)
  claudeTasks: 2,      // Moderate tasks for Claude (1 concurrent)
  totalWaves: 2,       // Run 2 waves of parallel execution (2 tasks per wave)
  pollInterval: 2000,  // Check status every 2 seconds
  maxWaitTime: 300000, // 5 minutes max per wave
};

// Performance metrics
const metrics = {
  startTime: null,
  endTime: null,
  tasksCreated: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  waveDurations: [],
  peakConcurrency: 0,
  resourcePoolStats: [],
};

// Task templates
const TASK_TEMPLATES = {
  ollama: [
    {
      title: 'Create greeting function',
      description: 'Create a Python file hello.py with a greet(name) function that returns "Hello, {name}!"',
      validation: 'python -c "from tasks.hello import greet; assert greet(\\"World\\") == \\"Hello, World!\\""'
    },
    {
      title: 'Create math utilities',
      description: 'Create a Python file math_utils.py with functions: square(x) returns x*x, cube(x) returns x*x*x',
      validation: 'python -c "from tasks.math_utils import square, cube; assert square(5) == 25 and cube(3) == 27"'
    },
    {
      title: 'Create string helpers',
      description: 'Create a Python file string_helpers.py with functions: reverse(s) returns reversed string, uppercase(s) returns s.upper()',
      validation: 'python -c "from tasks.string_helpers import reverse, uppercase; assert reverse(\\"abc\\") == \\"cba\\" and uppercase(\\"test\\") == \\"TEST\\""'
    },
  ],
  claude: [
    {
      title: 'Implement FizzBuzz',
      description: 'Create fizzbuzz.py with fizzbuzz(n) that returns FizzBuzz sequence up to n',
      validation: 'python -c "from tasks.fizzbuzz import fizzbuzz; result = fizzbuzz(15); assert \\"Fizz\\" in result and \\"Buzz\\" in result and \\"FizzBuzz\\" in result"'
    },
    {
      title: 'Create palindrome checker',
      description: 'Create palindrome.py with is_palindrome(s) that returns True if string is palindrome (case-insensitive)',
      validation: 'python -c "from tasks.palindrome import is_palindrome; assert is_palindrome(\\"racecar\\") == True and is_palindrome(\\"hello\\") == False"'
    },
    {
      title: 'Word frequency counter',
      description: 'Create word_counter.py with count_words(text) that returns dict of word frequencies',
      validation: 'python -c "from tasks.word_counter import count_words; result = count_words(\\"hello world hello\\"); assert result[\\"hello\\"] == 2"'
    },
    {
      title: 'Prime number checker',
      description: 'Create prime_checker.py with is_prime(n) that returns True if n is prime',
      validation: 'python -c "from tasks.prime_checker import is_prime; assert is_prime(17) == True and is_prime(18) == False"'
    },
    {
      title: 'List deduplication',
      description: 'Create list_utils.py with deduplicate(lst) that removes duplicates while preserving order',
      validation: 'python -c "from tasks.list_utils import deduplicate; assert deduplicate([1,2,2,3,1]) == [1,2,3]"'
    },
    {
      title: 'Temperature converter',
      description: 'Create temp_converter.py with celsius_to_fahrenheit(c) and fahrenheit_to_celsius(f)',
      validation: 'python -c "from tasks.temp_converter import celsius_to_fahrenheit, fahrenheit_to_celsius; assert celsius_to_fahrenheit(0) == 32 and fahrenheit_to_celsius(32) == 0"'
    },
  ]
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('\n' + '='.repeat(70));
  log(message, 'bright');
  console.log('='.repeat(70));
}

function logSection(message) {
  console.log('\n' + '-'.repeat(70));
  log(message, 'cyan');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test task
 */
async function createTask(template, tier) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: template.title,
      description: template.description,
      taskType: 'code',
      priority: 1,
      maxIterations: 5,
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.statusText}`);
  }

  const task = await response.json();
  metrics.tasksCreated++;
  log(`  ✓ Created task ${task.id.substring(0, 8)}: ${template.title}`, 'dim');
  return task;
}

/**
 * Get resource pool status
 */
async function getResourceStatus() {
  const response = await fetch(`${API_BASE}/queue/resources`);
  if (!response.ok) {
    throw new Error(`Failed to get resource status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Assign task to agent
 */
async function assignTask(taskId, agentId) {
  const response = await fetch(`${API_BASE}/queue/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, agentId })
  });
  return response.json();
}

/**
 * Execute a task on an agent (via agents service)
 */
async function executeTask(taskId, agentId, description, expectedOutput, tier) {
  const useClaude = tier !== 'ollama';
  const model = tier === 'claude' ? 'claude-haiku-4-5-20251001' : null;

  const response = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: agentId,
      task_description: description,
      expected_output: expectedOutput,
      use_claude: useClaude,
      model: model
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to execute task: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Complete a task
 */
async function completeTask(taskId, result) {
  const response = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: result.success, result })
  });

  if (!response.ok) {
    throw new Error(`Failed to complete task: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get task status
 */
async function getTaskStatus(taskId) {
  const response = await fetch(`${API_BASE}/tasks/${taskId}`);
  if (!response.ok) {
    throw new Error(`Failed to get task status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Monitor wave progress
 */
async function monitorWave(taskIds, waveNumber) {
  const startTime = Date.now();
  const completed = new Set();
  const failed = new Set();

  log(`\n📊 Monitoring Wave ${waveNumber} (${taskIds.length} tasks)...`, 'cyan');

  while (completed.size + failed.size < taskIds.length) {
    const elapsed = Date.now() - startTime;

    if (elapsed > TEST_CONFIG.maxWaitTime) {
      log(`\n⏱️  Wave ${waveNumber} timeout after ${Math.round(elapsed / 1000)}s`, 'red');
      break;
    }

    // Check task statuses
    const statuses = await Promise.all(
      taskIds.map(id => getTaskStatus(id).catch(() => null))
    );

    // Get resource pool status
    const resources = await getResourceStatus();
    const activeTasks = resources.summary.ollama.activeSlots + resources.summary.claude.activeSlots;

    if (activeTasks > metrics.peakConcurrency) {
      metrics.peakConcurrency = activeTasks;
    }

    // Update completed/failed sets
    statuses.forEach((task, index) => {
      if (!task) return;

      if (task.status === 'completed' && !completed.has(task.id)) {
        completed.add(task.id);
        metrics.tasksCompleted++;
        log(`  ✅ Task ${task.id.substring(0, 8)} completed: ${task.title}`, 'green');
      } else if (['failed', 'aborted'].includes(task.status) && !failed.has(task.id)) {
        failed.add(task.id);
        metrics.tasksFailed++;
        log(`  ❌ Task ${task.id.substring(0, 8)} failed: ${task.title}`, 'red');
      }
    });

    // Progress update
    const progress = completed.size + failed.size;
    const successRate = completed.size / progress * 100 || 0;

    process.stdout.write(`\r  Progress: ${progress}/${taskIds.length} | ` +
      `✅ ${completed.size} | ❌ ${failed.size} | ` +
      `Active: ${activeTasks}/2 | ` +
      `Time: ${Math.round(elapsed / 1000)}s | ` +
      `Success: ${successRate.toFixed(0)}%`);

    await sleep(TEST_CONFIG.pollInterval);
  }

  const duration = Date.now() - startTime;
  metrics.waveDurations.push(duration);

  console.log('\n');
  log(`✨ Wave ${waveNumber} complete in ${Math.round(duration / 1000)}s`, 'green');
  log(`   Success: ${completed.size}/${taskIds.length} (${(completed.size / taskIds.length * 100).toFixed(1)}%)`, 'green');

  return { completed: completed.size, failed: failed.size, duration };
}

/**
 * Run a wave of tasks
 */
async function runWave(waveNumber) {
  logSection(`Wave ${waveNumber}: Creating Tasks`);

  const tasks = [];

  // Create Ollama task (simple)
  const ollamaTemplate = TASK_TEMPLATES.ollama[(waveNumber - 1) % TASK_TEMPLATES.ollama.length];
  const ollamaTask = await createTask(ollamaTemplate, 'ollama');
  tasks.push({ task: ollamaTask, template: ollamaTemplate, tier: 'ollama', agentId: 'coder-01' });

  // Create ONE Claude task (moderate) - avoid rate limits
  const claudeTemplate = TASK_TEMPLATES.claude[(waveNumber - 1) % TASK_TEMPLATES.claude.length];
  const claudeTask = await createTask(claudeTemplate, 'claude');
  tasks.push({ task: claudeTask, template: claudeTemplate, tier: 'claude', agentId: 'qa-01' });

  logSection(`Wave ${waveNumber}: Parallel Assignment & Execution`);

  // Assign and execute all tasks in parallel
  const executions = tasks.map(async ({ task, template, tier, agentId }) => {
    try {
      // Assign task
      await assignTask(task.id, agentId);
      log(`  ✓ Assigned task ${task.id.substring(0, 8)} to ${agentId}`, 'dim');

      // Execute task (agents service handles it)
      const result = await executeTask(
        task.id,
        agentId,
        template.description,
        template.title,
        tier
      );

      // Mark task as complete
      await completeTask(task.id, result);

      return { taskId: task.id, success: result.success };
    } catch (error) {
      log(`  ❌ Task ${task.id.substring(0, 8)} error: ${error.message}`, 'red');
      try {
        await completeTask(task.id, { success: false, error: error.message });
      } catch (e) {
        // Ignore completion error
      }
      return { taskId: task.id, success: false };
    }
  });

  log(`\n🚀 Executing ${executions.length} tasks in parallel...`, 'cyan');

  // Monitor wave progress while tasks execute in background
  const taskIds = tasks.map(t => t.task.id);
  const monitorPromise = monitorWave(taskIds, waveNumber);

  // Wait for all executions to complete
  await Promise.all(executions);

  // Wait for monitoring to finish
  return await monitorPromise;
}

/**
 * Generate final report
 */
function generateReport() {
  logHeader('📊 LOAD TEST REPORT');

  const totalDuration = metrics.endTime - metrics.startTime;
  const successRate = (metrics.tasksCompleted / metrics.tasksCreated * 100) || 0;
  const avgWaveDuration = metrics.waveDurations.reduce((a, b) => a + b, 0) / metrics.waveDurations.length;

  console.log('');
  log(`Test Configuration:`, 'bright');
  log(`  Total Waves: ${TEST_CONFIG.totalWaves}`, 'dim');
  log(`  Tasks per Wave: 2 (1 Ollama + 1 Claude)`, 'dim');
  log(`  Max Concurrency: 2 agents`, 'dim');
  log(`  Poll Interval: ${TEST_CONFIG.pollInterval}ms`, 'dim');

  console.log('');
  log(`Performance Metrics:`, 'bright');
  log(`  Total Duration: ${Math.round(totalDuration / 1000)}s`, 'cyan');
  log(`  Avg Wave Duration: ${Math.round(avgWaveDuration / 1000)}s`, 'cyan');
  log(`  Peak Concurrency: ${metrics.peakConcurrency} agents`, 'cyan');
  log(`  Tasks Created: ${metrics.tasksCreated}`, 'cyan');
  log(`  Tasks Completed: ${metrics.tasksCompleted}`, 'green');
  log(`  Tasks Failed: ${metrics.tasksFailed}`, metrics.tasksFailed > 0 ? 'red' : 'dim');
  log(`  Success Rate: ${successRate.toFixed(1)}%`, successRate >= 80 ? 'green' : 'yellow');

  console.log('');
  log(`Wave Breakdown:`, 'bright');
  metrics.waveDurations.forEach((duration, index) => {
    log(`  Wave ${index + 1}: ${Math.round(duration / 1000)}s`, 'dim');
  });

  console.log('');
  log(`Resource Pool Efficiency:`, 'bright');
  const efficiency = (metrics.peakConcurrency / 3 * 100);
  log(`  Utilization: ${efficiency.toFixed(1)}% (${metrics.peakConcurrency}/3 slots used)`,
    efficiency >= 90 ? 'green' : efficiency >= 60 ? 'yellow' : 'red');

  console.log('');
  if (successRate >= 80 && metrics.tasksFailed === 0) {
    log(`✅ LOAD TEST PASSED`, 'green');
  } else if (successRate >= 60) {
    log(`⚠️  LOAD TEST PASSED WITH WARNINGS`, 'yellow');
  } else {
    log(`❌ LOAD TEST FAILED`, 'red');
  }

  console.log('');
}

/**
 * Main test execution
 */
async function main() {
  logHeader('🚀 LOAD TEST: 2 CONCURRENT AGENTS');

  log(`Starting ${TEST_CONFIG.totalWaves} waves with 2 tasks each...`, 'cyan');
  log(`Resource Pool: 1 Ollama + 1 Claude = 2 concurrent max`, 'dim');

  metrics.startTime = Date.now();

  try {
    // Check initial resource status
    logSection('Initial Resource Pool Status');
    const initialResources = await getResourceStatus();
    const ollamaAvailable = initialResources.summary.ollama.maxSlots - initialResources.summary.ollama.activeSlots;
    const claudeAvailable = initialResources.summary.claude.maxSlots - initialResources.summary.claude.activeSlots;
    log(`  Ollama: ${ollamaAvailable}/${initialResources.summary.ollama.maxSlots} available`, 'dim');
    log(`  Claude: ${claudeAvailable}/${initialResources.summary.claude.maxSlots} available`, 'dim');

    // Run waves
    for (let wave = 1; wave <= TEST_CONFIG.totalWaves; wave++) {
      await runWave(wave);

      // Brief pause between waves
      if (wave < TEST_CONFIG.totalWaves) {
        log(`\n⏸️  Pausing 3s before next wave...`, 'dim');
        await sleep(3000);
      }
    }

    metrics.endTime = Date.now();

    // Generate report
    generateReport();

  } catch (error) {
    log(`\n❌ Load test error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
main();
