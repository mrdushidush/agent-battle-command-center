#!/usr/bin/env node

/**
 * Grok Integration Test - Mixed Ollama + Grok
 *
 * Validates xAI Grok integration by running 10 tasks:
 *   - 5 Ollama tasks (C1-C5) — baseline, should pass as usual
 *   - 5 Grok tasks (C5-C8)  — same tasks Haiku/Sonnet would handle
 *
 * This test verifies:
 *   1. Grok model string routes correctly through litellm
 *   2. grok-code-fast-1 can complete coding tasks via tool calling
 *   3. Cost tracking works for Grok tier
 *   4. Mixed Ollama+Grok execution works end-to-end
 *
 * Usage:
 *   node scripts/grok-integration-test.js
 *
 * Est. cost: ~$0.02-0.05 (Grok tasks only, $0.20/$1.50 per MTok)
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';
const TASK_TIMEOUT_MS = 5 * 60 * 1000;
const REST_DELAY_MS = 3000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TASKS = [
  // ── OLLAMA TASKS (C1-C5) ─────────────────────────────────────────────
  {
    tier: 'ollama',
    complexity: 1,
    name: 'double',
    description: 'Create tasks/grok_test_double.py with: def double(n): return n * 2',
    code: 'def double(n):\n    return n * 2',
    validation: "from tasks.grok_test_double import double; assert double(5)==10; print('PASS')"
  },
  {
    tier: 'ollama',
    complexity: 2,
    name: 'is_even',
    description: 'Create tasks/grok_test_is_even.py with: def is_even(n): return n % 2 == 0',
    code: 'def is_even(n):\n    return n % 2 == 0',
    validation: "from tasks.grok_test_is_even import is_even; assert is_even(4)==True; assert is_even(3)==False; print('PASS')"
  },
  {
    tier: 'ollama',
    complexity: 3,
    name: 'max_of_three',
    description: 'Create tasks/grok_test_max3.py with function max_of_three(a, b, c) that returns the largest of three numbers',
    code: 'def max_of_three(a, b, c):\n    if a >= b and a >= c:\n        return a\n    if b >= a and b >= c:\n        return b\n    return c',
    validation: "from tasks.grok_test_max3 import max_of_three; assert max_of_three(1,3,2)==3; assert max_of_three(9,5,7)==9; print('PASS')"
  },
  {
    tier: 'ollama',
    complexity: 4,
    name: 'count_vowels',
    description: 'Create tasks/grok_test_vowels.py with function count_vowels(s) that counts vowels (aeiouAEIOU) in a string',
    code: "def count_vowels(s):\n    return sum(1 for c in s if c in 'aeiouAEIOU')",
    validation: "from tasks.grok_test_vowels import count_vowels; assert count_vowels('hello')==2; assert count_vowels('AEIOU')==5; print('PASS')"
  },
  {
    tier: 'ollama',
    complexity: 5,
    name: 'fizzbuzz',
    description: "Create tasks/grok_test_fizzbuzz.py with function fizzbuzz(n) that returns 'Fizz' if n%3==0, 'Buzz' if n%5==0, 'FizzBuzz' if both, else str(n)",
    code: "def fizzbuzz(n):\n    if n % 15 == 0:\n        return 'FizzBuzz'\n    if n % 3 == 0:\n        return 'Fizz'\n    if n % 5 == 0:\n        return 'Buzz'\n    return str(n)",
    validation: "from tasks.grok_test_fizzbuzz import fizzbuzz; assert fizzbuzz(15)=='FizzBuzz'; assert fizzbuzz(9)=='Fizz'; assert fizzbuzz(10)=='Buzz'; assert fizzbuzz(7)=='7'; print('PASS')"
  },

  // ── GROK TASKS (C5-C8) ──────────────────────────────────────────────
  {
    tier: 'grok',
    complexity: 5,
    name: 'palindrome',
    description: 'Create tasks/grok_test_palindrome.py with function is_palindrome(s) that checks if string is same forwards and backwards (case insensitive, ignore spaces)',
    code: "def is_palindrome(s):\n    cleaned = s.lower().replace(' ', '')\n    return cleaned == cleaned[::-1]",
    validation: "from tasks.grok_test_palindrome import is_palindrome; assert is_palindrome('racecar')==True; assert is_palindrome('A man a plan a canal Panama')==True; assert is_palindrome('hello')==False; print('PASS')"
  },
  {
    tier: 'grok',
    complexity: 6,
    name: 'is_prime',
    description: 'Create tasks/grok_test_prime.py with function is_prime(n) that returns True if n is a prime number, False otherwise',
    code: "def is_prime(n):\n    if n < 2:\n        return False\n    if n == 2:\n        return True\n    if n % 2 == 0:\n        return False\n    for i in range(3, int(n**0.5) + 1, 2):\n        if n % i == 0:\n            return False\n    return True",
    validation: "from tasks.grok_test_prime import is_prime; assert is_prime(17)==True; assert is_prime(4)==False; assert is_prime(2)==True; assert is_prime(1)==False; print('PASS')"
  },
  {
    tier: 'grok',
    complexity: 7,
    name: 'fibonacci',
    description: 'Create tasks/grok_test_fib.py with function fibonacci(n) that returns a list of first n Fibonacci numbers',
    code: "def fibonacci(n):\n    if n <= 0:\n        return []\n    if n == 1:\n        return [0]\n    result = [0, 1]\n    while len(result) < n:\n        result.append(result[-1] + result[-2])\n    return result",
    validation: "from tasks.grok_test_fib import fibonacci; assert fibonacci(7)==[0,1,1,2,3,5,8]; assert fibonacci(1)==[0]; print('PASS')"
  },
  {
    tier: 'grok',
    complexity: 7,
    name: 'word_freq',
    description: 'Create tasks/grok_test_wordfreq.py with function word_frequency(text) that returns a dict of word counts (lowercase, split on spaces)',
    code: "def word_frequency(text):\n    words = text.lower().split()\n    freq = {}\n    for word in words:\n        freq[word] = freq.get(word, 0) + 1\n    return freq",
    validation: "from tasks.grok_test_wordfreq import word_frequency; r = word_frequency('the cat and the dog'); assert r['the']==2; assert r['cat']==1; print('PASS')"
  },
  {
    tier: 'grok',
    complexity: 8,
    name: 'merge_sorted',
    description: 'Create tasks/grok_test_merge.py with function merge_sorted(list1, list2) that merges two sorted lists into one sorted list without using sort()',
    code: "def merge_sorted(list1, list2):\n    result = []\n    i, j = 0, 0\n    while i < len(list1) and j < len(list2):\n        if list1[i] <= list2[j]:\n            result.append(list1[i])\n            i += 1\n        else:\n            result.append(list2[j])\n            j += 1\n    result.extend(list1[i:])\n    result.extend(list2[j:])\n    return result",
    validation: "from tasks.grok_test_merge import merge_sorted; assert merge_sorted([1,3,5],[2,4,6])==[1,2,3,4,5,6]; print('PASS')"
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

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
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/grok_test_*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
    console.log('   ✓ Workspace cleaned');
  } catch (e) {
    console.log('   ⚠ Could not clean workspace');
  }
  await sleep(2000);
}

async function createTask(task) {
  const fileName = `grok_test_${task.name}`;
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
      title: `[GROK-TEST-C${task.complexity}] ${task.name} (${task.tier})`,
      description: fullDescription,
      expectedOutput: `File tasks/${fileName}.py created with ${task.name} function`,
      taskType: 'code',
      priority: task.complexity,
      maxIterations: 5,
      validationCommand: `LANG=python ${task.validation}`
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.status}`);
  }
  return response.json();
}

async function executeTask(taskId, task) {
  const isGrok = task.tier === 'grok';

  const body = {
    task_id: taskId,
    agent_id: 'coder-01',
    task_description: task.description,
    use_claude: isGrok,  // use_claude=true triggers non-ollama path
    model: isGrok ? 'grok-code-fast-1' : null,
    allow_fallback: false
  };

  const response = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return response;
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
    const result = execSync(
      `docker exec -w /app/workspace abcc-agents python3 -c "${validation}"`,
      { encoding: 'utf8', timeout: 15000 }
    );
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

function tierColor(tier) {
  return tier === 'grok' ? '\x1b[35m' : '\x1b[36m'; // Magenta for Grok, Cyan for Ollama
}
function tierIcon(tier) {
  return tier === 'grok' ? '🔮' : '🦙';
}
const RESET = '\x1b[0m';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const ollamaTasks = TASKS.filter(t => t.tier === 'ollama');
  const grokTasks = TASKS.filter(t => t.tier === 'grok');

  console.log('═'.repeat(70));
  console.log('🔮 GROK INTEGRATION TEST - Mixed Ollama + Grok');
  console.log('═'.repeat(70));
  console.log(`Ollama tasks: ${ollamaTasks.length} (C1-C5) | FREE`);
  console.log(`Grok tasks:   ${grokTasks.length} (C5-C8) | grok-code-fast-1 (~$0.01 each)`);
  console.log(`Total: ${TASKS.length} tasks | Rest: ${REST_DELAY_MS / 1000}s between tasks`);
  console.log('═'.repeat(70) + '\n');

  // Check Grok availability
  try {
    const health = await fetch(`${AGENTS_BASE}/health`);
    const h = await health.json();
    console.log(`Health: ollama=${h.ollama} | claude=${h.claude} | grok=${h.grok}`);
    if (!h.grok) {
      console.error('❌ Grok not available! Set XAI_API_KEY in .env and rebuild agents.');
      process.exit(1);
    }
    console.log('✅ Grok available\n');
  } catch (e) {
    console.error('❌ Cannot reach agents service:', e.message);
    process.exit(1);
  }

  await resetSystem();

  const results = {
    ollama: { total: 0, passed: 0, failed: 0, errors: 0, times: [] },
    grok: { total: 0, passed: 0, failed: 0, errors: 0, times: [] },
    details: []
  };

  const startTime = Date.now();

  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    const taskNum = i + 1;
    const color = tierColor(task.tier);
    const icon = tierIcon(task.tier);
    const tierResults = results[task.tier];

    console.log(`[${taskNum}/${TASKS.length}] ${color}C${task.complexity}${RESET} ${icon} ${task.tier.toUpperCase()} ${task.name}`);
    console.log('─'.repeat(50));

    const taskStart = Date.now();
    let status = 'error';
    let error = null;
    tierResults.total++;

    try {
      // Create task
      const created = await createTask(task);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      // Assign to agent
      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      // Execute
      console.log(`   Executing with ${task.tier === 'grok' ? 'Grok (grok-code-fast-1)' : 'Ollama'}...`);
      const execResponse = await executeTask(created.id, task);
      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (!execResponse.ok) {
        const errText = await execResponse.text();
        throw new Error(`Execution failed: ${errText.substring(0, 200)}`);
      }

      const execJson = await execResponse.json();
      const execSuccess = Boolean(execJson.success);

      // Log cost for Grok tasks
      if (task.tier === 'grok' && execJson.metrics) {
        const cost = execJson.metrics.api_credits_used || 0;
        console.log(`   Cost: $${cost.toFixed(6)} | Tokens: ${execJson.metrics.input_tokens || 0}in/${execJson.metrics.output_tokens || 0}out`);
      }

      // Mark complete
      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ success: execSuccess })
      });

      // Validate
      console.log('   Validating...');
      const passed = await runValidation(task.validation);

      if (passed) {
        status = 'passed';
        tierResults.passed++;
        tierResults.times.push(duration);
        console.log(`   ${color}✅ PASSED${RESET} (${duration}s)`);
      } else {
        status = 'failed';
        tierResults.failed++;
        console.log(`   ${color}❌ FAILED${RESET} - validation failed (${duration}s)`);
      }

      await waitForAgent();

    } catch (e) {
      error = e.message;
      tierResults.errors++;
      console.log(`   💥 ERROR: ${e.message.substring(0, 100)}`);

      try {
        await fetch(`${API_BASE}/agents/reset-all`, {
          method: 'POST', headers: { 'X-API-Key': API_KEY }
        });
      } catch (_) {}
      await sleep(3000);
    }

    results.details.push({
      task: task.name,
      tier: task.tier,
      complexity: task.complexity,
      status,
      error,
      duration: Math.floor((Date.now() - taskStart) / 1000)
    });

    // Rest between tasks
    if (i < TASKS.length - 1) {
      console.log(`   💤 Resting ${REST_DELAY_MS / 1000}s...`);
      await sleep(REST_DELAY_MS);
    }
  }

  // ── FINAL REPORT ──────────────────────────────────────────────────────
  const totalDuration = Math.floor((Date.now() - startTime) / 1000);
  const totalPassed = results.ollama.passed + results.grok.passed;
  const totalTasks = TASKS.length;
  const successRate = Math.round((totalPassed / totalTasks) * 100);

  const avgOllama = results.ollama.times.length > 0
    ? Math.round(results.ollama.times.reduce((a, b) => a + b, 0) / results.ollama.times.length)
    : 0;
  const avgGrok = results.grok.times.length > 0
    ? Math.round(results.grok.times.reduce((a, b) => a + b, 0) / results.grok.times.length)
    : 0;

  console.log('\n' + '═'.repeat(70));
  console.log('🏆 GROK INTEGRATION TEST RESULTS');
  console.log('═'.repeat(70));
  console.log(`   Total:    ${totalPassed}/${totalTasks} passed (${successRate}%)`);
  console.log(`   Duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);

  console.log('\n📊 BY TIER:');
  console.log('─'.repeat(50));

  const ollamaRate = results.ollama.total > 0 ? Math.round((results.ollama.passed / results.ollama.total) * 100) : 0;
  const grokRate = results.grok.total > 0 ? Math.round((results.grok.passed / results.grok.total) * 100) : 0;

  const ollamaBar = '█'.repeat(Math.floor(ollamaRate / 10)) + '░'.repeat(10 - Math.floor(ollamaRate / 10));
  const grokBar = '█'.repeat(Math.floor(grokRate / 10)) + '░'.repeat(10 - Math.floor(grokRate / 10));

  console.log(`   🦙 Ollama:  ${ollamaBar} ${ollamaRate}% (${results.ollama.passed}/${results.ollama.total}) | avg ${avgOllama}s | FREE`);
  console.log(`   🔮 Grok:    ${grokBar} ${grokRate}% (${results.grok.passed}/${results.grok.total}) | avg ${avgGrok}s | ~$0.01/task`);

  if (results.ollama.errors > 0 || results.grok.errors > 0) {
    console.log(`\n   ⚠ Errors: Ollama=${results.ollama.errors}, Grok=${results.grok.errors}`);
  }

  // Show failures
  const failures = results.details.filter(d => d.status !== 'passed');
  if (failures.length > 0) {
    console.log('\n❌ FAILURES:');
    console.log('─'.repeat(50));
    for (const f of failures) {
      console.log(`   ${tierIcon(f.tier)} ${f.tier} ${f.task} (C${f.complexity}) - ${f.status}${f.error ? ': ' + f.error.substring(0, 60) : ''}`);
    }
  }

  // Verdict
  console.log('\n' + '═'.repeat(70));
  if (grokRate === 100 && ollamaRate >= 80) {
    console.log('🥇 GROK INTEGRATION: VERIFIED — All Grok tasks passed!');
  } else if (grokRate >= 60) {
    console.log('🥈 GROK INTEGRATION: PARTIAL — Some Grok tasks failed');
  } else {
    console.log('🥉 GROK INTEGRATION: NEEDS WORK — Grok pass rate too low');
  }
  console.log('═'.repeat(70));

  // Save results
  const fs = require('fs');
  const resultsFile = `scripts/grok-integration-results-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify({
    ...results,
    totalDuration,
    successRate,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log(`\n💾 Results saved to ${resultsFile}`);

  return { ollamaRate, grokRate, totalPassed, totalTasks };
}

main()
  .then(r => process.exit(r.grokRate < 60 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
