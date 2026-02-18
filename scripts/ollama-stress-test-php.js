#!/usr/bin/env node

/**
 * Ollama PHP Stress Test - Graduated Complexity (1-8)
 *
 * Tests Ollama's ability to produce PHP code.
 * Each task is a standalone <?php file with functions + assertions.
 * Validation: `php tasks/c1_double.php` — prints "PASS" on success, exit(1) on failure.
 *
 * Complexity distribution:
 *   - 1-2: 4 tasks (trivial - single functions)
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

// Tasks organized by complexity level — all PHP (standalone <?php files)
const TASKS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 1-2: Trivial (single-line, clear I/O)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 1,
    name: "double",
    description: `Create tasks/c1_double.php with a PHP file. It must start with <?php. Define function double_num($n) that returns $n * 2. Then test: if (double_num(5) !== 10) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c1_double.php",
    code: `<?php
function double_num($n) { return $n * 2; }
if (double_num(5) !== 10) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 1,
    name: "negate",
    description: `Create tasks/c1_negate.php with a PHP file. It must start with <?php. Define function negate($n) that returns -$n. Then test: if (negate(5) !== -5) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c1_negate.php",
    code: `<?php
function negate($n) { return -$n; }
if (negate(5) !== -5) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 2,
    name: "greet",
    description: `Create tasks/c2_greet.php with a PHP file. It must start with <?php. Define function greet($name) that returns "Hello, " . $name . "!". Then test: if (greet("World") !== "Hello, World!") { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c2_greet.php",
    code: `<?php
function greet($name) { return "Hello, " . $name . "!"; }
if (greet("World") !== "Hello, World!") { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 2,
    name: "isEven",
    description: `Create tasks/c2_is_even.php with a PHP file. It must start with <?php. Define function is_even($n) that returns true if $n is even, false otherwise. Then test: if (is_even(4) !== true || is_even(3) !== false) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c2_is_even.php",
    code: `<?php
function is_even($n) { return $n % 2 === 0; }
if (is_even(4) !== true || is_even(3) !== false) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 3-4: Low (simple logic, basic conditions)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 3,
    name: "absolute",
    description: `Create tasks/c3_absolute.php with a PHP file. It must start with <?php. Define function absolute($n) that returns the absolute value of $n without using abs(). Then test: if (absolute(-5) !== 5 || absolute(3) !== 3) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c3_absolute.php",
    code: `<?php
function absolute($n) { return $n < 0 ? -$n : $n; }
if (absolute(-5) !== 5 || absolute(3) !== 3) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 3,
    name: "maxOfTwo",
    description: `Create tasks/c3_max_of_two.php with a PHP file. It must start with <?php. Define function max_of_two($a, $b) that returns the larger number. Then test: if (max_of_two(3, 7) !== 7 || max_of_two(10, 2) !== 10) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c3_max_of_two.php",
    code: `<?php
function max_of_two($a, $b) { return $a > $b ? $a : $b; }
if (max_of_two(3, 7) !== 7 || max_of_two(10, 2) !== 10) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 4,
    name: "clamp",
    description: `Create tasks/c4_clamp.php with a PHP file. It must start with <?php. Define function clamp($value, $min, $max) that restricts $value to the range [$min, $max]. Then test: if (clamp(5,0,10)!==5 || clamp(-5,0,10)!==0 || clamp(15,0,10)!==10) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c4_clamp.php",
    code: `<?php
function clamp($value, $min, $max) {
    if ($value < $min) return $min;
    if ($value > $max) return $max;
    return $value;
}
if (clamp(5,0,10) !== 5 || clamp(-5,0,10) !== 0 || clamp(15,0,10) !== 10) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 4,
    name: "countVowels",
    description: `Create tasks/c4_count_vowels.php with a PHP file. It must start with <?php. Define function count_vowels($s) that counts vowels (aeiouAEIOU) in a string. Then test: if (count_vowels("hello") !== 2 || count_vowels("AEIOU") !== 5) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c4_count_vowels.php",
    code: `<?php
function count_vowels($s) {
    $count = 0;
    for ($i = 0; $i < strlen($s); $i++) {
        if (strpos("aeiouAEIOU", $s[$i]) !== false) $count++;
    }
    return $count;
}
if (count_vowels("hello") !== 2 || count_vowels("AEIOU") !== 5) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 4,
    name: "reverseString",
    description: `Create tasks/c4_reverse.php with a PHP file. It must start with <?php. Define function reverse_string($s) that reverses a string using a loop (not strrev). Then test: if (reverse_string("hello") !== "olleh") { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c4_reverse.php",
    code: `<?php
function reverse_string($s) {
    $result = "";
    for ($i = strlen($s) - 1; $i >= 0; $i--) {
        $result .= $s[$i];
    }
    return $result;
}
if (reverse_string("hello") !== "olleh") { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 4,
    name: "factorial",
    description: `Create tasks/c4_factorial.php with a PHP file. It must start with <?php. Define function factorial($n) that returns $n! using a loop. Then test: if (factorial(5) !== 120 || factorial(0) !== 1) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c4_factorial.php",
    code: `<?php
function factorial($n) {
    $result = 1;
    for ($i = 1; $i <= $n; $i++) { $result *= $i; }
    return $result;
}
if (factorial(5) !== 120 || factorial(0) !== 1) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 5-6: Moderate (multiple conditions, validation, helper logic)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 5,
    name: "fizzBuzz",
    description: `Create tasks/c5_fizzbuzz.php with a PHP file. It must start with <?php. Define function fizz_buzz($n) that returns "Fizz" if $n divisible by 3, "Buzz" if by 5, "FizzBuzz" if both, else strval($n). Then test: if (fizz_buzz(15)!=="FizzBuzz" || fizz_buzz(9)!=="Fizz" || fizz_buzz(10)!=="Buzz" || fizz_buzz(7)!=="7") { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c5_fizzbuzz.php",
    code: `<?php
function fizz_buzz($n) {
    if ($n % 15 === 0) return "FizzBuzz";
    if ($n % 3 === 0) return "Fizz";
    if ($n % 5 === 0) return "Buzz";
    return strval($n);
}
if (fizz_buzz(15) !== "FizzBuzz" || fizz_buzz(9) !== "Fizz" || fizz_buzz(10) !== "Buzz" || fizz_buzz(7) !== "7") { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 5,
    name: "isPalindrome",
    description: `Create tasks/c5_palindrome.php with a PHP file. It must start with <?php. Define function is_palindrome($s) that checks if string is the same forwards and backwards (case insensitive, ignore spaces). Then test: if (is_palindrome("racecar")!==true || is_palindrome("hello")!==false) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c5_palindrome.php",
    code: `<?php
function is_palindrome($s) {
    $cleaned = strtolower(str_replace(" ", "", $s));
    return $cleaned === strrev($cleaned);
}
if (is_palindrome("racecar") !== true || is_palindrome("hello") !== false) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 5,
    name: "safeDivide",
    description: `Create tasks/c5_safe_divide.php with a PHP file. It must start with <?php. Define function safe_divide($a, $b) that returns $a/$b or null if $b is 0. Then test: if (safe_divide(10, 2) !== 5.0 || safe_divide(10, 0) !== null) { echo "FAIL"; exit(1); } echo "PASS";  Note: use == for the 5.0 comparison since PHP division returns float.`,
    validation: "php tasks/c5_safe_divide.php",
    code: `<?php
function safe_divide($a, $b) {
    if ($b == 0) return null;
    return $a / $b;
}
if (safe_divide(10, 2) != 5 || safe_divide(10, 0) !== null) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 6,
    name: "sumOfDigits",
    description: `Create tasks/c6_sum_digits.php with a PHP file. It must start with <?php. Define function sum_of_digits($n) that returns the sum of all digits (handle negative with abs). Then test: if (sum_of_digits(123) !== 6 || sum_of_digits(-456) !== 15) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c6_sum_digits.php",
    code: `<?php
function sum_of_digits($n) {
    $n = abs($n);
    $total = 0;
    while ($n > 0) {
        $total += $n % 10;
        $n = intdiv($n, 10);
    }
    return $total;
}
if (sum_of_digits(123) !== 6 || sum_of_digits(-456) !== 15) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 6,
    name: "findSecondLargest",
    description: `Create tasks/c6_second_largest.php with a PHP file. It must start with <?php. Define function find_second_largest($nums) that returns the second largest unique number, or null if not possible. Then test: if (find_second_largest([1,3,5,7,9]) !== 7 || find_second_largest([5,5,5]) !== null) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c6_second_largest.php",
    code: `<?php
function find_second_largest($nums) {
    $unique = array_unique($nums);
    if (count($unique) < 2) return null;
    rsort($unique);
    return $unique[1];
}
if (find_second_largest([1,3,5,7,9]) !== 7 || find_second_largest([5,5,5]) !== null) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 6,
    name: "isPrime",
    description: `Create tasks/c6_is_prime.php with a PHP file. It must start with <?php. Define function is_prime($n) that returns true if $n is a prime number. Then test: if (is_prime(17) !== true || is_prime(4) !== false || is_prime(2) !== true || is_prime(1) !== false) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c6_is_prime.php",
    code: `<?php
function is_prime($n) {
    if ($n < 2) return false;
    if ($n === 2) return true;
    if ($n % 2 === 0) return false;
    for ($i = 3; $i * $i <= $n; $i += 2) {
        if ($n % $i === 0) return false;
    }
    return true;
}
if (is_prime(17) !== true || is_prime(4) !== false || is_prime(2) !== true || is_prime(1) !== false) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 7-8: Complex (multiple functions, algorithms)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 7,
    name: "fibonacci",
    description: `Create tasks/c7_fibonacci.php with a PHP file. It must start with <?php. Define function fibonacci($n) that returns an array of the first $n Fibonacci numbers. Then test: if (fibonacci(7) !== [0,1,1,2,3,5,8]) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c7_fibonacci.php",
    code: `<?php
function fibonacci($n) {
    if ($n <= 0) return [];
    if ($n === 1) return [0];
    $result = [0, 1];
    while (count($result) < $n) {
        $result[] = $result[count($result)-1] + $result[count($result)-2];
    }
    return $result;
}
if (fibonacci(7) !== [0,1,1,2,3,5,8]) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 7,
    name: "wordFrequency",
    description: `Create tasks/c7_word_freq.php with a PHP file. It must start with <?php. Define function word_frequency($text) that returns an associative array of word counts (lowercase, split on spaces). Then test: $r = word_frequency("the cat and the dog"); if ($r["the"] !== 2 || $r["cat"] !== 1) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c7_word_freq.php",
    code: `<?php
function word_frequency($text) {
    $words = explode(" ", strtolower($text));
    $freq = [];
    foreach ($words as $word) {
        if (!isset($freq[$word])) $freq[$word] = 0;
        $freq[$word]++;
    }
    return $freq;
}
$r = word_frequency("the cat and the dog");
if ($r["the"] !== 2 || $r["cat"] !== 1) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 8,
    name: "mergeSorted",
    description: `Create tasks/c8_merge_sorted.php with a PHP file. It must start with <?php. Define function merge_sorted($a, $b) that merges two sorted arrays into one sorted array using a two-pointer approach (do NOT use sort). Then test: if (merge_sorted([1,3,5], [2,4,6]) !== [1,2,3,4,5,6]) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c8_merge_sorted.php",
    code: `<?php
function merge_sorted($a, $b) {
    $result = [];
    $i = 0; $j = 0;
    while ($i < count($a) && $j < count($b)) {
        if ($a[$i] <= $b[$j]) { $result[] = $a[$i]; $i++; }
        else { $result[] = $b[$j]; $j++; }
    }
    while ($i < count($a)) { $result[] = $a[$i]; $i++; }
    while ($j < count($b)) { $result[] = $b[$j]; $j++; }
    return $result;
}
if (merge_sorted([1,3,5], [2,4,6]) !== [1,2,3,4,5,6]) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  },
  {
    complexity: 8,
    name: "binarySearch",
    description: `Create tasks/c8_binary_search.php with a PHP file. It must start with <?php. Define function binary_search($arr, $target) that returns the index of $target in a sorted array, or -1 if not found. Then test: if (binary_search([1,2,3,4,5], 3) !== 2 || binary_search([1,2,3,4,5], 6) !== -1) { echo "FAIL"; exit(1); } echo "PASS";`,
    validation: "php tasks/c8_binary_search.php",
    code: `<?php
function binary_search($arr, $target) {
    $left = 0; $right = count($arr) - 1;
    while ($left <= $right) {
        $mid = intdiv($left + $right, 2);
        if ($arr[$mid] === $target) return $mid;
        if ($arr[$mid] < $target) $left = $mid + 1;
        else $right = $mid - 1;
    }
    return -1;
}
if (binary_search([1,2,3,4,5], 3) !== 2 || binary_search([1,2,3,4,5], 6) !== -1) { echo "FAIL"; exit(1); }
echo "PASS\\n";`
  }
];

async function resetSystem() {
  console.log('\u{1f504} Resetting system...');

  try {
    await fetch(`${API_BASE}/agents/reset-all`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('   \u2713 Agents reset');
  } catch (e) {
    console.log('   \u26a0 Could not reset agents');
  }

  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/c*.php 2>/dev/null"', { stdio: 'pipe' });
    console.log('   \u2713 PHP workspace cleaned');
  } catch (e) {
    console.log('   \u26a0 Could not clean workspace: ' + e.message);
  }

  await sleep(2000);
}

async function createTask(task) {
  const fileName = `c${task.complexity}_${task.name}`;
  const fullDescription = `IMPORTANT: You MUST use the file_write tool to create the file. This is a PHP task.

Step 1: Use file_write to create tasks/${fileName}.php with this content:
${task.code}

Step 2: Verify with: php tasks/${fileName}.php

The file MUST start with <?php and echo "PASS" if all tests pass, or exit(1) on failure.

DO NOT just output the code - you MUST call file_write(path="tasks/${fileName}.php", content="...")`;

  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      title: `[PHP-STRESS-C${task.complexity}] ${task.name}`,
      description: fullDescription,
      expectedOutput: `File tasks/${fileName}.php created with ${task.name} function`,
      taskType: 'code',
      priority: task.complexity <= 4 ? 3 : task.complexity,
      maxIterations: 5
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
    const result = execSync(`docker exec -w /app/workspace abcc-agents ${validation}`, {
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
  console.log('\u2550'.repeat(70));
  console.log('\u{1f7ea} OLLAMA PHP STRESS TEST - GRADUATED COMPLEXITY (1-8)');
  console.log('\u2550'.repeat(70));
  console.log('Goal: Validate Ollama can produce correct PHP code');
  console.log('Tasks: 20 | Complexity range: 1-8 | Model: qwen2.5-coder:7b');
  console.log('Language: PHP 8.2 | Standalone <?php files');
  console.log(`Rest: ${REST_DELAY_MS/1000}s between tasks | Reset every ${RESET_EVERY_N_TASKS} tasks`);
  console.log('\u2550'.repeat(70) + '\n');

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

    console.log(`\n[${taskNum}/${TASKS.length}] ${color}C${task.complexity}${RESET} ${task.name} (PHP)`);
    console.log('\u2500'.repeat(50));

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
      console.log('   Validating with php...');
      const passed = await runValidation(task.validation);

      if (passed) {
        status = 'passed';
        results.passed++;
        results.byComplexity[task.complexity].passed++;
        console.log(`   ${color}\u2705 PASSED${RESET} (${duration}s)`);
      } else {
        status = 'failed';
        results.failed++;
        results.byComplexity[task.complexity].failed++;
        console.log(`   ${color}\u274c FAILED${RESET} - validation failed (${duration}s)`);
      }

      await waitForAgent();

    } catch (e) {
      error = e.message;
      results.errors++;
      results.byComplexity[task.complexity].failed++;
      console.log(`   \u{1f4a5} ERROR: ${e.message.substring(0, 60)}`);

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
      console.log(`   \u{1f4a4} Resting ${REST_DELAY_MS/1000}s...`);
      await sleep(REST_DELAY_MS);
    }

    // Reset agent memory every N tasks
    if ((i + 1) % RESET_EVERY_N_TASKS === 0 && i < TASKS.length - 1) {
      console.log(`\n\u{1f504} Resetting agent (clearing context after ${RESET_EVERY_N_TASKS} tasks)...`);
      try {
        await fetch(`${API_BASE}/agents/reset-all`, {
          method: 'POST',
          headers: { 'X-API-Key': API_KEY }
        });
        console.log('   \u2713 Agent memory cleared\n');
      } catch (e) {
        console.log('   \u26a0 Could not reset agent\n');
      }
      await sleep(1000);
    }
  }

  // Final report
  const totalDuration = Math.floor((Date.now() - startTime) / 1000);
  const successRate = Math.round((results.passed / results.total) * 100);

  console.log('\n' + '\u2550'.repeat(70));
  console.log('\u{1f4ca} PHP STRESS TEST RESULTS');
  console.log('\u2550'.repeat(70));
  console.log(`   Total:    ${results.passed}/${results.total} passed (${successRate}%)`);
  console.log(`   Duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);

  console.log('\n\u{1f4c8} SUCCESS RATE BY COMPLEXITY:');
  console.log('\u2500'.repeat(50));

  let foundThreshold = null;
  for (let c = 1; c <= 8; c++) {
    const stats = results.byComplexity[c];
    if (stats.total === 0) continue;

    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '\u2588'.repeat(Math.floor(rate / 10)) + '\u2591'.repeat(10 - Math.floor(rate / 10));
    const color = getComplexityColor(c);
    const marker = rate < 60 && !foundThreshold ? ' \u2190 THRESHOLD?' : '';

    if (rate < 60 && !foundThreshold) {
      foundThreshold = c;
    }

    console.log(`   C${c}: ${color}${bar}${RESET} ${rate}% (${stats.passed}/${stats.total})${marker}`);
  }

  if (foundThreshold) {
    console.log(`\n\u{1f3af} RECOMMENDATION: PHP tasks struggle at complexity ${foundThreshold}+`);
  } else {
    console.log('\n\u{1f3af} Ollama handled all PHP complexity levels well!');
  }

  console.log('\u2550'.repeat(70));

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/ollama-stress-results-php.json',
    JSON.stringify({
      ...results,
      language: 'php',
      totalDuration,
      successRate,
      recommendedThreshold: foundThreshold ? foundThreshold - 1 : 8
    }, null, 2)
  );
  console.log('\n\u{1f4be} Results saved to scripts/ollama-stress-results-php.json');

  return results;
}

main()
  .then(results => process.exit(results.errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
