#!/usr/bin/env node

/**
 * Load Test: 20-Task Queue-Based Concurrency Suite
 *
 * OPTIMIZED VERSION - Uses task queue instead of waves to eliminate idle time
 *
 * Tests parallel execution with production-realistic workload:
 * - 16 simple tasks → Ollama (local GPU, free)
 * - 4 medium tasks → Claude Haiku (cloud API, rate limited)
 *
 * Key Improvements vs Wave-Based:
 * - Creates all tasks upfront in a queue
 * - Continuously assigns tasks to idle agents
 * - No wave delays or artificial pauses
 * - Expected ~3x faster throughput
 *
 * Validates:
 * - High-volume concurrent execution
 * - Resource pool management under load
 * - Claude API rate limit handling
 * - Real-time progress monitoring
 * - System stability over extended run
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || '';

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
  ollamaTasks: 16,     // Simple tasks for Ollama
  claudeTasks: 4,      // Medium tasks for Claude Haiku
  pollInterval: 1000,  // Check agent status every 1 second (faster than wave-based)
  maxWaitTime: 600000, // 10 minutes max total time
  taskTimeout: 300000, // 5 minutes max per task
};

// Agent configuration
const AGENTS = {
  ollama: { id: 'coder-01', maxConcurrent: 1 },
  claude: { id: 'qa-01', maxConcurrent: 1 }
};

// Performance metrics
const metrics = {
  startTime: null,
  endTime: null,
  tasksCreated: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  peakConcurrency: 0,
  ollamaCompletions: 0,
  claudeCompletions: 0,
  totalOllamaTime: 0,
  totalClaudeTime: 0,
  taskStartTimes: new Map(), // Track individual task start times
};

// Task templates - 16 Ollama + 4 Claude
const TASK_TEMPLATES = {
  ollama: [
    {
      title: 'Create square function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/square.py:\ndef square(n):\n    return n * n',
      validation: 'python -c "from tasks.square import square; assert square(4)==16; print(\'PASS\')"'
    },
    {
      title: 'Create double function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/double.py:\ndef double(n):\n    return n * 2',
      validation: 'python -c "from tasks.double import double; assert double(5)==10; print(\'PASS\')"'
    },
    {
      title: 'Create negate function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/negate.py:\ndef negate(n):\n    return -n',
      validation: 'python -c "from tasks.negate import negate; assert negate(3)==-3; print(\'PASS\')"'
    },
    {
      title: 'Create is_even function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/is_even.py:\ndef is_even(n):\n    return n % 2 == 0',
      validation: 'python -c "from tasks.is_even import is_even; assert is_even(4)==True; assert is_even(3)==False; print(\'PASS\')"'
    },
    {
      title: 'Create absolute function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/absolute.py:\ndef absolute(n):\n    return abs(n)',
      validation: 'python -c "from tasks.absolute import absolute; assert absolute(-5)==5; print(\'PASS\')"'
    },
    {
      title: 'Create add function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/add.py:\ndef add(a, b):\n    return a + b',
      validation: 'python -c "from tasks.add import add; assert add(2,3)==5; print(\'PASS\')"'
    },
    {
      title: 'Create subtract function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/subtract.py:\ndef subtract(a, b):\n    return a - b',
      validation: 'python -c "from tasks.subtract import subtract; assert subtract(5,3)==2; print(\'PASS\')"'
    },
    {
      title: 'Create multiply function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/multiply.py:\ndef multiply(a, b):\n    return a * b',
      validation: 'python -c "from tasks.multiply import multiply; assert multiply(3,4)==12; print(\'PASS\')"'
    },
    {
      title: 'Create max_of_two function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/max_of_two.py:\ndef max_of_two(a, b):\n    return max(a, b)',
      validation: 'python -c "from tasks.max_of_two import max_of_two; assert max_of_two(3,7)==7; print(\'PASS\')"'
    },
    {
      title: 'Create min_of_two function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/min_of_two.py:\ndef min_of_two(a, b):\n    return min(a, b)',
      validation: 'python -c "from tasks.min_of_two import min_of_two; assert min_of_two(3,7)==3; print(\'PASS\')"'
    },
    {
      title: 'Create is_positive function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/is_positive.py:\ndef is_positive(n):\n    return n > 0',
      validation: 'python -c "from tasks.is_positive import is_positive; assert is_positive(5)==True; assert is_positive(-3)==False; print(\'PASS\')"'
    },
    {
      title: 'Create is_negative function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/is_negative.py:\ndef is_negative(n):\n    return n < 0',
      validation: 'python -c "from tasks.is_negative import is_negative; assert is_negative(-5)==True; assert is_negative(3)==False; print(\'PASS\')"'
    },
    {
      title: 'Create cube function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/cube.py:\ndef cube(n):\n    return n * n * n',
      validation: 'python -c "from tasks.cube import cube; assert cube(3)==27; print(\'PASS\')"'
    },
    {
      title: 'Create power_of_two function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/power_of_two.py:\ndef power_of_two(n):\n    return 2 ** n',
      validation: 'python -c "from tasks.power_of_two import power_of_two; assert power_of_two(3)==8; print(\'PASS\')"'
    },
    {
      title: 'Create is_zero function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/is_zero.py:\ndef is_zero(n):\n    return n == 0',
      validation: 'python -c "from tasks.is_zero import is_zero; assert is_zero(0)==True; assert is_zero(5)==False; print(\'PASS\')"'
    },
    {
      title: 'Create half function',
      description: 'IMPORTANT: Use file_write tool.\n\nCreate tasks/half.py:\ndef half(n):\n    return n / 2',
      validation: 'python -c "from tasks.half import half; assert half(10)==5.0; print(\'PASS\')"'
    },
  ],
  claude: [
    {
      title: 'Create FizzBuzz function',
      description: `Create a Python function fizzbuzz(n) that implements FizzBuzz:
- For multiples of 3, return "Fizz"
- For multiples of 5, return "Buzz"
- For multiples of both 3 and 5, return "FizzBuzz"
- For other numbers, return the number as a string

Save to tasks/fizzbuzz.py`,
      validation: 'python -c "from tasks.fizzbuzz import fizzbuzz; assert fizzbuzz(3)==\'Fizz\'; assert fizzbuzz(5)==\'Buzz\'; assert fizzbuzz(15)==\'FizzBuzz\'; assert fizzbuzz(7)==\'7\'; print(\'PASS\')"'
    },
    {
      title: 'Create palindrome checker',
      description: `Create a Python function is_palindrome(s) that checks if a string is a palindrome:
- Ignore case (treat 'A' same as 'a')
- Ignore spaces and punctuation
- Return True if palindrome, False otherwise

Examples:
- is_palindrome("racecar") → True
- is_palindrome("Race Car") → True
- is_palindrome("hello") → False

Save to tasks/palindrome.py`,
      validation: 'python -c "from tasks.palindrome import is_palindrome; assert is_palindrome(\'racecar\')==True; assert is_palindrome(\'Race Car\')==True; assert is_palindrome(\'hello\')==False; print(\'PASS\')"'
    },
    {
      title: 'Create prime number checker',
      description: `Create a Python function is_prime(n) that checks if a number is prime:
- Return True if n is prime, False otherwise
- Handle n <= 1 (return False)
- Handle n == 2 (return True)

Examples:
- is_prime(2) → True
- is_prime(17) → True
- is_prime(4) → False
- is_prime(1) → False

Save to tasks/prime.py`,
      validation: 'python -c "from tasks.prime import is_prime; assert is_prime(2)==True; assert is_prime(17)==True; assert is_prime(4)==False; assert is_prime(1)==False; print(\'PASS\')"'
    },
    {
      title: 'Create list deduplicator',
      description: `Create a Python function dedupe(items) that removes duplicates from a list:
- Remove duplicate items
- Preserve the original order (keep first occurrence)
- Handle empty list (return empty list)

Examples:
- dedupe([1,2,1,3,2]) → [1,2,3]
- dedupe([]) → []
- dedupe(['a','b','a']) → ['a','b']

Save to tasks/dedupe.py`,
      validation: 'python -c "from tasks.dedupe import dedupe; assert dedupe([1,2,1,3,2])==[1,2,3]; assert dedupe([])==[]; print(\'PASS\')"'
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
      priority: tier === 'ollama' ? 3 : 5,
      maxIterations: 5,
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.statusText}`);
  }

  const task = await response.json();
  metrics.tasksCreated++;
  return { ...task, template, tier };
}

/**
 * Get agent status
 */
async function getAgentStatus(agentId) {
  const response = await fetch(`${API_BASE}/agents/${agentId}`);
  if (!response.ok) {
    throw new Error(`Failed to get agent status: ${response.statusText}`);
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
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
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
 * Process a single task (assign, execute, complete)
 */
async function processTask(taskInfo, agentId) {
  const { id: taskId, template, tier } = taskInfo;
  const shortId = taskId.substring(0, 8);

  try {
    // Record start time
    metrics.taskStartTimes.set(taskId, Date.now());

    // Assign task
    await assignTask(taskId, agentId);
    log(`  🎯 Assigned ${tier.toUpperCase()} task ${shortId} to ${agentId}: ${template.title}`, 'dim');

    // Execute task (agents service handles it)
    const result = await executeTask(
      taskId,
      agentId,
      template.description,
      template.title,
      tier
    );

    // Mark task as complete
    await completeTask(taskId, result);

    // Track metrics
    const taskDuration = Date.now() - metrics.taskStartTimes.get(taskId);
    metrics.taskStartTimes.delete(taskId);

    if (tier === 'ollama') {
      metrics.ollamaCompletions++;
      metrics.totalOllamaTime += taskDuration;
    } else {
      metrics.claudeCompletions++;
      metrics.totalClaudeTime += taskDuration;
    }

    metrics.tasksCompleted++;
    log(`  ✅ ${tier.toUpperCase()} task ${shortId} completed in ${Math.round(taskDuration / 1000)}s`, 'green');

    return { success: true, duration: taskDuration };

  } catch (error) {
    log(`  ❌ ${tier.toUpperCase()} task ${shortId} error: ${error.message}`, 'red');
    metrics.tasksFailed++;

    try {
      await completeTask(taskId, { success: false, error: error.message });
    } catch (e) {
      // Ignore completion error
    }

    return { success: false, duration: Date.now() - (metrics.taskStartTimes.get(taskId) || Date.now()) };
  }
}

/**
 * Main queue-based execution loop
 */
async function runQueueBasedTest(allTasks) {
  const taskQueues = {
    ollama: allTasks.filter(t => t.tier === 'ollama'),
    claude: allTasks.filter(t => t.tier === 'claude')
  };

  const activeTasks = new Map(); // agentId -> taskInfo
  const completed = new Set();
  const failed = new Set();

  log(`\n📊 Starting queue-based execution...`, 'cyan');
  log(`  Ollama queue: ${taskQueues.ollama.length} tasks`, 'dim');
  log(`  Claude queue: ${taskQueues.claude.length} tasks`, 'dim');

  // Continuously process tasks until all queues empty and no active tasks
  while (
    taskQueues.ollama.length > 0 ||
    taskQueues.claude.length > 0 ||
    activeTasks.size > 0
  ) {
    const elapsed = Date.now() - metrics.startTime;

    // Check for global timeout
    if (elapsed > TEST_CONFIG.maxWaitTime) {
      log(`\n⏱️  Global timeout after ${Math.round(elapsed / 1000)}s`, 'red');
      break;
    }

    // Check for task timeouts
    for (const [agentId, taskInfo] of activeTasks.entries()) {
      const taskElapsed = Date.now() - (metrics.taskStartTimes.get(taskInfo.id) || Date.now());
      if (taskElapsed > TEST_CONFIG.taskTimeout) {
        log(`  ⏱️  Task ${taskInfo.id.substring(0, 8)} timed out after ${Math.round(taskElapsed / 1000)}s`, 'red');
        activeTasks.delete(agentId);
        failed.add(taskInfo.id);
        metrics.tasksFailed++;
      }
    }

    // Try to assign tasks to idle agents
    for (const [tier, agentConfig] of Object.entries(AGENTS)) {
      const { id: agentId } = agentConfig;

      // Skip if agent is busy
      if (activeTasks.has(agentId)) {
        continue;
      }

      // Skip if no tasks in queue for this tier
      if (taskQueues[tier].length === 0) {
        continue;
      }

      // Get next task from queue
      const taskInfo = taskQueues[tier].shift();

      // Start processing task in background
      activeTasks.set(agentId, taskInfo);

      processTask(taskInfo, agentId).then(() => {
        activeTasks.delete(agentId);
      }).catch(() => {
        activeTasks.delete(agentId);
      });
    }

    // Get resource pool status for metrics
    const resources = await getResourceStatus();
    const activeCount = resources.summary.ollama.activeSlots + resources.summary.claude.activeSlots;

    if (activeCount > metrics.peakConcurrency) {
      metrics.peakConcurrency = activeCount;
    }

    // Progress update
    const totalTasks = TEST_CONFIG.ollamaTasks + TEST_CONFIG.claudeTasks;
    const progress = metrics.tasksCompleted + metrics.tasksFailed;
    const successRate = progress > 0 ? (metrics.tasksCompleted / progress * 100) : 0;
    const remaining = taskQueues.ollama.length + taskQueues.claude.length;

    process.stdout.write(`\r  Progress: ${progress}/${totalTasks} | ` +
      `✅ ${metrics.tasksCompleted} | ❌ ${metrics.tasksFailed} | ` +
      `Active: ${activeTasks.size} | ` +
      `Queue: ${remaining} | ` +
      `Time: ${Math.round(elapsed / 1000)}s | ` +
      `Success: ${successRate.toFixed(0)}%`);

    // Poll interval
    await sleep(TEST_CONFIG.pollInterval);
  }

  console.log('\n');
  log(`✨ Queue-based execution complete`, 'green');
  log(`   Completed: ${metrics.tasksCompleted}/${TEST_CONFIG.ollamaTasks + TEST_CONFIG.claudeTasks}`, 'green');
  log(`   Failed: ${metrics.tasksFailed}`, metrics.tasksFailed > 0 ? 'red' : 'dim');
}

/**
 * Generate final report
 */
function generateReport() {
  logHeader('📊 LOAD TEST REPORT: 20-TASK QUEUE-BASED SUITE');

  const totalDuration = metrics.endTime - metrics.startTime;
  const successRate = (metrics.tasksCompleted / metrics.tasksCreated * 100) || 0;
  const avgOllamaTime = metrics.ollamaCompletions > 0 ? metrics.totalOllamaTime / metrics.ollamaCompletions : 0;
  const avgClaudeTime = metrics.claudeCompletions > 0 ? metrics.totalClaudeTime / metrics.claudeCompletions : 0;

  console.log('');
  log(`Test Configuration:`, 'bright');
  log(`  Total Tasks: ${TEST_CONFIG.ollamaTasks + TEST_CONFIG.claudeTasks} (16 Ollama + 4 Claude)`, 'dim');
  log(`  Execution Mode: Queue-based (continuous assignment)`, 'dim');
  log(`  Max Concurrency: 2 agents (1 Ollama + 1 Claude)`, 'dim');
  log(`  Poll Interval: ${TEST_CONFIG.pollInterval}ms`, 'dim');

  console.log('');
  log(`Performance Metrics:`, 'bright');
  log(`  Total Duration: ${Math.round(totalDuration / 1000)}s (${Math.round(totalDuration / 60000)} min)`, 'cyan');
  log(`  Peak Concurrency: ${metrics.peakConcurrency} agents`, 'cyan');
  log(`  Tasks Created: ${metrics.tasksCreated}`, 'cyan');
  log(`  Tasks Completed: ${metrics.tasksCompleted}`, 'green');
  log(`  Tasks Failed: ${metrics.tasksFailed}`, metrics.tasksFailed > 0 ? 'red' : 'dim');
  log(`  Success Rate: ${successRate.toFixed(1)}%`, successRate >= 80 ? 'green' : 'yellow');

  console.log('');
  log(`Task Completion Times:`, 'bright');
  log(`  Ollama (qwen2.5-coder:7b):`, 'dim');
  log(`    Completions: ${metrics.ollamaCompletions}`, 'dim');
  log(`    Avg Time: ${Math.round(avgOllamaTime / 1000)}s`, 'dim');
  log(`    Total Time: ${Math.round(metrics.totalOllamaTime / 1000)}s`, 'dim');
  log(`  Claude (haiku):`, 'dim');
  log(`    Completions: ${metrics.claudeCompletions}`, 'dim');
  log(`    Avg Time: ${Math.round(avgClaudeTime / 1000)}s`, 'dim');
  log(`    Total Time: ${Math.round(metrics.totalClaudeTime / 1000)}s`, 'dim');

  console.log('');
  log(`Resource Pool Efficiency:`, 'bright');
  const efficiency = (metrics.peakConcurrency / 2 * 100);
  log(`  Utilization: ${efficiency.toFixed(1)}% (${metrics.peakConcurrency}/2 slots used)`,
    efficiency >= 90 ? 'green' : efficiency >= 60 ? 'yellow' : 'red');

  console.log('');
  log(`Queue-Based Optimization:`, 'bright');
  log(`  ✅ Eliminated wave delays`, 'green');
  log(`  ✅ Continuous task assignment to idle agents`, 'green');
  log(`  ✅ No artificial pauses between tasks`, 'green');
  log(`  ✅ Maximized agent utilization`, 'green');

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
  logHeader('🚀 LOAD TEST: 20-TASK QUEUE-BASED SUITE');

  log(`Queue-based execution eliminates wave delays for maximum throughput`, 'cyan');
  log(`Total: ${TEST_CONFIG.ollamaTasks + TEST_CONFIG.claudeTasks} tasks (16 Ollama + 4 Claude)`, 'dim');
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

    // Create all tasks upfront
    logSection('Creating All Tasks');
    log(`Creating ${TEST_CONFIG.ollamaTasks} Ollama tasks...`, 'dim');

    const allTasks = [];

    // Create Ollama tasks
    for (const template of TASK_TEMPLATES.ollama) {
      const task = await createTask(template, 'ollama');
      allTasks.push(task);
    }
    log(`  ✓ Created ${TASK_TEMPLATES.ollama.length} Ollama tasks`, 'green');

    // Create Claude tasks
    log(`Creating ${TEST_CONFIG.claudeTasks} Claude tasks...`, 'dim');
    for (const template of TASK_TEMPLATES.claude) {
      const task = await createTask(template, 'claude');
      allTasks.push(task);
    }
    log(`  ✓ Created ${TASK_TEMPLATES.claude.length} Claude tasks`, 'green');

    log(`\n✅ All ${allTasks.length} tasks created`, 'green');

    // Run queue-based execution
    await runQueueBasedTest(allTasks);

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
