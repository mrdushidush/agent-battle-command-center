#!/usr/bin/env node

/**
 * Ollama JS Stress Test - Graduated Complexity (1-8)
 *
 * Tests Ollama's ability to produce JavaScript code.
 * Mirrors the Python stress test (ollama-stress-test.js) with JS tasks.
 * Uses CommonJS (module.exports/require) — Node.js default, no package.json needed.
 *
 * Complexity distribution:
 *   - 1-2: 4 tasks (trivial - single line functions)
 *   - 3-4: 6 tasks (low - simple logic)
 *   - 5-6: 6 tasks (moderate - conditions, validation)
 *   - 7-8: 4 tasks (complex - multiple functions, algorithms)
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

// Tasks organized by complexity level — all JavaScript (CommonJS)
const TASKS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 1-2: Trivial (single-line, clear I/O)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 1,
    name: "double",
    description: "Create tasks/c1_double.js with: function double(n) that returns n * 2. Export it with module.exports = { double };",
    code: "function double(n) { return n * 2; }\nmodule.exports = { double };",
    validation: "const {double} = require('./tasks/c1_double'); if (double(5)!==10) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 1,
    name: "negate",
    description: "Create tasks/c1_negate.js with: function negate(n) that returns -n. Export it with module.exports = { negate };",
    code: "function negate(n) { return -n; }\nmodule.exports = { negate };",
    validation: "const {negate} = require('./tasks/c1_negate'); if (negate(5)!==-5) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 2,
    name: "greet",
    description: "Create tasks/c2_greet.js with: function greet(name) that returns 'Hello, ' + name + '!'. Export it with module.exports = { greet };",
    code: "function greet(name) { return 'Hello, ' + name + '!'; }\nmodule.exports = { greet };",
    validation: "const {greet} = require('./tasks/c2_greet'); if (greet('World')!=='Hello, World!') process.exit(1); console.log('PASS')"
  },
  {
    complexity: 2,
    name: "isEven",
    description: "Create tasks/c2_is_even.js with: function isEven(n) that returns true if n is even, false otherwise. Export it with module.exports = { isEven };",
    code: "function isEven(n) { return n % 2 === 0; }\nmodule.exports = { isEven };",
    validation: "const {isEven} = require('./tasks/c2_is_even'); if (isEven(4)!==true||isEven(3)!==false) process.exit(1); console.log('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 3-4: Low (simple logic, basic conditions)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 3,
    name: "absolute",
    description: "Create tasks/c3_absolute.js with: function absolute(n) that returns the absolute value of n without using Math.abs(). Export it with module.exports = { absolute };",
    code: "function absolute(n) { return n < 0 ? -n : n; }\nmodule.exports = { absolute };",
    validation: "const {absolute} = require('./tasks/c3_absolute'); if (absolute(-5)!==5||absolute(3)!==3) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 3,
    name: "maxOfTwo",
    description: "Create tasks/c3_max_of_two.js with: function maxOfTwo(a, b) that returns the larger number. Export it with module.exports = { maxOfTwo };",
    code: "function maxOfTwo(a, b) { return a > b ? a : b; }\nmodule.exports = { maxOfTwo };",
    validation: "const {maxOfTwo} = require('./tasks/c3_max_of_two'); if (maxOfTwo(3,7)!==7||maxOfTwo(10,2)!==10) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 4,
    name: "clamp",
    description: "Create tasks/c4_clamp.js with: function clamp(value, min, max) that restricts value to the range [min, max]. Export it with module.exports = { clamp };",
    code: "function clamp(value, min, max) {\n  if (value < min) return min;\n  if (value > max) return max;\n  return value;\n}\nmodule.exports = { clamp };",
    validation: "const {clamp} = require('./tasks/c4_clamp'); if (clamp(5,0,10)!==5||clamp(-5,0,10)!==0||clamp(15,0,10)!==10) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 4,
    name: "countVowels",
    description: "Create tasks/c4_count_vowels.js with: function countVowels(s) that counts vowels (aeiouAEIOU) in a string. Export it with module.exports = { countVowels };",
    code: "function countVowels(s) {\n  let count = 0;\n  for (const c of s) {\n    if ('aeiouAEIOU'.includes(c)) count++;\n  }\n  return count;\n}\nmodule.exports = { countVowels };",
    validation: "const {countVowels} = require('./tasks/c4_count_vowels'); if (countVowels('hello')!==2||countVowels('AEIOU')!==5) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 4,
    name: "reverseString",
    description: "Create tasks/c4_reverse.js with: function reverseString(s) that reverses a string without using .split('').reverse().join(''). Use a loop instead. Export it with module.exports = { reverseString };",
    code: "function reverseString(s) {\n  let result = '';\n  for (let i = s.length - 1; i >= 0; i--) {\n    result += s[i];\n  }\n  return result;\n}\nmodule.exports = { reverseString };",
    validation: "const {reverseString} = require('./tasks/c4_reverse'); if (reverseString('hello')!=='olleh') process.exit(1); console.log('PASS')"
  },
  {
    complexity: 4,
    name: "factorial",
    description: "Create tasks/c4_factorial.js with: function factorial(n) that returns n! using a loop. Export it with module.exports = { factorial };",
    code: "function factorial(n) {\n  let result = 1;\n  for (let i = 1; i <= n; i++) {\n    result *= i;\n  }\n  return result;\n}\nmodule.exports = { factorial };",
    validation: "const {factorial} = require('./tasks/c4_factorial'); if (factorial(5)!==120||factorial(0)!==1) process.exit(1); console.log('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 5-6: Moderate (multiple conditions, validation, helper logic)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 5,
    name: "fizzBuzz",
    description: "Create tasks/c5_fizzbuzz.js with: function fizzBuzz(n) that returns 'Fizz' if n divisible by 3, 'Buzz' if by 5, 'FizzBuzz' if both, else String(n). Export it with module.exports = { fizzBuzz };",
    code: "function fizzBuzz(n) {\n  if (n % 15 === 0) return 'FizzBuzz';\n  if (n % 3 === 0) return 'Fizz';\n  if (n % 5 === 0) return 'Buzz';\n  return String(n);\n}\nmodule.exports = { fizzBuzz };",
    validation: "const {fizzBuzz} = require('./tasks/c5_fizzbuzz'); if (fizzBuzz(15)!=='FizzBuzz'||fizzBuzz(9)!=='Fizz'||fizzBuzz(10)!=='Buzz'||fizzBuzz(7)!=='7') process.exit(1); console.log('PASS')"
  },
  {
    complexity: 5,
    name: "isPalindrome",
    description: "Create tasks/c5_palindrome.js with: function isPalindrome(s) that checks if string is the same forwards and backwards (case insensitive, ignore spaces). Export it with module.exports = { isPalindrome };",
    code: "function isPalindrome(s) {\n  const cleaned = s.toLowerCase().replace(/ /g, '');\n  return cleaned === cleaned.split('').reverse().join('');\n}\nmodule.exports = { isPalindrome };",
    validation: "const {isPalindrome} = require('./tasks/c5_palindrome'); if (isPalindrome('racecar')!==true||isPalindrome('hello')!==false) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 5,
    name: "safeDivide",
    description: "Create tasks/c5_safe_divide.js with: function safeDivide(a, b) that returns a/b or null if b is 0. Export it with module.exports = { safeDivide };",
    code: "function safeDivide(a, b) {\n  if (b === 0) return null;\n  return a / b;\n}\nmodule.exports = { safeDivide };",
    validation: "const {safeDivide} = require('./tasks/c5_safe_divide'); if (safeDivide(10,2)!==5||safeDivide(10,0)!==null) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 6,
    name: "sumOfDigits",
    description: "Create tasks/c6_sum_digits.js with: function sumOfDigits(n) that returns the sum of all digits of an integer (handle negative numbers). Export it with module.exports = { sumOfDigits };",
    code: "function sumOfDigits(n) {\n  n = Math.abs(n);\n  let total = 0;\n  while (n > 0) {\n    total += n % 10;\n    n = Math.floor(n / 10);\n  }\n  return total;\n}\nmodule.exports = { sumOfDigits };",
    validation: "const {sumOfDigits} = require('./tasks/c6_sum_digits'); if (sumOfDigits(123)!==6||sumOfDigits(-456)!==15) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 6,
    name: "findSecondLargest",
    description: "Create tasks/c6_second_largest.js with: function findSecondLargest(numbers) that returns the second largest unique number in an array, or null if not possible. Export it with module.exports = { findSecondLargest };",
    code: "function findSecondLargest(numbers) {\n  const unique = [...new Set(numbers)];\n  if (unique.length < 2) return null;\n  unique.sort((a, b) => b - a);\n  return unique[1];\n}\nmodule.exports = { findSecondLargest };",
    validation: "const {findSecondLargest} = require('./tasks/c6_second_largest'); if (findSecondLargest([1,3,5,7,9])!==7||findSecondLargest([5,5,5])!==null) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 6,
    name: "isPrime",
    description: "Create tasks/c6_is_prime.js with: function isPrime(n) that returns true if n is a prime number. Export it with module.exports = { isPrime };",
    code: "function isPrime(n) {\n  if (n < 2) return false;\n  if (n === 2) return true;\n  if (n % 2 === 0) return false;\n  for (let i = 3; i <= Math.sqrt(n); i += 2) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}\nmodule.exports = { isPrime };",
    validation: "const {isPrime} = require('./tasks/c6_is_prime'); if (isPrime(17)!==true||isPrime(4)!==false||isPrime(2)!==true||isPrime(1)!==false) process.exit(1); console.log('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 7-8: Complex (multiple functions, algorithms)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 7,
    name: "fibonacci",
    description: "Create tasks/c7_fibonacci.js with: function fibonacci(n) that returns an array of the first n Fibonacci numbers. Export it with module.exports = { fibonacci };",
    code: "function fibonacci(n) {\n  if (n <= 0) return [];\n  if (n === 1) return [0];\n  const result = [0, 1];\n  while (result.length < n) {\n    result.push(result[result.length - 1] + result[result.length - 2]);\n  }\n  return result;\n}\nmodule.exports = { fibonacci };",
    validation: "const {fibonacci} = require('./tasks/c7_fibonacci'); const r=fibonacci(7); if (JSON.stringify(r)!==JSON.stringify([0,1,1,2,3,5,8])) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 7,
    name: "wordFrequency",
    description: "Create tasks/c7_word_freq.js with: function wordFrequency(text) that returns an object of word counts (lowercase, split on spaces). Export it with module.exports = { wordFrequency };",
    code: "function wordFrequency(text) {\n  const words = text.toLowerCase().split(' ');\n  const freq = {};\n  for (const word of words) {\n    freq[word] = (freq[word] || 0) + 1;\n  }\n  return freq;\n}\nmodule.exports = { wordFrequency };",
    validation: "const {wordFrequency} = require('./tasks/c7_word_freq'); const r=wordFrequency('the cat and the dog'); if (r['the']!==2||r['cat']!==1) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 8,
    name: "mergeSorted",
    description: "Create tasks/c8_merge_sorted.js with: function mergeSorted(list1, list2) that merges two sorted arrays into one sorted array using a two-pointer approach. Export it with module.exports = { mergeSorted };",
    code: "function mergeSorted(list1, list2) {\n  const result = [];\n  let i = 0, j = 0;\n  while (i < list1.length && j < list2.length) {\n    if (list1[i] <= list2[j]) {\n      result.push(list1[i++]);\n    } else {\n      result.push(list2[j++]);\n    }\n  }\n  while (i < list1.length) result.push(list1[i++]);\n  while (j < list2.length) result.push(list2[j++]);\n  return result;\n}\nmodule.exports = { mergeSorted };",
    validation: "const {mergeSorted} = require('./tasks/c8_merge_sorted'); if (JSON.stringify(mergeSorted([1,3,5],[2,4,6]))!==JSON.stringify([1,2,3,4,5,6])) process.exit(1); console.log('PASS')"
  },
  {
    complexity: 8,
    name: "binarySearch",
    description: "Create tasks/c8_binary_search.js with: function binarySearch(arr, target) that returns the index of target in a sorted array, or -1 if not found. Export it with module.exports = { binarySearch };",
    code: "function binarySearch(arr, target) {\n  let left = 0, right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    else if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}\nmodule.exports = { binarySearch };",
    validation: "const {binarySearch} = require('./tasks/c8_binary_search'); if (binarySearch([1,2,3,4,5],3)!==2||binarySearch([1,2,3,4,5],6)!==-1) process.exit(1); console.log('PASS')"
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
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/c*.js 2>/dev/null"', { stdio: 'pipe' });
    console.log('   ✓ JS workspace cleaned');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace: ' + e.message);
  }

  await sleep(2000);
}

async function createTask(task) {
  const fileName = `c${task.complexity}_${task.name}`;
  // Build description that instructs the agent to create a JS file
  const fullDescription = `IMPORTANT: You MUST use the file_write tool to create the file. This is a JAVASCRIPT task.

Step 1: Use file_write to create tasks/${fileName}.js with this content:
${task.code}

Step 2: Verify with: node -e "const m = require('./tasks/${fileName}'); console.log('loaded')"

DO NOT just output the code - you MUST call file_write(path="tasks/${fileName}.js", content="...")`;

  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      title: `[JS-STRESS-C${task.complexity}] ${task.name}`,
      description: fullDescription,
      expectedOutput: `File tasks/${fileName}.js created with ${task.name} function`,
      taskType: 'code',
      priority: task.complexity <= 4 ? 3 : task.complexity,
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
    const result = execSync(`docker exec -w /app/workspace abcc-agents node -e "${validation}"`, {
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
  console.log('🟨 OLLAMA JS STRESS TEST - GRADUATED COMPLEXITY (1-8)');
  console.log('═'.repeat(70));
  console.log('Goal: Validate Ollama can produce correct JavaScript code');
  console.log('Tasks: 20 | Complexity range: 1-8 | Model: qwen2.5-coder:7b');
  console.log('Language: JavaScript (CommonJS) | Runtime: Node.js 20');
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

    console.log(`\n[${taskNum}/${TASKS.length}] ${color}C${task.complexity}${RESET} ${task.name} (JS)`);
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
      console.log('   Validating with Node.js...');
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

    // Rest delay between tasks
    if (i < TASKS.length - 1) {
      console.log(`   💤 Resting ${REST_DELAY_MS/1000}s...`);
      await sleep(REST_DELAY_MS);
    }

    // Reset agent memory every N tasks
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
  console.log('📊 JS STRESS TEST RESULTS');
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
    console.log(`\n🎯 RECOMMENDATION: JS tasks struggle at complexity ${foundThreshold}+`);
  } else {
    console.log('\n🎯 Ollama handled all JS complexity levels well!');
  }

  console.log('═'.repeat(70));

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/ollama-stress-results-js.json',
    JSON.stringify({
      ...results,
      language: 'javascript',
      totalDuration,
      successRate,
      recommendedThreshold: foundThreshold ? foundThreshold - 1 : 8
    }, null, 2)
  );
  console.log('\n💾 Results saved to scripts/ollama-stress-results-js.json');

  return results;
}

main()
  .then(results => process.exit(results.errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
