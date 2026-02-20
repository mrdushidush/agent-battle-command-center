#!/usr/bin/env node

/**
 * Ollama Stress Test - Qwen3-Coder-30B-A3B Comparison
 *
 * Tests qwen3:30b-a3b (MoE, 18.6GB) against the same 20-task benchmark
 * that qwen2.5-coder:7b achieves 100% on.
 *
 * Complexity distribution:
 *   - 1-2: 4 tasks (trivial - single line functions)
 *   - 3-4: 6 tasks (low - simple logic)
 *   - 5-6: 6 tasks (moderate - conditions, validation)
 *   - 7-8: 4 tasks (complex - multiple functions, classes)
 *
 * Run with: OLLAMA_MODEL=qwen3:30b-a3b node scripts/ollama-stress-test-qwen3-30b.js
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';
const TASK_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes per task
const REST_DELAY_MS = 3000; // 3 seconds rest between tasks
const RESET_EVERY_N_TASKS = 5; // Reset agent memory every N tasks

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Tasks organized by complexity level
const TASKS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 1-2: Trivial (single-line, clear I/O)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 1,
    name: "double",
    description: "Create tasks/c1_double.py with: def double(n): return n * 2",
    code: "def double(n):\n    return n * 2",
    validation: "from tasks.c1_double import double; assert double(5)==10; print('PASS')"
  },
  {
    complexity: 1,
    name: "negate",
    description: "Create tasks/c1_negate.py with: def negate(n): return -n",
    code: "def negate(n):\n    return -n",
    validation: "from tasks.c1_negate import negate; assert negate(5)==-5; print('PASS')"
  },
  {
    complexity: 2,
    name: "greet",
    description: "Create tasks/c2_greet.py with: def greet(name): return f'Hello, {name}!'",
    code: "def greet(name):\n    return f'Hello, {name}!'",
    validation: "from tasks.c2_greet import greet; assert greet('World')=='Hello, World!'; print('PASS')"
  },
  {
    complexity: 2,
    name: "is_even",
    description: "Create tasks/c2_is_even.py with: def is_even(n): return n % 2 == 0",
    code: "def is_even(n):\n    return n % 2 == 0",
    validation: "from tasks.c2_is_even import is_even; assert is_even(4)==True; assert is_even(3)==False; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 3-4: Low (simple logic, basic conditions)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 3,
    name: "absolute",
    description: "Create tasks/c3_absolute.py with function absolute(n) that returns the absolute value without using abs()",
    code: "def absolute(n):\n    if n < 0:\n        return -n\n    return n",
    validation: "from tasks.c3_absolute import absolute; assert absolute(-5)==5; assert absolute(3)==3; print('PASS')"
  },
  {
    complexity: 3,
    name: "max_of_two",
    description: "Create tasks/c3_max_of_two.py with function max_of_two(a, b) that returns the larger number",
    code: "def max_of_two(a, b):\n    if a > b:\n        return a\n    return b",
    validation: "from tasks.c3_max_of_two import max_of_two; assert max_of_two(3,7)==7; assert max_of_two(10,2)==10; print('PASS')"
  },
  {
    complexity: 4,
    name: "clamp",
    description: "Create tasks/c4_clamp.py with function clamp(value, min_val, max_val) that restricts value to the range [min_val, max_val]",
    code: "def clamp(value, min_val, max_val):\n    if value < min_val:\n        return min_val\n    if value > max_val:\n        return max_val\n    return value",
    validation: "from tasks.c4_clamp import clamp; assert clamp(5,0,10)==5; assert clamp(-5,0,10)==0; assert clamp(15,0,10)==10; print('PASS')"
  },
  {
    complexity: 4,
    name: "count_vowels",
    description: "Create tasks/c4_count_vowels.py with function count_vowels(s) that counts vowels (aeiouAEIOU) in a string",
    code: "def count_vowels(s):\n    count = 0\n    for char in s:\n        if char in 'aeiouAEIOU':\n            count += 1\n    return count",
    validation: "from tasks.c4_count_vowels import count_vowels; assert count_vowels('hello')==2; assert count_vowels('AEIOU')==5; print('PASS')"
  },
  {
    complexity: 4,
    name: "reverse_string",
    description: "Create tasks/c4_reverse.py with function reverse_string(s) that reverses a string without using [::-1]",
    code: "def reverse_string(s):\n    result = ''\n    for char in s:\n        result = char + result\n    return result",
    validation: "from tasks.c4_reverse import reverse_string; assert reverse_string('hello')=='olleh'; print('PASS')"
  },
  {
    complexity: 4,
    name: "factorial",
    description: "Create tasks/c4_factorial.py with function factorial(n) that returns n! using a loop",
    code: "def factorial(n):\n    result = 1\n    for i in range(1, n + 1):\n        result *= i\n    return result",
    validation: "from tasks.c4_factorial import factorial; assert factorial(5)==120; assert factorial(0)==1; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 5-6: Moderate (multiple conditions, validation, helper logic)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 5,
    name: "fizzbuzz_single",
    description: "Create tasks/c5_fizzbuzz.py with function fizzbuzz(n) that returns 'Fizz' if n divisible by 3, 'Buzz' if by 5, 'FizzBuzz' if both, else str(n)",
    code: "def fizzbuzz(n):\n    if n % 15 == 0:\n        return 'FizzBuzz'\n    if n % 3 == 0:\n        return 'Fizz'\n    if n % 5 == 0:\n        return 'Buzz'\n    return str(n)",
    validation: "from tasks.c5_fizzbuzz import fizzbuzz; assert fizzbuzz(15)=='FizzBuzz'; assert fizzbuzz(9)=='Fizz'; assert fizzbuzz(10)=='Buzz'; assert fizzbuzz(7)=='7'; print('PASS')"
  },
  {
    complexity: 5,
    name: "is_palindrome",
    description: "Create tasks/c5_palindrome.py with function is_palindrome(s) that checks if string is same forwards and backwards (case insensitive, ignore spaces)",
    code: "def is_palindrome(s):\n    cleaned = s.lower().replace(' ', '')\n    return cleaned == cleaned[::-1]",
    validation: "from tasks.c5_palindrome import is_palindrome; assert is_palindrome('racecar')==True; assert is_palindrome('A man a plan a canal Panama')==True; assert is_palindrome('hello')==False; print('PASS')"
  },
  {
    complexity: 5,
    name: "safe_divide",
    description: "Create tasks/c5_safe_divide.py with function safe_divide(a, b) that returns a/b or None if b is 0",
    code: "def safe_divide(a, b):\n    if b == 0:\n        return None\n    return a / b",
    validation: "from tasks.c5_safe_divide import safe_divide; assert safe_divide(10,2)==5; assert safe_divide(10,0) is None; print('PASS')"
  },
  {
    complexity: 6,
    name: "sum_of_digits",
    description: "Create tasks/c6_sum_digits.py with function sum_of_digits(n) that returns sum of all digits in an integer (handle negative numbers)",
    code: "def sum_of_digits(n):\n    n = abs(n)\n    total = 0\n    while n > 0:\n        total += n % 10\n        n //= 10\n    return total",
    validation: "from tasks.c6_sum_digits import sum_of_digits; assert sum_of_digits(123)==6; assert sum_of_digits(-456)==15; print('PASS')"
  },
  {
    complexity: 6,
    name: "find_second_largest",
    description: "Create tasks/c6_second_largest.py with function find_second_largest(numbers) that returns the second largest unique number in a list",
    code: "def find_second_largest(numbers):\n    unique = list(set(numbers))\n    if len(unique) < 2:\n        return None\n    unique.sort(reverse=True)\n    return unique[1]",
    validation: "from tasks.c6_second_largest import find_second_largest; assert find_second_largest([1,3,5,7,9])==7; assert find_second_largest([5,5,5]) is None; print('PASS')"
  },
  {
    complexity: 6,
    name: "is_prime",
    description: "Create tasks/c6_is_prime.py with function is_prime(n) that returns True if n is a prime number",
    code: "def is_prime(n):\n    if n < 2:\n        return False\n    if n == 2:\n        return True\n    if n % 2 == 0:\n        return False\n    for i in range(3, int(n**0.5) + 1, 2):\n        if n % i == 0:\n            return False\n    return True",
    validation: "from tasks.c6_is_prime import is_prime; assert is_prime(17)==True; assert is_prime(4)==False; assert is_prime(2)==True; assert is_prime(1)==False; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 7-8: Complex (multiple functions, classes, algorithms)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 7,
    name: "fibonacci",
    description: "Create tasks/c7_fibonacci.py with function fibonacci(n) that returns a list of first n Fibonacci numbers",
    code: "def fibonacci(n):\n    if n <= 0:\n        return []\n    if n == 1:\n        return [0]\n    result = [0, 1]\n    while len(result) < n:\n        result.append(result[-1] + result[-2])\n    return result",
    validation: "from tasks.c7_fibonacci import fibonacci; assert fibonacci(7)==[0,1,1,2,3,5,8]; assert fibonacci(1)==[0]; print('PASS')"
  },
  {
    complexity: 7,
    name: "word_frequency",
    description: "Create tasks/c7_word_freq.py with function word_frequency(text) that returns a dict of word counts (lowercase, split on spaces)",
    code: "def word_frequency(text):\n    words = text.lower().split()\n    freq = {}\n    for word in words:\n        if word in freq:\n            freq[word] += 1\n        else:\n            freq[word] = 1\n    return freq",
    validation: "from tasks.c7_word_freq import word_frequency; r = word_frequency('the cat and the dog'); assert r['the']==2; assert r['cat']==1; print('PASS')"
  },
  {
    complexity: 8,
    name: "merge_sorted",
    description: "Create tasks/c8_merge_sorted.py with function merge_sorted(list1, list2) that merges two sorted lists into one sorted list",
    code: "def merge_sorted(list1, list2):\n    result = []\n    i, j = 0, 0\n    while i < len(list1) and j < len(list2):\n        if list1[i] <= list2[j]:\n            result.append(list1[i])\n            i += 1\n        else:\n            result.append(list2[j])\n            j += 1\n    result.extend(list1[i:])\n    result.extend(list2[j:])\n    return result",
    validation: "from tasks.c8_merge_sorted import merge_sorted; assert merge_sorted([1,3,5],[2,4,6])==[1,2,3,4,5,6]; print('PASS')"
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
    await fetch(`${API_BASE}/agents/reset-all`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('   ✓ Agents reset');
  } catch (e) {
    console.log('   ⚠ Could not reset agents');
  }

  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/c*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
    console.log('   ✓ Workspace cleaned');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace: ' + e.message);
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
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      title: `[STRESS-C${task.complexity}] ${task.name}`,
      description: fullDescription,
      expectedOutput: `File tasks/${fileName}.py created with ${task.name} function`,
      taskType: 'code',
      priority: task.complexity <= 4 ? 3 : task.complexity,  // Keep 1-4 at priority 3 (Ollama tier)
      maxIterations: 5,
      validationCommand: task.validation
    })
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
      use_claude: false,  // Force Ollama
      model: null
    })
  });

  return response;
}

async function waitForAgent(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/coder-01`, {
        headers: { 'X-API-Key': API_KEY }
      });
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
    const result = execSync(`docker exec -w /app/workspace abcc-agents python -c "${validation}"`, {
      encoding: 'utf8',
      timeout: 10000
    });
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

function getComplexityColor(c) {
  if (c <= 2) return '\x1b[32m';  // Green
  if (c <= 4) return '\x1b[36m';  // Cyan
  if (c <= 6) return '\x1b[33m';  // Yellow
  return '\x1b[35m';              // Magenta
}
const RESET = '\x1b[0m';

async function main() {
  console.log('═'.repeat(70));
  console.log('🔥 OLLAMA STRESS TEST - QWEN3:30B-A3B vs QWEN2.5-CODER:7B');
  console.log('═'.repeat(70));
  console.log('Comparing MoE 30B (18.6GB) against 7B baseline (100% pass rate)');
  console.log('Tasks: 20 | Complexity range: 1-8 | Model: qwen3:30b-a3b');
  console.log(`Rest: ${REST_DELAY_MS/1000}s between tasks | Reset every ${RESET_EVERY_N_TASKS} tasks`);
  console.log('═'.repeat(70) + '\n');

  await resetSystem();

  const results = {
    total: TASKS.length,
    passed: 0,
    failed: 0,
    errors: 0,
    byComplexity: {},
    details: []
  };

  // Initialize complexity buckets
  for (let c = 1; c <= 8; c++) {
    results.byComplexity[c] = { total: 0, passed: 0, failed: 0 };
  }

  const startTime = Date.now();

  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    const taskNum = i + 1;
    const color = getComplexityColor(task.complexity);

    console.log(`\n[${taskNum}/${TASKS.length}] ${color}C${task.complexity}${RESET} ${task.name}`);
    console.log('─'.repeat(50));

    const taskStart = Date.now();
    let status = 'error';
    let error = null;

    results.byComplexity[task.complexity].total++;

    try {
      // Create and assign task
      const created = await createTask(task);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      // Execute
      console.log('   Executing with Ollama...');
      const execResponse = await executeTask(created.id, task.description);
      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (!execResponse.ok) {
        throw new Error(`Execution failed: ${(await execResponse.text()).substring(0, 100)}`);
      }

      // Extract only success flag — avoids holding large crewAI response in heap
      const execJson = await execResponse.json();
      const execSuccess = Boolean(execJson.success);

      // Mark complete
      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ success: execSuccess })
      });

      // Validate
      console.log('   Validating...');
      const passed = await runValidation(task.validation);

      if (passed) {
        status = 'passed';
        results.passed++;
        results.byComplexity[task.complexity].passed++;
        console.log(`   ${color}✅ PASSED${RESET} (${duration}s)`);
      } else {
        status = 'failed';
        results.failed++;
        results.byComplexity[task.complexity].failed++;
        console.log(`   ${color}❌ FAILED${RESET} - validation failed (${duration}s)`);
      }

      await waitForAgent();

    } catch (e) {
      error = e.message;
      results.errors++;
      results.byComplexity[task.complexity].failed++;
      console.log(`   💥 ERROR: ${e.message.substring(0, 60)}`);

      try {
        await fetch(`${API_BASE}/agents/reset-all`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
      } catch (resetErr) {}

      await sleep(2000);
    }

    results.details.push({
      task: task.name,
      complexity: task.complexity,
      status,
      error,
      duration: Math.floor((Date.now() - taskStart) / 1000)
    });

    // Rest delay between tasks to let Ollama "breathe"
    if (i < TASKS.length - 1) {
      console.log(`   💤 Resting ${REST_DELAY_MS/1000}s...`);
      await sleep(REST_DELAY_MS);
    }

    // Reset agent memory every N tasks to prevent context pollution
    if ((i + 1) % RESET_EVERY_N_TASKS === 0 && i < TASKS.length - 1) {
      console.log(`\n🔄 Resetting agent (clearing context after ${RESET_EVERY_N_TASKS} tasks)...`);
      try {
        await fetch(`${API_BASE}/agents/reset-all`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
        console.log('   ✓ Agent memory cleared\n');
      } catch (e) {
        console.log('   ⚠ Could not reset agent\n');
      }
      await sleep(1000);
    }
  }

  // Final report
  const totalDuration = Math.floor((Date.now() - startTime) / 1000);
  const successRate = Math.round((results.passed / results.total) * 100);

  console.log('\n' + '═'.repeat(70));
  console.log('📊 STRESS TEST RESULTS');
  console.log('═'.repeat(70));
  console.log(`   Total:    ${results.passed}/${results.total} passed (${successRate}%)`);
  console.log(`   Duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);

  console.log('\n📈 SUCCESS RATE BY COMPLEXITY:');
  console.log('─'.repeat(50));

  let foundThreshold = null;
  for (let c = 1; c <= 8; c++) {
    const stats = results.byComplexity[c];
    if (stats.total === 0) continue;

    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '█'.repeat(Math.floor(rate / 10)) + '░'.repeat(10 - Math.floor(rate / 10));
    const color = getComplexityColor(c);
    const marker = rate < 60 && !foundThreshold ? ' ← THRESHOLD?' : '';

    if (rate < 60 && !foundThreshold) {
      foundThreshold = c;
    }

    console.log(`   C${c}: ${color}${bar}${RESET} ${rate}% (${stats.passed}/${stats.total})${marker}`);
  }

  if (foundThreshold) {
    console.log(`\n🎯 RECOMMENDATION: Set Ollama max complexity to ${foundThreshold - 1}`);
  } else {
    console.log('\n🎯 Ollama handled all complexity levels well!');
  }

  console.log('═'.repeat(70));

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/ollama-stress-results.json',
    JSON.stringify({
      ...results,
      totalDuration,
      successRate,
      recommendedThreshold: foundThreshold ? foundThreshold - 1 : 8
    }, null, 2)
  );
  console.log('\n💾 Results saved to scripts/ollama-stress-results.json');

  return results;
}

main()
  .then(results => process.exit(results.errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
