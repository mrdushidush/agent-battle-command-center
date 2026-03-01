#!/usr/bin/env node

/**
 * Compare qwen2.5-coder:16k vs :32k on identical complex tasks
 *
 * Strategy:
 * - Create identical C8 tasks (complexity 8)
 * - Run one with enforced 16k model
 * - Run same task again with enforced 32k model
 * - Compare results: success rate, time, code quality
 */

const API_BASE = 'http://localhost:3001';

const testTasks = [
  {
    name: 'C8 #1: Implement LRU Cache',
    description: `Implement an LRU (Least Recently Used) Cache class with fixed capacity.

Requirements:
- Constructor accepts maxCapacity parameter
- get(key) method returns value or -1 if missing
- put(key, value) method adds/updates entry
- When capacity exceeded, remove least recently used
- Both get and put operations are O(1) time complexity
- Update access order on get operations
- Return dictionary of all cache entries via entries() method

Validation: cache = LRUCache(2); cache.put(1, 'a'); cache.put(2, 'b'); cache.get(1); cache.put(3, 'c'); print(cache.get(2)) → should be -1`,
    language: 'python',
    validator: `
import base64
exec(base64.b64decode('aW1wb3J0IHN5cyBzeXMucGF0aC5pbnNlcnQoMCwgJy90bXAvdGFza3MnKQpmcm9tIGxydV9jYWNoZSBpbXBvcnQgTFJ1Q2FjaGUKY2FjaGUgPSBMUlVDYWNoZSgyKQpjYWNoZS5wdXQoMSwgJ2EnKQpjYWNoZS5wdXQoMiwgJ2InKQphc3NlcnQgY2FjaGUuZ2V0KDEpID09ICdhJywgJ0ZhaWxlZDogZ2V0KDEpIHNob3VsZCByZXR1cm4gYScKY2FjaGUucHV0KDMsICdjJykKYXNzZXJ0IGNhY2hlLmdldCgyKSA9PSAtMSwgJ0ZhaWxlZDogZ2V0KDIpIHNob3VsZCByZXR1cm4gLTEnCnByaW50KCdMUlVDYWNoZSBwYXNzZWQhJykK').decode())
`.trim(),
  },
  {
    name: 'C8 #2: Implement RPN Calculator',
    description: `Implement a Reverse Polish Notation (RPN) calculator that evaluates expressions.

Requirements:
- Parse input tokens (numbers and operators)
- Support operators: +, -, *, / (with integer division)
- Use stack-based evaluation
- Return final result
- Handle division by zero (raise exception)
- Operators are binary (two operands)

Example: ['2', '1', '+', '3', '*'] → 9 (2+1=3, 3*3=9)`,
    language: 'python',
    validator: `
import sys
sys.path.insert(0, '/tmp/tasks')
from rpn_calculator import RPNCalculator
calc = RPNCalculator()
assert calc.evaluate(['2', '1', '+', '3', '*']) == 9, 'Failed: (2+1)*3 should be 9'
assert calc.evaluate(['15', '7', '1', '1', '-', '/', '+', '3', '*', '2', '1', '1', '+', '+', '-']) == 5, 'Failed: complex expression'
print('RPNCalculator passed!')
`.trim(),
  },
  {
    name: 'C8 #3: Binary Search Tree Operations',
    description: `Implement a Binary Search Tree with common operations.

Requirements:
- insert(value) - add value maintaining BST property
- search(value) - return True if found
- delete(value) - remove node, handle all 3 cases (leaf, one child, two children)
- inorder() - return sorted list via in-order traversal
- height() - return tree height
- is_balanced() - check if height-balanced

All operations maintain BST property: left < parent < right`,
    language: 'python',
    validator: `
import sys
sys.path.insert(0, '/tmp/tasks')
from bst import BinarySearchTree
tree = BinarySearchTree()
for val in [5, 3, 7, 2, 4, 6, 8]:
  tree.insert(val)
assert tree.search(4) == True
assert tree.search(10) == False
assert tree.inorder() == [2, 3, 4, 5, 6, 7, 8]
tree.delete(5)
assert tree.inorder() == [2, 3, 4, 6, 7, 8]
print('BST operations passed!')
`.trim(),
  },
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTask(description, language, complexity, validator) {
  const response = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description,
      language,
      complexity,
      validationCommand: validator,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.statusText}`);
  }

  const task = await response.json();
  return task;
}

async function waitForAgent(agentId, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const response = await fetch(`${API_BASE}/api/agents/${agentId}`);
    const agent = await response.json();
    if (agent.status === 'idle') {
      return true;
    }
    await sleep(500);
  }
  return false;
}

async function executeTask(taskId) {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId: 'coder-01' }),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute task: ${response.statusText}`);
  }

  return response.json();
}

async function completeTask(taskId, success, result) {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success, result }),
  });

  if (!response.ok) {
    throw new Error(`Failed to complete task: ${response.statusText}`);
  }

  return response.json();
}

async function getTaskDetail(taskId) {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}`);
  if (!response.ok) {
    throw new Error(`Failed to get task: ${response.statusText}`);
  }
  return response.json();
}

async function runTest() {
  console.log('\n🧪 Qwen2.5-Coder 16K vs 32K Context Window Comparison\n');
  console.log('='.repeat(80));

  const results = {
    '16k': { passed: 0, failed: 0, avgTime: 0, tasks: [] },
    '32k': { passed: 0, failed: 0, avgTime: 0, tasks: [] },
  };

  for (const testTask of testTasks) {
    console.log(`\n📋 Test: ${testTask.name}`);
    console.log('-'.repeat(80));

    // Test 1: 16K context (C8 task → forces 16k)
    try {
      console.log(`  [16K] Creating task...`);
      const task16k = await createTask(testTask.description, testTask.language, 8, testTask.validator);
      console.log(`  [16K] Task ${task16k.id} created, executing...`);

      const start16k = Date.now();
      const execResult16k = await executeTask(task16k.id);
      console.log(`  [16K] Execution result: success=${execResult16k.success}`);

      await completeTask(task16k.id, execResult16k.success, execResult16k);
      const time16k = Date.now() - start16k;

      const detail16k = await getTaskDetail(task16k.id);
      const success16k = detail16k.status === 'completed' && !detail16k.error;

      results['16k'].tasks.push({
        name: testTask.name,
        success: success16k,
        time: time16k,
        model: 'qwen2.5-coder:16k',
        status: detail16k.status,
        error: detail16k.error,
      });

      if (success16k) {
        results['16k'].passed++;
        console.log(`  ✅ [16K] PASSED in ${(time16k / 1000).toFixed(1)}s`);
      } else {
        results['16k'].failed++;
        console.log(`  ❌ [16K] FAILED: ${detail16k.error}`);
      }

      results['16k'].avgTime += time16k;

      // Wait for agent to be idle
      await waitForAgent('coder-01', 30000);
      await sleep(2000);
    } catch (err) {
      console.log(`  ❌ [16K] Error: ${err.message}`);
      results['16k'].failed++;
    }

    // Test 2: 32K context (C9 task → forces 32k)
    try {
      console.log(`  [32K] Creating task...`);
      const task32k = await createTask(testTask.description, testTask.language, 9, testTask.validator);
      console.log(`  [32K] Task ${task32k.id} created, executing...`);

      const start32k = Date.now();
      const execResult32k = await executeTask(task32k.id);
      console.log(`  [32K] Execution result: success=${execResult32k.success}`);

      await completeTask(task32k.id, execResult32k.success, execResult32k);
      const time32k = Date.now() - start32k;

      const detail32k = await getTaskDetail(task32k.id);
      const success32k = detail32k.status === 'completed' && !detail32k.error;

      results['32k'].tasks.push({
        name: testTask.name,
        success: success32k,
        time: time32k,
        model: 'qwen2.5-coder:32k',
        status: detail32k.status,
        error: detail32k.error,
      });

      if (success32k) {
        results['32k'].passed++;
        console.log(`  ✅ [32K] PASSED in ${(time32k / 1000).toFixed(1)}s`);
      } else {
        results['32k'].failed++;
        console.log(`  ❌ [32K] FAILED: ${detail32k.error}`);
      }

      results['32k'].avgTime += time32k;

      // Wait for agent to be idle
      await waitForAgent('coder-01', 30000);
      await sleep(2000);
    } catch (err) {
      console.log(`  ❌ [32K] Error: ${err.message}`);
      results['32k'].failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS SUMMARY\n');

  console.log('16K Context Window (qwen2.5-coder:16k):');
  console.log(`  ✅ Passed: ${results['16k'].passed}/${results['16k'].passed + results['16k'].failed}`);
  console.log(`  ⏱️  Avg Time: ${(results['16k'].avgTime / (results['16k'].passed + results['16k'].failed) / 1000).toFixed(1)}s`);

  console.log('\n32K Context Window (qwen2.5-coder:32k):');
  console.log(`  ✅ Passed: ${results['32k'].passed}/${results['32k'].passed + results['32k'].failed}`);
  console.log(`  ⏱️  Avg Time: ${(results['32k'].avgTime / (results['32k'].passed + results['32k'].failed) / 1000).toFixed(1)}s`);

  console.log('\n' + '='.repeat(80));
  console.log('📈 DETAILED COMPARISON\n');

  testTasks.forEach((_, idx) => {
    const task16k = results['16k'].tasks[idx];
    const task32k = results['32k'].tasks[idx];

    if (task16k && task32k) {
      console.log(`${task16k.name}:`);
      console.log(`  16K: ${task16k.success ? '✅ PASS' : '❌ FAIL'} (${(task16k.time / 1000).toFixed(1)}s)`);
      console.log(`  32K: ${task32k.success ? '✅ PASS' : '❌ FAIL'} (${(task32k.time / 1000).toFixed(1)}s)`);
      const speedup = (task16k.time / task32k.time).toFixed(2);
      console.log(`  Speed: ${speedup}x (${task16k.time > task32k.time ? '16K faster' : '32K faster'})`);
      console.log('');
    }
  });

  console.log('='.repeat(80) + '\n');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
