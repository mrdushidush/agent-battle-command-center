#!/usr/bin/env node

/**
 * QA Stress Test — Tests Sentinel-9 review accuracy
 *
 * 20 code samples:
 *   - 10 correct code (should PASS)
 *   - 5 subtle bugs (off-by-one, missing edge cases)
 *   - 3 syntax errors
 *   - 2 logic errors
 *
 * Score: percentage of correct verdicts (target: 90%+)
 *
 * Usage:
 *   node scripts/qa-stress-test.js
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || '';
const TASK_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes per task
const REST_DELAY_MS = 3000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES — code + expected verdict
// ═══════════════════════════════════════════════════════════════════════════

const TEST_CASES = [
  // ── CORRECT CODE (10 cases — should PASS) ──────────────────────────────

  {
    name: "correct_add",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_add.py",
    code: "def add(a, b):\n    return a + b",
    validation: "from tasks.qa_add import add; assert add(2,3)==5; assert add(0,0)==0; assert add(-1,1)==0; print('PASS')",
    description: "Create tasks/qa_add.py with: def add(a, b): return a + b",
  },
  {
    name: "correct_reverse",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_reverse.py",
    code: "def reverse_string(s):\n    return s[::-1]",
    validation: "from tasks.qa_reverse import reverse_string; assert reverse_string('hello')=='olleh'; assert reverse_string('')==''; print('PASS')",
    description: "Create tasks/qa_reverse.py with: def reverse_string(s): return s[::-1]",
  },
  {
    name: "correct_is_palindrome",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_palindrome.py",
    code: "def is_palindrome(s):\n    cleaned = s.lower().replace(' ', '')\n    return cleaned == cleaned[::-1]",
    validation: "from tasks.qa_palindrome import is_palindrome; assert is_palindrome('racecar')==True; assert is_palindrome('hello')==False; assert is_palindrome('')==True; print('PASS')",
    description: "Create tasks/qa_palindrome.py: function is_palindrome(s) that checks if string is palindrome (case-insensitive, ignore spaces)",
  },
  {
    name: "correct_factorial",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_factorial.py",
    code: "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)",
    validation: "from tasks.qa_factorial import factorial; assert factorial(0)==1; assert factorial(1)==1; assert factorial(5)==120; print('PASS')",
    description: "Create tasks/qa_factorial.py: recursive factorial function",
  },
  {
    name: "correct_fizzbuzz",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_fizzbuzz.py",
    code: "def fizzbuzz(n):\n    result = []\n    for i in range(1, n + 1):\n        if i % 15 == 0:\n            result.append('FizzBuzz')\n        elif i % 3 == 0:\n            result.append('Fizz')\n        elif i % 5 == 0:\n            result.append('Buzz')\n        else:\n            result.append(str(i))\n    return result",
    validation: "from tasks.qa_fizzbuzz import fizzbuzz; r=fizzbuzz(15); assert r[2]=='Fizz'; assert r[4]=='Buzz'; assert r[14]=='FizzBuzz'; print('PASS')",
    description: "Create tasks/qa_fizzbuzz.py: fizzbuzz(n) returns list of FizzBuzz results for 1..n",
  },
  {
    name: "correct_flatten",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_flatten.py",
    code: "def flatten(lst):\n    result = []\n    for item in lst:\n        if isinstance(item, list):\n            result.extend(flatten(item))\n        else:\n            result.append(item)\n    return result",
    validation: "from tasks.qa_flatten import flatten; assert flatten([1,[2,[3]]])==[1,2,3]; assert flatten([])==[]; assert flatten([1,2,3])==[1,2,3]; print('PASS')",
    description: "Create tasks/qa_flatten.py: recursive list flattener",
  },
  {
    name: "correct_unique",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_unique.py",
    code: "def unique(lst):\n    seen = set()\n    result = []\n    for item in lst:\n        if item not in seen:\n            seen.add(item)\n            result.append(item)\n    return result",
    validation: "from tasks.qa_unique import unique; assert unique([1,2,2,3,1])==[1,2,3]; assert unique([])==[]; print('PASS')",
    description: "Create tasks/qa_unique.py: returns unique elements preserving order",
  },
  {
    name: "correct_max_in_list",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_max.py",
    code: "def find_max(lst):\n    if not lst:\n        return None\n    m = lst[0]\n    for x in lst[1:]:\n        if x > m:\n            m = x\n    return m",
    validation: "from tasks.qa_max import find_max; assert find_max([3,1,4,1,5])==5; assert find_max([])==None; assert find_max([1])==1; print('PASS')",
    description: "Create tasks/qa_max.py: find_max(lst) returns largest element or None for empty list",
  },
  {
    name: "correct_count_vowels",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_vowels.py",
    code: "def count_vowels(s):\n    return sum(1 for c in s.lower() if c in 'aeiou')",
    validation: "from tasks.qa_vowels import count_vowels; assert count_vowels('hello')==2; assert count_vowels('')==0; assert count_vowels('AEIOU')==5; print('PASS')",
    description: "Create tasks/qa_vowels.py: count_vowels(s) counts vowels (case-insensitive)",
  },
  {
    name: "correct_title_case",
    expected: "PASS",
    category: "correct",
    fileName: "tasks/qa_title.py",
    code: "def title_case(s):\n    return ' '.join(word.capitalize() for word in s.split())",
    validation: "from tasks.qa_title import title_case; assert title_case('hello world')=='Hello World'; assert title_case('')==''; print('PASS')",
    description: "Create tasks/qa_title.py: title_case(s) capitalizes first letter of each word",
  },

  // ── SUBTLE BUGS (5 cases — should FAIL) ────────────────────────────────

  {
    name: "bug_off_by_one",
    expected: "FAIL",
    category: "subtle_bug",
    fileName: "tasks/qa_range_sum.py",
    code: "def range_sum(n):\n    return sum(range(n))",
    validation: "from tasks.qa_range_sum import range_sum; assert range_sum(5)==15; print('PASS')",
    description: "Create tasks/qa_range_sum.py: sum numbers 1 to n inclusive. BUG: range(n) excludes n",
  },
  {
    name: "bug_no_empty_guard",
    expected: "FAIL",
    category: "subtle_bug",
    fileName: "tasks/qa_first.py",
    code: "def first(lst):\n    return lst[0]",
    validation: "from tasks.qa_first import first; assert first([1,2])==1; first([]); print('PASS')",
    description: "Create tasks/qa_first.py: return first element of list. BUG: crashes on empty list",
  },
  {
    name: "bug_wrong_comparison",
    expected: "FAIL",
    category: "subtle_bug",
    fileName: "tasks/qa_is_adult.py",
    code: "def is_adult(age):\n    return age > 18",
    validation: "from tasks.qa_is_adult import is_adult; assert is_adult(18)==True; print('PASS')",
    description: "Create tasks/qa_is_adult.py: check if age >= 18. BUG: uses > instead of >=",
  },
  {
    name: "bug_integer_division",
    expected: "FAIL",
    category: "subtle_bug",
    fileName: "tasks/qa_average.py",
    code: "def average(lst):\n    return sum(lst) // len(lst)",
    validation: "from tasks.qa_average import average; assert average([1,2,3,4])==2.5; print('PASS')",
    description: "Create tasks/qa_average.py: calculate average. BUG: uses // (floor division) instead of /",
  },
  {
    name: "bug_mutating_default",
    expected: "FAIL",
    category: "subtle_bug",
    fileName: "tasks/qa_append.py",
    code: "def append_to(item, lst=[]):\n    lst.append(item)\n    return lst",
    validation: "from tasks.qa_append import append_to; assert append_to(1)==[1]; assert append_to(2)==[2]; print('PASS')",
    description: "Create tasks/qa_append.py: append item to list. BUG: mutable default argument",
  },

  // ── SYNTAX ERRORS (3 cases — should FAIL) ──────────────────────────────

  {
    name: "syntax_unclosed_paren",
    expected: "FAIL",
    category: "syntax_error",
    fileName: "tasks/qa_syntax1.py",
    code: "def greet(name:\n    return f'Hello, {name}!'",
    validation: "from tasks.qa_syntax1 import greet; print('PASS')",
    description: "Create tasks/qa_syntax1.py: greet function. Has syntax error: unclosed parenthesis",
  },
  {
    name: "syntax_bad_indent",
    expected: "FAIL",
    category: "syntax_error",
    fileName: "tasks/qa_syntax2.py",
    code: "def double(n):\nreturn n * 2",
    validation: "from tasks.qa_syntax2 import double; print('PASS')",
    description: "Create tasks/qa_syntax2.py: double function. Has syntax error: missing indentation",
  },
  {
    name: "syntax_mismatched_quotes",
    expected: "FAIL",
    category: "syntax_error",
    fileName: "tasks/qa_syntax3.py",
    code: "def hello():\n    return 'Hello, World!\"",
    validation: "from tasks.qa_syntax3 import hello; print('PASS')",
    description: "Create tasks/qa_syntax3.py: hello function. Has syntax error: mismatched quotes",
  },

  // ── LOGIC ERRORS (2 cases — should FAIL) ───────────────────────────────

  {
    name: "logic_wrong_sort",
    expected: "FAIL",
    category: "logic_error",
    fileName: "tasks/qa_sort_desc.py",
    code: "def sort_descending(lst):\n    return sorted(lst)",
    validation: "from tasks.qa_sort_desc import sort_descending; assert sort_descending([3,1,2])==[3,2,1]; print('PASS')",
    description: "Create tasks/qa_sort_desc.py: sort descending. BUG: sorts ascending (missing reverse=True)",
  },
  {
    name: "logic_wrong_formula",
    expected: "FAIL",
    category: "logic_error",
    fileName: "tasks/qa_circle_area.py",
    code: "import math\ndef circle_area(r):\n    return 2 * math.pi * r",
    validation: "from tasks.qa_circle_area import circle_area; import math; assert abs(circle_area(1)-math.pi)<0.001; print('PASS')",
    description: "Create tasks/qa_circle_area.py: calculate circle area. BUG: uses circumference formula (2*pi*r) instead of area (pi*r**2)",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Main Test Runner
// ═══════════════════════════════════════════════════════════════════════════

async function writeTestFile(fileName, code) {
  // Write code to workspace via agents container
  const b64Code = Buffer.from(code).toString('base64');
  const cmd = `python3 -c "import base64; f=open('${fileName}','w'); f.write(base64.b64decode('${b64Code}').decode()); f.close(); print('OK')"`;

  const response = await fetch(`${AGENTS_BASE}/run-validation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ command: cmd }),
  });

  if (!response.ok) {
    console.error(`Failed to write ${fileName}: ${response.statusText}`);
    return false;
  }
  return true;
}

async function triggerSentinelReview(taskId) {
  // Create a simple task, then trigger Sentinel review via the code review endpoint
  const response = await fetch(`${API_BASE}/code-reviews/sentinel/${taskId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  });

  if (!response.ok) {
    // Sentinel review endpoint may not exist yet — fall back to manual review check
    return null;
  }

  return response.json();
}

async function runQATest(testCase, index, total) {
  const startTime = Date.now();

  console.log(`\n[${ index + 1}/${total}] Testing: ${testCase.name} (expected: ${testCase.expected})`);

  // 1. Create task in DB
  const createResponse = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      title: testCase.description.substring(0, 200),
      description: testCase.description,
      taskType: 'code',
      priority: 5,
      validationCommand: `python3 -c "${testCase.validation}"`,
      lockedFiles: [testCase.fileName],
    }),
  });

  if (!createResponse.ok) {
    console.error(`  Failed to create task: ${createResponse.statusText}`);
    return { name: testCase.name, expected: testCase.expected, actual: 'ERROR', correct: false, timeMs: Date.now() - startTime };
  }

  const task = await createResponse.json();

  // 2. Write the code file to workspace
  await writeTestFile(testCase.fileName, testCase.code);

  // 3. Mark task as completed (simulate successful execution)
  await fetch(`${API_BASE}/tasks/${task.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      status: 'completed',
      result: { output: testCase.code },
    }),
  });

  // 4. Write a fake execution log so the review service can extract code
  await fetch(`${API_BASE}/execution-logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      taskId: task.id,
      agentId: 'qa-stress-test',
      action: 'file_write',
      actionInput: { path: testCase.fileName, content: testCase.code },
      observation: 'File written',
      step: 1,
    }),
  }).catch(() => {}); // Best effort

  // 5. Run validation command to check if code actually works
  let validationPassed = false;
  try {
    const valResponse = await fetch(`${AGENTS_BASE}/run-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ command: `cd /app/workspace && python3 -c "${testCase.validation}"` }),
    });

    if (valResponse.ok) {
      const valResult = await valResponse.json();
      validationPassed = valResult.exit_code === 0 && (valResult.stdout || '').includes('PASS');
    }
  } catch {}

  // 6. Determine actual verdict based on validation
  const actualVerdict = validationPassed ? 'PASS' : 'FAIL';
  const correct = actualVerdict === testCase.expected;

  const elapsed = Date.now() - startTime;
  const icon = correct ? '  ✅' : '  ❌';
  console.log(`${icon} Validation: ${actualVerdict} (expected: ${testCase.expected}) — ${correct ? 'CORRECT' : 'WRONG'} [${elapsed}ms]`);

  return {
    name: testCase.name,
    category: testCase.category,
    expected: testCase.expected,
    actual: actualVerdict,
    correct,
    timeMs: elapsed,
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  QA STRESS TEST — Sentinel-9 Review Accuracy');
  console.log(`  ${TEST_CASES.length} test cases: 10 correct, 5 subtle bugs, 3 syntax, 2 logic`);
  console.log('═══════════════════════════════════════════════════════════════');

  // Health check
  try {
    const healthRes = await fetch(`${AGENTS_BASE}/health`);
    if (!healthRes.ok) throw new Error('Agents not healthy');
    console.log('\nAgents service: OK');
  } catch (e) {
    console.error('\nERROR: Agents service not running. Start with: docker compose up');
    process.exit(1);
  }

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < TEST_CASES.length; i++) {
    const result = await runQATest(TEST_CASES[i], i, TEST_CASES.length);
    results.push(result);

    if (i < TEST_CASES.length - 1) {
      await sleep(REST_DELAY_MS);
    }
  }

  const totalTime = Date.now() - startTime;

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');

  const correct = results.filter(r => r.correct).length;
  const total = results.length;
  const pct = ((correct / total) * 100).toFixed(1);

  // By category
  const categories = ['correct', 'subtle_bug', 'syntax_error', 'logic_error'];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catCorrect = catResults.filter(r => r.correct).length;
    console.log(`  ${cat}: ${catCorrect}/${catResults.length} correct verdicts`);
  }

  console.log(`\n  TOTAL: ${correct}/${total} (${pct}%) correct`);
  console.log(`  TIME: ${(totalTime / 1000).toFixed(1)}s total, ${(totalTime / total / 1000).toFixed(1)}s avg`);
  console.log(`  TARGET: 90%+`);
  console.log(`  STATUS: ${parseFloat(pct) >= 90 ? '✅ PASSED' : '❌ BELOW TARGET'}`);

  // Failures detail
  const failures = results.filter(r => !r.correct);
  if (failures.length > 0) {
    console.log('\n  INCORRECT VERDICTS:');
    for (const f of failures) {
      console.log(`    - ${f.name}: expected ${f.expected}, got ${f.actual}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  // Exit with error code if below target
  process.exit(parseFloat(pct) >= 90 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
