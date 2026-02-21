#!/usr/bin/env node

/**
 * Ollama Quality Comparison Test - Bug Fixing Challenge
 *
 * Tests code QUALITY by giving both models buggy Python files to fix.
 * Each file has 1-3 intentional bugs (syntax errors, logic errors, edge cases).
 *
 * The model must:
 * 1. Read the buggy file
 * 2. Identify all bugs
 * 3. Fix them using file_write or file_edit
 * 4. Pass the validation command
 *
 * Run with:
 *   MODEL=qwen2.5-coder:8k  node scripts/ollama-quality-comparison.js
 *   MODEL=qwen3-coder:16k    node scripts/ollama-quality-comparison.js
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';
const MODEL = process.env.MODEL || 'qwen2.5-coder:8k';
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per task
const REST_DELAY_MS = 5000;
const RESET_EVERY_N_TASKS = 3;
const QUICK_MODE = process.argv.includes('--quick'); // Run only 3 tasks (1 easy, 1 medium, 1 hard)

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 BUGGY FILES - Each has intentional errors that the model must find & fix
// ═══════════════════════════════════════════════════════════════════════════
const BUGS = [
  // ─── Bug 1: Off-by-one in range (easy) ───
  {
    name: "sum_range",
    difficulty: "easy",
    bugDescription: "Off-by-one: range(start, end) excludes end, should be range(start, end+1)",
    buggyCode: `def sum_range(start, end):
    """Return sum of integers from start to end (inclusive)."""
    total = 0
    for i in range(start, end):
        total += i
    return total`,
    validation: "from tasks.bug_sum_range import sum_range; assert sum_range(1,5)==15, f'got {sum_range(1,5)}'; assert sum_range(3,3)==3; print('PASS')",
    expectedFix: "range(start, end+1)"
  },

  // ─── Bug 2: Wrong comparison operator (easy) ───
  {
    name: "find_max",
    difficulty: "easy",
    bugDescription: "Uses < instead of > to track maximum",
    buggyCode: `def find_max(numbers):
    """Return the maximum value in a list."""
    if not numbers:
        return None
    max_val = numbers[0]
    for n in numbers[1:]:
        if n < max_val:
            max_val = n
    return max_val`,
    validation: "from tasks.bug_find_max import find_max; assert find_max([3,1,4,1,5,9])==9; assert find_max([-1,-5,-2])==-1; assert find_max([])==None; print('PASS')",
    expectedFix: "if n > max_val"
  },

  // ─── Bug 3: Missing edge case + syntax error (medium) ───
  {
    name: "safe_divide",
    difficulty: "medium",
    bugDescription: "1) Missing colon after if statement 2) No check for zero division",
    buggyCode: `def safe_divide(a, b)
    """Return a/b, or None if b is zero."""
    return a / b`,
    validation: "from tasks.bug_safe_divide import safe_divide; assert safe_divide(10,2)==5.0; assert safe_divide(10,0) is None; assert safe_divide(0,5)==0.0; print('PASS')",
    expectedFix: "def safe_divide(a, b):\\n    if b == 0:\\n        return None"
  },

  // ─── Bug 4: Logic inversion in boolean (medium) ───
  {
    name: "is_leap_year",
    difficulty: "medium",
    bugDescription: "Logic is inverted: divisible by 100 should NOT be leap UNLESS also by 400",
    buggyCode: `def is_leap_year(year):
    """Return True if year is a leap year."""
    if year % 400 == 0:
        return False
    if year % 100 == 0:
        return True
    if year % 4 == 0:
        return True
    return False`,
    validation: "from tasks.bug_is_leap_year import is_leap_year; assert is_leap_year(2000)==True; assert is_leap_year(1900)==False; assert is_leap_year(2024)==True; assert is_leap_year(2023)==False; print('PASS')",
    expectedFix: "400 -> True, 100 -> False"
  },

  // ─── Bug 5: Wrong variable name + accumulator error (medium) ───
  {
    name: "running_average",
    difficulty: "medium",
    bugDescription: "1) Uses undefined variable 'sum' instead of 'total' 2) Divides by wrong count",
    buggyCode: `def running_average(numbers):
    """Return a list of running averages."""
    total = 0
    averages = []
    for i, n in enumerate(numbers):
        total += n
        averages.append(sum / i)
    return averages`,
    validation: "from tasks.bug_running_average import running_average; r = running_average([2, 4, 6]); assert r == [2.0, 3.0, 4.0], f'got {r}'; print('PASS')",
    expectedFix: "total / (i + 1)"
  },

  // ─── Bug 6: String manipulation bugs (medium) ───
  {
    name: "title_case",
    difficulty: "medium",
    bugDescription: "1) Splits on comma instead of space 2) Capitalizes only first letter but doesn't lowercase rest",
    buggyCode: `def title_case(text):
    """Convert text to title case (first letter of each word capitalized)."""
    words = text.split(',')
    result = []
    for word in words:
        if word:
            result.append(word[0].upper() + word[1:])
    return ' '.join(result)`,
    validation: "from tasks.bug_title_case import title_case; assert title_case('hello world')=='Hello World'; assert title_case('HELLO WORLD')=='Hello World'; assert title_case('a')=='A'; print('PASS')",
    expectedFix: "split(' '), word[0].upper() + word[1:].lower()"
  },

  // ─── Bug 7: Recursive function with wrong base case (hard) ───
  {
    name: "flatten_list",
    difficulty: "hard",
    bugDescription: "1) Base case checks for dict instead of list 2) Recursive call passes wrong variable",
    buggyCode: `def flatten_list(nested):
    """Flatten a nested list into a single list. E.g. [1,[2,[3]],4] -> [1,2,3,4]"""
    result = []
    for item in nested:
        if isinstance(item, dict):
            result.extend(flatten_list(nested))
        else:
            result.append(item)
    return result`,
    validation: "from tasks.bug_flatten_list import flatten_list; assert flatten_list([1,[2,[3]],4])==[1,2,3,4]; assert flatten_list([[1,2],[3,[4,5]]])==[1,2,3,4,5]; assert flatten_list([1,2,3])==[1,2,3]; print('PASS')",
    expectedFix: "isinstance(item, list), flatten_list(item)"
  },

  // ─── Bug 8: Dictionary comprehension with multiple bugs (hard) ───
  {
    name: "word_count",
    difficulty: "hard",
    bugDescription: "1) Doesn't lowercase 2) Doesn't strip punctuation 3) Returns list instead of dict",
    buggyCode: `def word_count(text):
    """Count word frequency. Ignore case and punctuation. Return dict."""
    words = text.split()
    counts = []
    for word in words:
        if word in counts:
            counts[word] += 1
        else:
            counts[word] = 1
    return counts`,
    validation: "from tasks.bug_word_count import word_count; r = word_count('The cat and the dog.'); assert r['the']==2, f'got {r}'; assert r['cat']==1; assert 'dog' in r; print('PASS')",
    expectedFix: "counts = {}, word.lower().strip('.,!?;:')"
  },

  // ─── Bug 9: Class with init bug + method error (hard) ───
  {
    name: "stack",
    difficulty: "hard",
    bugDescription: "1) __init__ doesn't initialize items 2) pop returns wrong index 3) peek is missing",
    buggyCode: `class Stack:
    """A simple stack implementation."""

    def __init__(self):
        pass

    def push(self, item):
        self.items.append(item)

    def pop(self):
        if self.is_empty():
            return None
        return self.items.pop(0)

    def is_empty(self):
        return len(self.items) == 0

    def size(self):
        return len(self.items)`,
    validation: "from tasks.bug_stack import Stack; s=Stack(); s.push(1); s.push(2); s.push(3); assert s.pop()==3; assert s.size()==2; assert s.peek()==2; assert not s.is_empty(); print('PASS')",
    expectedFix: "self.items = [], pop(-1) or pop(), add peek() method"
  },

  // ─── Bug 10: Algorithm with subtle logic error (hard) ───
  {
    name: "binary_search",
    difficulty: "hard",
    bugDescription: "1) Integer overflow in mid calculation 2) Wrong comparison direction 3) Off-by-one in boundary update",
    buggyCode: `def binary_search(arr, target):
    """Return index of target in sorted array, or -1 if not found."""
    left = 0
    right = len(arr)
    while left < right:
        mid = (left + right) / 2
        if arr[mid] == target:
            return mid
        elif arr[mid] > target:
            left = mid
        else:
            right = mid
    return -1`,
    validation: "from tasks.bug_binary_search import binary_search; assert binary_search([1,2,3,4,5],3)==2; assert binary_search([1,2,3,4,5],1)==0; assert binary_search([1,2,3,4,5],5)==4; assert binary_search([1,2,3,4,5],6)==-1; assert binary_search([],1)==-1; print('PASS')",
    expectedFix: "mid = (left + right) // 2, fix comparison directions, left = mid + 1, right = mid - 1, right = len(arr) - 1, while left <= right"
  }
];

async function resetSystem() {
  console.log('\u{1f504} Resetting system...');
  try {
    await fetch(`${API_BASE}/agents/reset-all`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
  } catch (e) {}

  const { execSync } = require('child_process');
  try {
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/bug_*.py /app/workspace/_v.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe', shell: 'cmd.exe' });
  } catch (e) {}

  await sleep(2000);
  console.log('   \u2713 System reset\n');
}

async function createBuggyFile(bug) {
  const { execSync } = require('child_process');
  const fileName = `bug_${bug.name}`;
  // Write via Python inside container using cmd.exe shell to avoid Git Bash path translation
  const b64 = Buffer.from(bug.buggyCode).toString('base64');
  execSync(`docker exec abcc-agents python -c "import base64;open('/app/workspace/tasks/${fileName}.py','w').write(base64.b64decode('${b64}').decode())"`, { stdio: 'pipe', shell: 'cmd.exe' });
}

async function createTask(bug) {
  const fileName = `bug_${bug.name}`;
  const description = `There is a buggy Python file at tasks/${fileName}.py that needs to be fixed.

Step 1: Read the file tasks/${fileName}.py to understand the current code
Step 2: Find ALL bugs in the code (there may be multiple)
Step 3: Fix the bugs using file_write to rewrite the file
Step 4: Make sure the fixed code passes this test:
   ${bug.validation}

The function/class must work correctly for all test cases. Fix ALL bugs, not just one.`;

  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      title: `[BUGFIX-${bug.difficulty.toUpperCase()}] Fix ${bug.name}`,
      description,
      expectedOutput: `File tasks/${fileName}.py fixed and passing validation`,
      taskType: 'code',
      priority: bug.difficulty === 'easy' ? 3 : bug.difficulty === 'medium' ? 5 : 7,
      maxIterations: 8,
      validationCommand: bug.validation
    })
  });

  if (!response.ok) throw new Error(`Failed to create task: ${response.status}`);
  const created = await response.json();
  // Attach the full description for the execute call
  created._fullDescription = description;
  return created;
}

async function executeTask(taskId, description) {
  return fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: 'coder-01',
      task_description: description,
      use_claude: false,
      model: `ollama/${MODEL}`
    })
  });
}

async function waitForAgent(maxWaitMs = 60000) {
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
    // Two-step: write b64-encoded script to container, then execute
    const fullScript = `import sys\nsys.path.insert(0, '/app/workspace')\n${validation}`;
    const b64 = Buffer.from(fullScript).toString('base64');
    // Step 1: Write script file using Python b64 decode (single line, no quoting issues)
    const writeCmd = `docker exec abcc-agents python -c "import base64;open('/app/workspace/_v.py','w').write(base64.b64decode('${b64}').decode())"`;
    execSync(writeCmd, { stdio: 'pipe', shell: 'cmd.exe' });
    // Step 2: Execute the written script
    const result = execSync(`docker exec abcc-agents python /app/workspace/_v.py`, {
      encoding: 'utf8',
      timeout: 15000,
      shell: 'cmd.exe'
    });
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

function difficultyColor(d) {
  if (d === 'easy') return '\x1b[32m';    // Green
  if (d === 'medium') return '\x1b[33m';  // Yellow
  return '\x1b[31m';                       // Red
}
const RESET = '\x1b[0m';

async function main() {
  // In quick mode, pick 1 easy + 1 medium + 1 hard for a fast pilot run
  const activeBugs = QUICK_MODE
    ? [
        BUGS.find(b => b.difficulty === 'easy'),       // sum_range (off-by-one)
        BUGS.find(b => b.difficulty === 'medium'),      // safe_divide (syntax + logic)
        BUGS.find(b => b.difficulty === 'hard'),        // flatten_list (recursive bugs)
      ].filter(Boolean)
    : BUGS;

  console.log('\u2550'.repeat(70));
  console.log('\u{1f9ea} QUALITY COMPARISON TEST - BUG FIXING CHALLENGE');
  console.log('\u2550'.repeat(70));
  console.log(`Model: ${MODEL}`);
  console.log(`Mode: ${QUICK_MODE ? 'QUICK (3 tasks)' : 'FULL (10 tasks)'}`);
  console.log(`Bugs: ${activeBugs.length} (${activeBugs.filter(b=>b.difficulty==='easy').length} easy, ${activeBugs.filter(b=>b.difficulty==='medium').length} medium, ${activeBugs.filter(b=>b.difficulty==='hard').length} hard)`);
  console.log(`Timeout: ${TASK_TIMEOUT_MS/1000}s per task`);
  console.log('\u2550'.repeat(70) + '\n');

  await resetSystem();

  const results = {
    model: MODEL,
    total: activeBugs.length,
    passed: 0,
    failed: 0,
    errors: 0,
    byDifficulty: { easy: { total: 0, passed: 0 }, medium: { total: 0, passed: 0 }, hard: { total: 0, passed: 0 } },
    details: []
  };

  const startTime = Date.now();

  for (let i = 0; i < activeBugs.length; i++) {
    const bug = activeBugs[i];
    const taskNum = i + 1;
    const color = difficultyColor(bug.difficulty);

    console.log(`\n[${taskNum}/${activeBugs.length}] ${color}${bug.difficulty.toUpperCase()}${RESET} - ${bug.name}`);
    console.log(`   Bugs: ${bug.bugDescription}`);
    console.log('\u2500'.repeat(60));

    const taskStart = Date.now();
    let status = 'error';
    let error = null;

    results.byDifficulty[bug.difficulty].total++;

    try {
      // Create the buggy file
      await createBuggyFile(bug);
      console.log('   \u{1f41b} Buggy file created');

      // Create and assign task
      const created = await createTask(bug);
      console.log(`   \u{1f4cb} Task: ${created.id.substring(0, 8)}...`);

      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      // Execute with timeout
      console.log(`   \u{1f527} Fixing with ${MODEL}...`);
      const execPromise = executeTask(created.id, created._fullDescription);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task timed out')), TASK_TIMEOUT_MS)
      );

      const execResponse = await Promise.race([execPromise, timeoutPromise]);
      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (!execResponse.ok) {
        throw new Error(`Execution failed: ${(await execResponse.text()).substring(0, 100)}`);
      }

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
      console.log('   \u{1f50d} Validating fix...');
      const passed = await runValidation(bug.validation);

      if (passed) {
        status = 'passed';
        results.passed++;
        results.byDifficulty[bug.difficulty].passed++;
        console.log(`   ${color}\u2705 FIXED${RESET} (${duration}s)`);
      } else {
        status = 'failed';
        results.failed++;
        console.log(`   ${color}\u274c NOT FIXED${RESET} (${duration}s)`);

        // Show what the model produced
        try {
          const { execSync } = require('child_process');
          const content = execSync(`docker exec abcc-agents python -c "print(open('/app/workspace/tasks/bug_${bug.name}.py').read())"`, { encoding: 'utf8', shell: 'cmd.exe' });
          console.log(`   \u{1f4c4} Model output:\n${content.split('\n').map(l => '      ' + l).join('\n')}`);
        } catch (e) {}
      }

      await waitForAgent();

    } catch (e) {
      error = e.message;
      results.errors++;
      const duration = Math.floor((Date.now() - taskStart) / 1000);
      console.log(`   \u{1f4a5} ERROR: ${e.message.substring(0, 80)} (${duration}s)`);

      try {
        await fetch(`${API_BASE}/agents/reset-all`, {
          method: 'POST',
          headers: { 'X-API-Key': API_KEY }
        });
      } catch (resetErr) {}
      await sleep(3000);
    }

    results.details.push({
      bug: bug.name,
      difficulty: bug.difficulty,
      bugDescription: bug.bugDescription,
      status,
      error,
      duration: Math.floor((Date.now() - taskStart) / 1000)
    });

    // Rest between tasks
    if (i < activeBugs.length - 1) {
      console.log(`   \u{1f4a4} Resting ${REST_DELAY_MS/1000}s...`);
      await sleep(REST_DELAY_MS);
    }

    // Reset agent memory periodically
    if ((i + 1) % RESET_EVERY_N_TASKS === 0 && i < activeBugs.length - 1) {
      console.log(`\n\u{1f504} Resetting agent context...`);
      try {
        await fetch(`${API_BASE}/agents/reset-all`, {
          method: 'POST',
          headers: { 'X-API-Key': API_KEY }
        });
      } catch (e) {}
      await sleep(1000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  const totalDuration = Math.floor((Date.now() - startTime) / 1000);
  const successRate = Math.round((results.passed / results.total) * 100);

  console.log('\n' + '\u2550'.repeat(70));
  console.log(`\u{1f4ca} QUALITY TEST RESULTS - ${MODEL}`);
  console.log('\u2550'.repeat(70));
  console.log(`   Model:    ${MODEL}`);
  console.log(`   Fixed:    ${results.passed}/${results.total} bugs (${successRate}%)`);
  console.log(`   Duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);
  console.log(`   Avg time: ${Math.round(totalDuration / activeBugs.length)}s per bug`);

  console.log('\n\u{1f4c8} BY DIFFICULTY:');
  console.log('\u2500'.repeat(50));
  for (const diff of ['easy', 'medium', 'hard']) {
    const s = results.byDifficulty[diff];
    if (s.total === 0) continue;
    const rate = Math.round((s.passed / s.total) * 100);
    const bar = '\u2588'.repeat(Math.floor(rate / 10)) + '\u2591'.repeat(10 - Math.floor(rate / 10));
    const color = difficultyColor(diff);
    console.log(`   ${diff.padEnd(8)}: ${color}${bar}${RESET} ${rate}% (${s.passed}/${s.total})`);
  }

  console.log('\n\u{1f4dd} DETAILED RESULTS:');
  console.log('\u2500'.repeat(50));
  for (const d of results.details) {
    const icon = d.status === 'passed' ? '\u2705' : d.status === 'failed' ? '\u274c' : '\u{1f4a5}';
    const color = difficultyColor(d.difficulty);
    console.log(`   ${icon} ${color}${d.difficulty.padEnd(7)}${RESET} ${d.bug.padEnd(20)} ${d.duration}s ${d.error ? '(' + d.error.substring(0, 40) + ')' : ''}`);
  }

  console.log('\u2550'.repeat(70));

  // Save results
  const fs = require('fs');
  const outputFile = `scripts/quality-results-${MODEL.replace(/[/:]/g, '-')}.json`;
  fs.writeFileSync(outputFile, JSON.stringify({ ...results, totalDuration, successRate }, null, 2));
  console.log(`\n\u{1f4be} Results saved to ${outputFile}`);

  return results;
}

main()
  .then(results => process.exit(results.failed + results.errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
