#!/usr/bin/env node

/**
 * Create 20 simple test tasks for comparing Ollama models
 * Target complexity: 2-3 (simple tasks)
 */

const API_URL = 'http://localhost:3001/api/tasks';

const testTasks = [
  // === MATH FUNCTIONS (1-4) ===
  {
    title: '[TEST-v1] Create add function',
    description: 'Create a Python function `add(a, b)` that returns the sum of two numbers. Save to tasks/math_add.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function returns correct sum: add(2, 3) == 5, add(-1, 1) == 0',
    validationCommand: 'python -c "from tasks.math_add import add; assert add(2,3)==5; assert add(-1,1)==0; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create multiply function',
    description: 'Create a Python function `multiply(a, b)` that returns the product of two numbers. Save to tasks/math_multiply.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function returns correct product: multiply(3, 4) == 12, multiply(0, 5) == 0',
    validationCommand: 'python -c "from tasks.math_multiply import multiply; assert multiply(3,4)==12; assert multiply(0,5)==0; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create factorial function',
    description: 'Create a Python function `factorial(n)` that returns n! (factorial). Handle n=0 returning 1. Save to tasks/math_factorial.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function returns correct factorial: factorial(5) == 120, factorial(0) == 1',
    validationCommand: 'python -c "from tasks.math_factorial import factorial; assert factorial(5)==120; assert factorial(0)==1; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create is_prime function',
    description: 'Create a Python function `is_prime(n)` that returns True if n is prime, False otherwise. Save to tasks/math_prime.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function correctly identifies primes: is_prime(7) == True, is_prime(4) == False, is_prime(2) == True',
    validationCommand: 'python -c "from tasks.math_prime import is_prime; assert is_prime(7)==True; assert is_prime(4)==False; assert is_prime(2)==True; print(\'PASS\')"',
  },

  // === STRING OPERATIONS (5-8) ===
  {
    title: '[TEST-v1] Create reverse_string function',
    description: 'Create a Python function `reverse_string(s)` that returns the reversed string. Save to tasks/str_reverse.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function reverses correctly: reverse_string("hello") == "olleh"',
    validationCommand: 'python -c "from tasks.str_reverse import reverse_string; assert reverse_string(\'hello\')==\'olleh\'; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create count_vowels function',
    description: 'Create a Python function `count_vowels(s)` that counts vowels (a,e,i,o,u) in a string, case-insensitive. Save to tasks/str_vowels.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function counts vowels: count_vowels("Hello World") == 3',
    validationCommand: 'python -c "from tasks.str_vowels import count_vowels; assert count_vowels(\'Hello World\')==3; assert count_vowels(\'xyz\')==0; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create is_palindrome function',
    description: 'Create a Python function `is_palindrome(s)` that returns True if string is a palindrome (ignore case and spaces). Save to tasks/str_palindrome.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function detects palindromes: is_palindrome("racecar") == True, is_palindrome("hello") == False',
    validationCommand: 'python -c "from tasks.str_palindrome import is_palindrome; assert is_palindrome(\'racecar\')==True; assert is_palindrome(\'hello\')==False; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create capitalize_words function',
    description: 'Create a Python function `capitalize_words(s)` that capitalizes the first letter of each word. Save to tasks/str_capitalize.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function capitalizes: capitalize_words("hello world") == "Hello World"',
    validationCommand: 'python -c "from tasks.str_capitalize import capitalize_words; assert capitalize_words(\'hello world\')==\'Hello World\'; print(\'PASS\')"',
  },

  // === LIST OPERATIONS (9-12) ===
  {
    title: '[TEST-v1] Create sum_list function',
    description: 'Create a Python function `sum_list(numbers)` that returns the sum of all numbers in a list. Save to tasks/list_sum.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function sums correctly: sum_list([1,2,3,4,5]) == 15',
    validationCommand: 'python -c "from tasks.list_sum import sum_list; assert sum_list([1,2,3,4,5])==15; assert sum_list([])==0; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create find_max function',
    description: 'Create a Python function `find_max(numbers)` that returns the maximum value in a list. Return None for empty list. Save to tasks/list_max.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function finds max: find_max([3,1,4,1,5]) == 5, find_max([]) == None',
    validationCommand: 'python -c "from tasks.list_max import find_max; assert find_max([3,1,4,1,5])==5; assert find_max([])==None; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create filter_evens function',
    description: 'Create a Python function `filter_evens(numbers)` that returns a new list with only even numbers. Save to tasks/list_evens.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function filters evens: filter_evens([1,2,3,4,5,6]) == [2,4,6]',
    validationCommand: 'python -c "from tasks.list_evens import filter_evens; assert filter_evens([1,2,3,4,5,6])==[2,4,6]; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create remove_duplicates function',
    description: 'Create a Python function `remove_duplicates(items)` that returns a new list with duplicates removed, preserving order. Save to tasks/list_dedup.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function removes duplicates: remove_duplicates([1,2,2,3,1]) == [1,2,3]',
    validationCommand: 'python -c "from tasks.list_dedup import remove_duplicates; assert remove_duplicates([1,2,2,3,1])==[1,2,3]; print(\'PASS\')"',
  },

  // === DATA CONVERSION (13-16) ===
  {
    title: '[TEST-v1] Create celsius_to_fahrenheit function',
    description: 'Create a Python function `celsius_to_fahrenheit(c)` that converts Celsius to Fahrenheit using F = C * 9/5 + 32. Save to tasks/conv_temp.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function converts: celsius_to_fahrenheit(0) == 32, celsius_to_fahrenheit(100) == 212',
    validationCommand: 'python -c "from tasks.conv_temp import celsius_to_fahrenheit; assert celsius_to_fahrenheit(0)==32; assert celsius_to_fahrenheit(100)==212; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create miles_to_km function',
    description: 'Create a Python function `miles_to_km(miles)` that converts miles to kilometers (1 mile = 1.60934 km). Round to 2 decimal places. Save to tasks/conv_distance.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function converts: miles_to_km(1) == 1.61, miles_to_km(5) == 8.05',
    validationCommand: 'python -c "from tasks.conv_distance import miles_to_km; assert miles_to_km(1)==1.61; assert miles_to_km(5)==8.05; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create seconds_to_time function',
    description: 'Create a Python function `seconds_to_time(seconds)` that converts seconds to "HH:MM:SS" format string. Save to tasks/conv_time.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function converts: seconds_to_time(3661) == "01:01:01", seconds_to_time(0) == "00:00:00"',
    validationCommand: 'python -c "from tasks.conv_time import seconds_to_time; assert seconds_to_time(3661)==\'01:01:01\'; assert seconds_to_time(0)==\'00:00:00\'; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create rgb_to_hex function',
    description: 'Create a Python function `rgb_to_hex(r, g, b)` that converts RGB values (0-255) to hex color string like "#FF0000". Save to tasks/conv_color.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function converts: rgb_to_hex(255, 0, 0) == "#FF0000", rgb_to_hex(0, 255, 0) == "#00FF00"',
    validationCommand: 'python -c "from tasks.conv_color import rgb_to_hex; assert rgb_to_hex(255,0,0)==\'#FF0000\'; assert rgb_to_hex(0,255,0)==\'#00FF00\'; print(\'PASS\')"',
  },

  // === VALIDATION (17-20) ===
  {
    title: '[TEST-v1] Create is_valid_email function',
    description: 'Create a Python function `is_valid_email(email)` that returns True if email has basic valid format (contains @ and . after @). Save to tasks/val_email.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function validates: is_valid_email("test@example.com") == True, is_valid_email("invalid") == False',
    validationCommand: 'python -c "from tasks.val_email import is_valid_email; assert is_valid_email(\'test@example.com\')==True; assert is_valid_email(\'invalid\')==False; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create is_leap_year function',
    description: 'Create a Python function `is_leap_year(year)` that returns True if year is a leap year. Save to tasks/val_leap.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function validates: is_leap_year(2024) == True, is_leap_year(2023) == False, is_leap_year(1900) == False, is_leap_year(2000) == True',
    validationCommand: 'python -c "from tasks.val_leap import is_leap_year; assert is_leap_year(2024)==True; assert is_leap_year(2023)==False; assert is_leap_year(1900)==False; assert is_leap_year(2000)==True; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create is_positive function',
    description: 'Create a Python function `is_positive(n)` that returns True if n > 0, False otherwise. Save to tasks/val_positive.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function validates: is_positive(5) == True, is_positive(0) == False, is_positive(-3) == False',
    validationCommand: 'python -c "from tasks.val_positive import is_positive; assert is_positive(5)==True; assert is_positive(0)==False; assert is_positive(-3)==False; print(\'PASS\')"',
  },
  {
    title: '[TEST-v1] Create validate_password function',
    description: 'Create a Python function `validate_password(pwd)` that returns True if password is at least 8 characters and contains at least one digit. Save to tasks/val_password.py',
    taskType: 'code',
    priority: 5,
    acceptanceCriteria: 'Function validates: validate_password("secure123") == True, validate_password("short1") == False, validate_password("noDIGITS") == False',
    validationCommand: 'python -c "from tasks.val_password import validate_password; assert validate_password(\'secure123\')==True; assert validate_password(\'short1\')==False; assert validate_password(\'noDIGITS\')==False; print(\'PASS\')"',
  },
];

async function createTasks() {
  console.log('🚀 Creating 20 test tasks for model comparison...\n');

  const createdTasks = [];

  for (let i = 0; i < testTasks.length; i++) {
    const task = testTasks[i];
    const taskNum = i + 1;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Task ${taskNum}: ${task.title} - FAILED: ${errorText}`);
        continue;
      }

      const created = await response.json();
      createdTasks.push({ id: created.id, title: created.title });
      console.log(`✅ Task ${taskNum}: ${task.title}`);
      console.log(`   ID: ${created.id}`);

    } catch (error) {
      console.error(`❌ Task ${taskNum}: ${task.title} - ERROR: ${error.message}`);
    }
  }

  // Save task IDs for execution script
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/test-task-ids-v1.json',
    JSON.stringify(createdTasks, null, 2)
  );

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Created ${createdTasks.length}/${testTasks.length} tasks`);
  console.log('💾 Task IDs saved to scripts/test-task-ids-v1.json');
  console.log('='.repeat(60));

  return createdTasks;
}

createTasks()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
