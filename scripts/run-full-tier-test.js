#!/usr/bin/env node

/**
 * Full Tier Parallel Test
 *
 * Comprehensive test of all tiers running in parallel:
 * - 15 Ollama tasks (complexity 1-6) - coder-01
 * - 3 Haiku tasks (complexity 7-8) - qa-01
 * - 2 Sonnet tasks (complexity 9) - qa-01 (after Haiku done)
 *
 * Ollama tasks run on coder-01, Claude tasks run on qa-01
 * Both agent queues run simultaneously for parallel execution
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// OLLAMA TASKS (15 tasks, complexity 1-6)
// ═══════════════════════════════════════════════════════════════════════════
const OLLAMA_TASKS = [
  // Complexity 1 (2 tasks)
  {
    complexity: 1, name: "double",
    description: "Create tasks/t1_double.py with: def double(n): return n * 2",
    validation: "from tasks.t1_double import double; assert double(5)==10; print('PASS')"
  },
  {
    complexity: 1, name: "negate",
    description: "Create tasks/t1_negate.py with: def negate(n): return -n",
    validation: "from tasks.t1_negate import negate; assert negate(5)==-5; print('PASS')"
  },
  // Complexity 2 (2 tasks)
  {
    complexity: 2, name: "greet",
    description: "Create tasks/t2_greet.py with: def greet(name): return f'Hello, {name}!'",
    validation: "from tasks.t2_greet import greet; assert greet('World')=='Hello, World!'; print('PASS')"
  },
  {
    complexity: 2, name: "is_positive",
    description: "Create tasks/t2_is_positive.py with: def is_positive(n): return n > 0",
    validation: "from tasks.t2_is_positive import is_positive; assert is_positive(5)==True; assert is_positive(-3)==False; print('PASS')"
  },
  // Complexity 3 (3 tasks)
  {
    complexity: 3, name: "absolute",
    description: "Create tasks/t3_absolute.py with function absolute(n) that returns absolute value without using abs()",
    validation: "from tasks.t3_absolute import absolute; assert absolute(-5)==5; assert absolute(3)==3; print('PASS')"
  },
  {
    complexity: 3, name: "max_of_two",
    description: "Create tasks/t3_max.py with function max_of_two(a, b) that returns the larger number",
    validation: "from tasks.t3_max import max_of_two; assert max_of_two(3,7)==7; assert max_of_two(10,2)==10; print('PASS')"
  },
  {
    complexity: 3, name: "is_even",
    description: "Create tasks/t3_is_even.py with: def is_even(n): return n % 2 == 0",
    validation: "from tasks.t3_is_even import is_even; assert is_even(4)==True; assert is_even(3)==False; print('PASS')"
  },
  // Complexity 4 (3 tasks)
  {
    complexity: 4, name: "clamp",
    description: "Create tasks/t4_clamp.py with function clamp(value, min_val, max_val) that restricts value to range",
    validation: "from tasks.t4_clamp import clamp; assert clamp(5,0,10)==5; assert clamp(-5,0,10)==0; assert clamp(15,0,10)==10; print('PASS')"
  },
  {
    complexity: 4, name: "count_vowels",
    description: "Create tasks/t4_vowels.py with function count_vowels(s) that counts vowels in a string",
    validation: "from tasks.t4_vowels import count_vowels; assert count_vowels('hello')==2; print('PASS')"
  },
  {
    complexity: 4, name: "factorial",
    description: "Create tasks/t4_factorial.py with function factorial(n) that returns n! using a loop",
    validation: "from tasks.t4_factorial import factorial; assert factorial(5)==120; assert factorial(0)==1; print('PASS')"
  },
  // Complexity 5 (3 tasks)
  {
    complexity: 5, name: "fizzbuzz",
    description: "Create tasks/t5_fizzbuzz.py with fizzbuzz(n): 'FizzBuzz' if div by 15, 'Fizz' if 3, 'Buzz' if 5, else str(n)",
    validation: "from tasks.t5_fizzbuzz import fizzbuzz; assert fizzbuzz(15)=='FizzBuzz'; assert fizzbuzz(9)=='Fizz'; assert fizzbuzz(10)=='Buzz'; print('PASS')"
  },
  {
    complexity: 5, name: "is_palindrome",
    description: "Create tasks/t5_palindrome.py with is_palindrome(s) checking if string reads same backwards (ignore case/spaces)",
    validation: "from tasks.t5_palindrome import is_palindrome; assert is_palindrome('racecar')==True; assert is_palindrome('hello')==False; print('PASS')"
  },
  {
    complexity: 5, name: "safe_divide",
    description: "Create tasks/t5_divide.py with safe_divide(a, b) returning a/b or None if b is 0",
    validation: "from tasks.t5_divide import safe_divide; assert safe_divide(10,2)==5; assert safe_divide(10,0) is None; print('PASS')"
  },
  // Complexity 6 (2 tasks)
  {
    complexity: 6, name: "sum_digits",
    description: "Create tasks/t6_sum_digits.py with sum_of_digits(n) returning sum of all digits (handle negative)",
    validation: "from tasks.t6_sum_digits import sum_of_digits; assert sum_of_digits(123)==6; assert sum_of_digits(-456)==15; print('PASS')"
  },
  {
    complexity: 6, name: "is_prime",
    description: "Create tasks/t6_is_prime.py with is_prime(n) checking if n is prime",
    validation: "from tasks.t6_is_prime import is_prime; assert is_prime(17)==True; assert is_prime(4)==False; assert is_prime(2)==True; print('PASS')"
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HAIKU TASKS (3 tasks, complexity 7-8)
// ═══════════════════════════════════════════════════════════════════════════
const HAIKU_TASKS = [
  {
    complexity: 7, name: "fibonacci",
    description: `Create tasks/t7_fibonacci.py with function fibonacci(n) that returns the nth Fibonacci number.
- fibonacci(0) = 0
- fibonacci(1) = 1
- fibonacci(n) = fibonacci(n-1) + fibonacci(n-2)
Use an iterative approach for efficiency.`,
    validation: "from tasks.t7_fibonacci import fibonacci; assert fibonacci(0)==0; assert fibonacci(1)==1; assert fibonacci(10)==55; print('PASS')"
  },
  {
    complexity: 7, name: "word_frequency",
    description: `Create tasks/t7_word_freq.py with function word_frequency(text) that returns a dict of word counts.
- Split text on whitespace
- Convert to lowercase
- Return dict like {'hello': 2, 'world': 1}`,
    validation: "from tasks.t7_word_freq import word_frequency; r=word_frequency('hello world hello'); assert r['hello']==2; assert r['world']==1; print('PASS')"
  },
  {
    complexity: 8, name: "merge_sorted",
    description: `Create tasks/t8_merge.py with function merge_sorted(list1, list2) that merges two sorted lists into one sorted list.
- Both input lists are already sorted in ascending order
- Return a new sorted list containing all elements
- Do NOT use sort() - merge manually`,
    validation: "from tasks.t8_merge import merge_sorted; assert merge_sorted([1,3,5],[2,4,6])==[1,2,3,4,5,6]; print('PASS')"
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SONNET TASKS (2 tasks, complexity 9)
// ═══════════════════════════════════════════════════════════════════════════
const SONNET_TASKS = [
  {
    complexity: 9, name: "lru_cache",
    description: `Create tasks/t9_lru.py with class LRUCache implementing a Least Recently Used cache:

class LRUCache:
    def __init__(self, capacity: int): # Initialize with max capacity
    def get(self, key: int) -> int: # Return value or -1 if not found, mark as recently used
    def put(self, key: int, value: int) -> None: # Add/update, evict oldest if at capacity

Requirements:
- O(1) time for both get and put
- Use OrderedDict or implement with dict + doubly linked list`,
    validation: "from tasks.t9_lru import LRUCache; c=LRUCache(2); c.put(1,1); c.put(2,2); assert c.get(1)==1; c.put(3,3); assert c.get(2)==-1; print('PASS')"
  },
  {
    complexity: 9, name: "binary_search_tree",
    description: `Create tasks/t9_bst.py with class BinarySearchTree implementing:

class BinarySearchTree:
    def insert(self, value: int) -> None: # Insert value maintaining BST property
    def search(self, value: int) -> bool: # Return True if value exists
    def inorder(self) -> list: # Return sorted list of all values

Requirements:
- Properly handle empty tree
- Maintain BST property (left < root < right)`,
    validation: "from tasks.t9_bst import BinarySearchTree; t=BinarySearchTree(); t.insert(5); t.insert(3); t.insert(7); assert t.search(3)==True; assert t.search(10)==False; assert t.inorder()==[3,5,7]; print('PASS')"
  },
];

// Model and agent configuration
const TIER_CONFIG = {
  ollama: { model: null, agent: 'coder-01', icon: '📦', name: 'Ollama' },
  haiku:  { model: 'claude-haiku-4-5-20251001', agent: 'qa-01', icon: '🐰', name: 'Haiku' },
  sonnet: { model: 'claude-sonnet-4-5-20250929', agent: 'qa-01', icon: '🎭', name: 'Sonnet' },
};

async function resetSystem() {
  console.log('🔄 Resetting system...');
  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await fetch(`${API_BASE}/queue/resources/clear`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await fetch(`${API_BASE}/agents/ollama-reset-counter`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    console.log('   ✓ Agents, resources, and Ollama counter reset');
  } catch (e) {
    console.log('   ⚠ Could not reset: ' + e.message);
  }

  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/t*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
    console.log('   ✓ Workspace cleaned');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace');
  }
  await sleep(2000);
}

async function createTask(task, tier) {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      title: `[TIER-${tier.toUpperCase()}] C${task.complexity}: ${task.name}`,
      description: task.description,
      taskType: 'code',
      priority: task.complexity,
      maxIterations: tier === 'ollama' ? 5 : 10
    })
  });
  return response.json();
}

async function assignTask(taskId, agentId) {
  const response = await fetch(`${API_BASE}/queue/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ taskId, agentId })
  });
  return response.json();
}

async function executeTask(taskId, agentId, description, tier) {
  const config = TIER_CONFIG[tier];
  return await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: agentId,
      task_description: description,
      expected_output: 'Task completed successfully',
      use_claude: tier !== 'ollama',
      model: config.model
    })
  });
}

async function completeTask(taskId, result) {
  await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ success: result.success, result })
  });
}

async function waitForAgent(agentId, maxWaitMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`, { headers: { 'X-API-Key': API_KEY } });
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(2000);
  }
  return false;
}

async function runValidation(validation) {
  try {
    const { execSync } = require('child_process');
    const b64Code = Buffer.from(validation).toString('base64');
    const cmd = `docker exec -e PYTHONPATH=/app/workspace abcc-agents python3 -c "import sys; sys.path.insert(0,'/app/workspace'); import base64; exec(base64.b64decode('${b64Code}').decode())"`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

async function runTask(task, taskId, tier, logPrefix) {
  const config = TIER_CONFIG[tier];
  const taskStart = Date.now();

  try {
    // Assign
    await assignTask(taskId, config.agent);

    // Execute
    const execResponse = await executeTask(taskId, config.agent, task.description, tier);
    if (!execResponse.ok) throw new Error('Execution failed');
    const execResult = await execResponse.json();

    // Complete
    await completeTask(taskId, execResult);

    // Wait for agent to be idle
    await waitForAgent(config.agent);

    // Validate
    const elapsed = Math.floor((Date.now() - taskStart) / 1000);
    const passed = await runValidation(task.validation);

    const status = passed ? '✅' : '❌';
    console.log(`${logPrefix} ${status} C${task.complexity} ${task.name} (${elapsed}s)`);

    return { passed, elapsed, complexity: task.complexity };
  } catch (e) {
    const elapsed = Math.floor((Date.now() - taskStart) / 1000);
    console.log(`${logPrefix} 💥 C${task.complexity} ${task.name} - ERROR: ${e.message.substring(0, 40)}`);

    // Reset agent on error
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } }).catch(() => {});
    await sleep(3000);

    return { passed: false, elapsed, complexity: task.complexity };
  }
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🔥 FULL TIER PARALLEL TEST');
  console.log('═'.repeat(70));
  console.log(`   📦 Ollama: ${OLLAMA_TASKS.length} tasks (C1-C6) on coder-01`);
  console.log(`   🐰 Haiku:  ${HAIKU_TASKS.length} tasks (C7-C8) on qa-01`);
  console.log(`   🎭 Sonnet: ${SONNET_TASKS.length} tasks (C9) on qa-01`);
  console.log('═'.repeat(70));
  console.log('');
  console.log('Ollama and Claude tasks run in PARALLEL on separate agents.');
  console.log('Haiku tasks run first, then Sonnet tasks on qa-01.');
  console.log('');

  await resetSystem();

  // Create all tasks
  console.log('📝 Creating tasks...');
  const ollamaCreated = [];
  const haikuCreated = [];
  const sonnetCreated = [];

  for (const task of OLLAMA_TASKS) {
    const created = await createTask(task, 'ollama');
    ollamaCreated.push({ ...task, id: created.id });
  }
  console.log(`   ✓ ${ollamaCreated.length} Ollama tasks created`);

  for (const task of HAIKU_TASKS) {
    const created = await createTask(task, 'haiku');
    haikuCreated.push({ ...task, id: created.id });
  }
  console.log(`   ✓ ${haikuCreated.length} Haiku tasks created`);

  for (const task of SONNET_TASKS) {
    const created = await createTask(task, 'sonnet');
    sonnetCreated.push({ ...task, id: created.id });
  }
  console.log(`   ✓ ${sonnetCreated.length} Sonnet tasks created`);
  console.log('');

  const results = {
    ollama: { passed: 0, failed: 0, times: [] },
    haiku: { passed: 0, failed: 0, times: [] },
    sonnet: { passed: 0, failed: 0, times: [] },
  };

  const startTime = Date.now();

  console.log('⚡ Starting PARALLEL execution...');
  console.log('─'.repeat(70));

  // Run Ollama queue on coder-01
  const ollamaPromise = (async () => {
    for (let i = 0; i < ollamaCreated.length; i++) {
      const task = ollamaCreated[i];
      const result = await runTask(task, task.id, 'ollama', `[📦 ${i+1}/${ollamaCreated.length}]`);
      if (result.passed) results.ollama.passed++;
      else results.ollama.failed++;
      results.ollama.times.push(result.elapsed);
    }
  })();

  // Run Claude queue on qa-01 (Haiku first, then Sonnet)
  const claudePromise = (async () => {
    // Haiku tasks
    for (let i = 0; i < haikuCreated.length; i++) {
      const task = haikuCreated[i];
      const result = await runTask(task, task.id, 'haiku', `[🐰 ${i+1}/${haikuCreated.length}]`);
      if (result.passed) results.haiku.passed++;
      else results.haiku.failed++;
      results.haiku.times.push(result.elapsed);
    }
    // Sonnet tasks
    for (let i = 0; i < sonnetCreated.length; i++) {
      const task = sonnetCreated[i];
      const result = await runTask(task, task.id, 'sonnet', `[🎭 ${i+1}/${sonnetCreated.length}]`);
      if (result.passed) results.sonnet.passed++;
      else results.sonnet.failed++;
      results.sonnet.times.push(result.elapsed);
    }
  })();

  // Wait for both queues
  await Promise.all([ollamaPromise, claudePromise]);

  const duration = Math.floor((Date.now() - startTime) / 1000);
  const totalPassed = results.ollama.passed + results.haiku.passed + results.sonnet.passed;
  const totalTasks = OLLAMA_TASKS.length + HAIKU_TASKS.length + SONNET_TASKS.length;

  // Calculate averages
  const avgOllama = results.ollama.times.length ? Math.round(results.ollama.times.reduce((a,b)=>a+b,0)/results.ollama.times.length) : 0;
  const avgHaiku = results.haiku.times.length ? Math.round(results.haiku.times.reduce((a,b)=>a+b,0)/results.haiku.times.length) : 0;
  const avgSonnet = results.sonnet.times.length ? Math.round(results.sonnet.times.reduce((a,b)=>a+b,0)/results.sonnet.times.length) : 0;

  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESULTS');
  console.log('═'.repeat(70));
  console.log(`   📦 Ollama: ${results.ollama.passed}/${OLLAMA_TASKS.length} passed (avg ${avgOllama}s/task)`);
  console.log(`   🐰 Haiku:  ${results.haiku.passed}/${HAIKU_TASKS.length} passed (avg ${avgHaiku}s/task)`);
  console.log(`   🎭 Sonnet: ${results.sonnet.passed}/${SONNET_TASKS.length} passed (avg ${avgSonnet}s/task)`);
  console.log('─'.repeat(70));
  console.log(`   📈 Total:  ${totalPassed}/${totalTasks} passed (${Math.round(totalPassed/totalTasks*100)}%)`);
  console.log(`   ⏱️  Duration: ${Math.floor(duration/60)}m ${duration%60}s (parallel)`);
  console.log('═'.repeat(70));

  // Check Ollama rest status
  try {
    const ollamaStatus = await fetch(`${API_BASE}/agents/ollama-status`, { headers: { 'X-API-Key': API_KEY } }).then(r => r.json());
    console.log('');
    console.log('🛏️ Ollama Rest Status:');
    console.log(`   Tasks completed: ${JSON.stringify(ollamaStatus.agentTaskCounts)}`);
    console.log(`   Config: ${ollamaStatus.config.restDelayMs}ms rest, ${ollamaStatus.config.extendedRestMs}ms extended every ${ollamaStatus.config.resetEveryNTasks} tasks`);
  } catch (e) {}

  console.log('');
  if (totalPassed === totalTasks) {
    console.log('✅ All tasks passed! Full tier system working correctly.');
  } else {
    console.log(`⚠️  ${totalTasks - totalPassed} task(s) failed.`);
  }

  // Save results
  const resultData = {
    timestamp: new Date().toISOString(),
    duration,
    results: {
      ollama: { ...results.ollama, total: OLLAMA_TASKS.length },
      haiku: { ...results.haiku, total: HAIKU_TASKS.length },
      sonnet: { ...results.sonnet, total: SONNET_TASKS.length },
    },
    totalPassed,
    totalTasks,
    successRate: Math.round(totalPassed/totalTasks*100),
  };

  const fs = require('fs');
  fs.writeFileSync('scripts/full-tier-results.json', JSON.stringify(resultData, null, 2));
  console.log('\n💾 Results saved to scripts/full-tier-results.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
