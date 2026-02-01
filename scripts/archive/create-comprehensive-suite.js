#!/usr/bin/env node

/**
 * Comprehensive 30-Task Test Suite (Simplified Filenames)
 * Tests all tiers: Ollama (≤4), Haiku (5-7), Sonnet (≥8)
 */

const TEST_PREFIX = "[TIER-TEST] ";

const tasks = [
  // ============================================
  // TIER 1: SIMPLE TASKS (≤4) → Ollama
  // ============================================

  {
    title: TEST_PREFIX + "Create greet function",
    description: "Create a file tasks/greet.py with a function greet(name) that returns 'Hello, {name}!'",
    taskType: "code",
    priority: 3,
    validationCommand: "python -c \"from tasks.greet import greet; r=greet('World'); print('PASS' if r=='Hello, World!' else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create add function",
    description: "Create tasks/add.py with a function add(a, b) that returns the sum of two numbers.",
    taskType: "code",
    priority: 3,
    validationCommand: "python -c \"from tasks.add import add; print('PASS' if add(5,3)==8 else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create multiply function",
    description: "Create tasks/multiply.py with a function multiply(a, b) that returns the product.",
    taskType: "code",
    priority: 3,
    validationCommand: "python -c \"from tasks.multiply import multiply; print('PASS' if multiply(4,7)==28 else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create is_even function",
    description: "Create tasks/is_even.py with a function is_even(n) that returns True if n is even.",
    taskType: "code",
    priority: 3,
    validationCommand: "python -c \"from tasks.is_even import is_even; print('PASS' if is_even(4)==True and is_even(7)==False else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create square function",
    description: "Create tasks/square.py with a function square(n) that returns n squared.",
    taskType: "code",
    priority: 3,
    validationCommand: "python -c \"from tasks.square import square; print('PASS' if square(5)==25 else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create reverse function",
    description: "Create tasks/reverse.py with a function reverse(s) that returns the reversed string.",
    taskType: "code",
    priority: 4,
    validationCommand: "python -c \"from tasks.reverse import reverse; print('PASS' if reverse('hello')=='olleh' else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create length function",
    description: "Create tasks/length.py with a function length(s) that returns the length of a string.",
    taskType: "code",
    priority: 4,
    validationCommand: "python -c \"from tasks.length import length; print('PASS' if length('hello')==5 else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create sum_list function",
    description: "Create tasks/sum_list.py with a function sum_list(numbers) that returns the sum of a list.",
    taskType: "code",
    priority: 4,
    validationCommand: "python -c \"from tasks.sum_list import sum_list; print('PASS' if sum_list([1,2,3,4])==10 else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create find_max function",
    description: "Create tasks/find_max.py with a function find_max(numbers) that returns the largest number.",
    taskType: "code",
    priority: 4,
    validationCommand: "python -c \"from tasks.find_max import find_max; print('PASS' if find_max([3,7,2,9,1])==9 else 'FAIL')\"",
    maxIterations: 5
  },
  {
    title: TEST_PREFIX + "Create factorial function",
    description: "Create tasks/factorial.py with a function factorial(n) that returns n factorial.",
    taskType: "code",
    priority: 5,
    validationCommand: "python -c \"from tasks.factorial import factorial; print('PASS' if factorial(5)==120 else 'FAIL')\"",
    maxIterations: 5
  },

  // ============================================
  // TIER 2: MEDIUM TASKS (5-7) → Haiku
  // ============================================

  {
    title: TEST_PREFIX + "Create is_prime with edge cases",
    description: "Step 1: Create tasks/is_prime.py with is_prime(n) function.\nStep 2: Return True if n is prime.\nStep 3: Handle edge cases: n<=1 returns False, n==2 returns True.\nStep 4: Verify implementation.",
    taskType: "code",
    priority: 6,
    validationCommand: "python -c \"from tasks.is_prime import is_prime; print('PASS' if is_prime(17)==True and is_prime(4)==False and is_prime(2)==True else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create palindrome checker",
    description: "Step 1: Create tasks/palindrome.py with is_palindrome(s) function.\nStep 2: Return True if s is a palindrome.\nStep 3: Ignore case and spaces.\nStep 4: Test with 'A man a plan a canal Panama'.\nStep 5: Verify.",
    taskType: "code",
    priority: 6,
    validationCommand: "python -c \"from tasks.palindrome import is_palindrome; print('PASS' if is_palindrome('A man a plan a canal Panama')==True else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create fizzbuzz function",
    description: "Step 1: Create tasks/fizzbuzz.py with fizzbuzz(n) function.\nStep 2: Return 'Fizz' if divisible by 3.\nStep 3: Return 'Buzz' if divisible by 5.\nStep 4: Return 'FizzBuzz' if divisible by both.\nStep 5: Return str(n) otherwise.",
    taskType: "code",
    priority: 6,
    validationCommand: "python -c \"from tasks.fizzbuzz import fizzbuzz; print('PASS' if fizzbuzz(15)=='FizzBuzz' and fizzbuzz(9)=='Fizz' else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create word counter",
    description: "Step 1: Create tasks/word_count.py with word_count(text) function.\nStep 2: Return a dict with word frequencies.\nStep 3: Convert words to lowercase.\nStep 4: Test with sample text.\nStep 5: Verify counts are correct.",
    taskType: "code",
    priority: 6,
    validationCommand: "python -c \"from tasks.word_count import word_count; r=word_count('hello world hello'); print('PASS' if r.get('hello')==2 else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create temperature converter",
    description: "Step 1: Create tasks/temp_convert.py.\nStep 2: Add celsius_to_fahrenheit(c) function.\nStep 3: Add fahrenheit_to_celsius(f) function.\nStep 4: Use formula: F = C * 9/5 + 32.\nStep 5: Test with 0°C = 32°F.",
    taskType: "code",
    priority: 6,
    validationCommand: "python -c \"from tasks.temp_convert import celsius_to_fahrenheit; print('PASS' if celsius_to_fahrenheit(0)==32 else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create dedup function preserving order",
    description: "Step 1: Create tasks/dedup.py with remove_duplicates(lst) function.\nStep 2: Remove duplicate elements from list.\nStep 3: Preserve original order of first occurrences.\nStep 4: Test with [1,2,2,3,1,4].\nStep 5: Should return [1,2,3,4].",
    taskType: "code",
    priority: 7,
    validationCommand: "python -c \"from tasks.dedup import remove_duplicates; print('PASS' if remove_duplicates([1,2,2,3,1,4])==[1,2,3,4] else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create binary search function",
    description: "Step 1: Create tasks/binary_search.py with binary_search(arr, target) function.\nStep 2: Return index of target in sorted array.\nStep 3: Return -1 if not found.\nStep 4: Do not use built-in search.\nStep 5: Test with [1,3,5,7,9] finding 5.",
    taskType: "code",
    priority: 7,
    validationCommand: "python -c \"from tasks.binary_search import binary_search; print('PASS' if binary_search([1,3,5,7,9],5)==2 else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create anagram checker",
    description: "Step 1: Create tasks/anagram.py with is_anagram(s1, s2) function.\nStep 2: Return True if s1 and s2 are anagrams.\nStep 3: Ignore case and spaces.\nStep 4: Test 'listen' vs 'silent'.\nStep 5: Should return True.",
    taskType: "code",
    priority: 7,
    validationCommand: "python -c \"from tasks.anagram import is_anagram; print('PASS' if is_anagram('listen','silent')==True else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create flatten function",
    description: "Step 1: Create tasks/flatten.py with flatten(nested) function.\nStep 2: Recursively flatten nested lists.\nStep 3: Example: [[1,2],[3,[4,5]]] becomes [1,2,3,4,5].\nStep 4: Handle arbitrary nesting depth.\nStep 5: Verify with test case.",
    taskType: "code",
    priority: 7,
    validationCommand: "python -c \"from tasks.flatten import flatten; print('PASS' if flatten([[1,2],[3,[4,5]]])==[1,2,3,4,5] else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create email validator",
    description: "Step 1: Create tasks/email_validator.py with is_valid_email(email) function.\nStep 2: Validate email format using regex.\nStep 3: Must have @ and domain with dot.\nStep 4: Test valid and invalid emails.\nStep 5: Verify edge cases.",
    taskType: "code",
    priority: 7,
    validationCommand: "python -c \"from tasks.email_validator import is_valid_email; print('PASS' if is_valid_email('test@example.com')==True and is_valid_email('invalid')==False else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create merge sorted lists",
    description: "Step 1: Create tasks/merge_sorted.py with merge_sorted(list1, list2) function.\nStep 2: Merge two sorted lists into one sorted list.\nStep 3: Do not use sort().\nStep 4: Test with [1,3,5] and [2,4,6].\nStep 5: Result should be [1,2,3,4,5,6].",
    taskType: "code",
    priority: 8,
    validationCommand: "python -c \"from tasks.merge_sorted import merge_sorted; print('PASS' if merge_sorted([1,3,5],[2,4,6])==[1,2,3,4,5,6] else 'FAIL')\"",
    maxIterations: 7
  },
  {
    title: TEST_PREFIX + "Create password validator",
    description: "Step 1: Create tasks/password_validator.py with validate_password(pwd) function.\nStep 2: Return True if password has 8+ chars.\nStep 3: Must have uppercase, lowercase, digit.\nStep 4: Must have special character.\nStep 5: Test 'Passw0rd!' should pass.",
    taskType: "code",
    priority: 8,
    validationCommand: "python -c \"from tasks.password_validator import validate_password; print('PASS' if validate_password('Passw0rd!')==True and validate_password('weak')==False else 'FAIL')\"",
    maxIterations: 7
  },

  // ============================================
  // TIER 3: COMPLEX TASKS (≥8) → Sonnet
  // ============================================

  {
    title: TEST_PREFIX + "Implement LRU Cache class",
    description: "Step 1: Create tasks/lru_cache.py with LRUCache class.\nStep 2: Constructor takes capacity parameter.\nStep 3: Implement get(key) returning value or -1.\nStep 4: Implement put(key, value) for insert/update.\nStep 5: When capacity exceeded, remove least recently used.\nStep 6: Test with capacity 2.",
    taskType: "code",
    priority: 9,
    validationCommand: "python -c \"from tasks.lru_cache import LRUCache; c=LRUCache(2); c.put(1,1); c.put(2,2); print('PASS' if c.get(1)==1 else 'FAIL')\"",
    maxIterations: 10
  },
  {
    title: TEST_PREFIX + "Implement rate limiter",
    description: "Step 1: Create tasks/rate_limiter.py with RateLimiter class.\nStep 2: Constructor takes max_requests and time_window.\nStep 3: Implement allow_request() returning True if allowed.\nStep 4: Track request timestamps.\nStep 5: Reject if too many requests in window.\nStep 6: Test with max 2 requests.",
    taskType: "code",
    priority: 9,
    validationCommand: "python -c \"from tasks.rate_limiter import RateLimiter; r=RateLimiter(2,60); print('PASS' if r.allow_request()==True and r.allow_request()==True and r.allow_request()==False else 'FAIL')\"",
    maxIterations: 10
  },
  {
    title: TEST_PREFIX + "Create expression evaluator",
    description: "Step 1: Create tasks/expr_eval.py with evaluate(expr) function.\nStep 2: Evaluate math expression string with +, -, *, /.\nStep 3: Support parentheses for grouping.\nStep 4: '2 + 3 * 4' should return 14.\nStep 5: '(2 + 3) * 4' should return 20.\nStep 6: Handle operator precedence.",
    taskType: "code",
    priority: 9,
    validationCommand: "python -c \"from tasks.expr_eval import evaluate; print('PASS' if evaluate('2 + 3 * 4')==14 else 'FAIL')\"",
    maxIterations: 10
  },
  {
    title: TEST_PREFIX + "Implement Trie data structure",
    description: "Step 1: Create tasks/trie.py with Trie class.\nStep 2: Implement insert(word) method.\nStep 3: Implement search(word) returning bool.\nStep 4: Implement starts_with(prefix) returning bool.\nStep 5: Test inserting 'apple' and searching.\nStep 6: Verify prefix matching works.",
    taskType: "code",
    priority: 9,
    validationCommand: "python -c \"from tasks.trie import Trie; t=Trie(); t.insert('apple'); print('PASS' if t.search('apple')==True and t.starts_with('app')==True else 'FAIL')\"",
    maxIterations: 10
  },
  {
    title: TEST_PREFIX + "Create JSON path query",
    description: "Step 1: Create tasks/json_path.py with json_query(data, path) function.\nStep 2: Extract values using dot notation paths.\nStep 3: Support array indexing like 'users[0].name'.\nStep 4: Return None if path not found.\nStep 5: Test with nested dict.\nStep 6: Verify array access works.",
    taskType: "code",
    priority: 9,
    validationCommand: "python -c \"from tasks.json_path import json_query; d={'user':{'name':'John'}}; print('PASS' if json_query(d,'user.name')=='John' else 'FAIL')\"",
    maxIterations: 10
  },
  {
    title: TEST_PREFIX + "Implement EventEmitter",
    description: "Step 1: Create tasks/event_emitter.py with EventEmitter class.\nStep 2: Implement on(event, callback) to register handlers.\nStep 3: Implement off(event, callback) to remove handlers.\nStep 4: Implement emit(event, *args) to trigger handlers.\nStep 5: Support multiple handlers per event.\nStep 6: Test with callback receiving args.",
    taskType: "code",
    priority: 9,
    validationCommand: "python -c \"from tasks.event_emitter import EventEmitter; e=EventEmitter(); r=[]; e.on('test',lambda x:r.append(x)); e.emit('test',42); print('PASS' if r==[42] else 'FAIL')\"",
    maxIterations: 10
  },
  {
    title: TEST_PREFIX + "Create retry decorator",
    description: "Step 1: Create tasks/retry.py with retry decorator.\nStep 2: Accept max_attempts and delay parameters.\nStep 3: Retry function on exception.\nStep 4: Use exponential backoff.\nStep 5: Raise last exception if all attempts fail.\nStep 6: Test with function that fails twice then succeeds.",
    taskType: "code",
    priority: 10,
    validationCommand: "python -c \"from tasks.retry import retry; a=[0]; @retry(max_attempts=3,delay=0.01)\\ndef f():\\n  a[0]+=1\\n  if a[0]<3: raise ValueError()\\n  return 'ok'\\nprint('PASS' if f()=='ok' else 'FAIL')\"",
    maxIterations: 10
  },
  {
    title: TEST_PREFIX + "Create dependency resolver",
    description: "Step 1: Create tasks/dep_resolver.py with resolve_dependencies(deps) function.\nStep 2: Input is dict mapping task to list of dependencies.\nStep 3: Return valid execution order (topological sort).\nStep 4: Raise ValueError on circular dependency.\nStep 5: Test with {'c':['a','b'],'b':['a'],'a':[]}.\nStep 6: Result should have a before b before c.",
    taskType: "code",
    priority: 10,
    validationCommand: "python -c \"from tasks.dep_resolver import resolve_dependencies; r=resolve_dependencies({'c':['a','b'],'b':['a'],'a':[]}); print('PASS' if r.index('a')<r.index('b')<r.index('c') else 'FAIL')\"",
    maxIterations: 10
  }
];

async function createTasks() {
  console.log('🚀 Creating 30-task comprehensive suite (simplified filenames)\\n');

  const createdTasks = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    let tier = 'Tier 1 (Ollama)';
    if (i >= 10 && i < 22) tier = 'Tier 2 (Haiku)';
    if (i >= 22) tier = 'Tier 3 (Sonnet)';

    try {
      const response = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });

      const created = await response.json();
      createdTasks.push({ ...created, tier, validationCommand: task.validationCommand });

      console.log(`✅ ${i+1}. ${task.title.substring(15, 50)} → ${tier}`);

    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
    }
  }

  console.log(`\\n📊 Created ${createdTasks.length}/30 tasks`);

  const fs = require('fs');
  fs.writeFileSync(
    'scripts/comprehensive-suite-tasks.json',
    JSON.stringify(createdTasks, null, 2)
  );
  console.log('💾 Saved to scripts/comprehensive-suite-tasks.json');

  return createdTasks;
}

if (require.main === module) {
  createTasks().catch(console.error);
}

module.exports = { createTasks, tasks };
