#!/usr/bin/env node

/**
 * Ollama 14B Q4_K_S Stress Test - 40 Tasks, Fixed 4K Context
 *
 * Tests qwen2.5-coder:14b-instruct-q4_k_s with 4K context window.
 * Compares against 7B baseline (90% pass rate @ 16K context).
 * Agent reset every 3 tasks for maximum freshness.
 *
 * Model: qwen2.5-coder:14b-instruct-q4_k_s (14.8B params, 8.6GB)
 * Context: 4096 tokens (fixed - VRAM constrained)
 * Quantization: Q4_K_S (smaller/faster than Q4_K_M)
 *
 * Goal: Test if smaller quant + smaller context fits in 8GB VRAM without CPU offload
 *
 * Complexity distribution (40 tasks):
 *   - C1: 3 tasks  (trivial)
 *   - C2: 3 tasks  (trivial)
 *   - C3: 4 tasks  (low)
 *   - C4: 5 tasks  (low)
 *   - C5: 5 tasks  (moderate)
 *   - C6: 5 tasks  (moderate)
 *   - C7: 5 tasks  (complex)
 *   - C8: 5 tasks  (complex)
 *   - C9: 5 tasks  (extreme - NEW!)
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per task
const REST_DELAY_MS = 3000; // 3 seconds rest between tasks
const RESET_EVERY_N_TASKS = 3; // Aggressive reset every 3 tasks

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TASKS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 1: Trivial (single-line, one operation)
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
    complexity: 1,
    name: "square",
    description: "Create tasks/c1_square.py with: def square(n): return n * n",
    code: "def square(n):\n    return n * n",
    validation: "from tasks.c1_square import square; assert square(4)==16; assert square(-3)==9; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 2: Trivial (single-line with formatting/logic)
  // ═══════════════════════════════════════════════════════════════════════════
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
  {
    complexity: 2,
    name: "to_upper",
    description: "Create tasks/c2_to_upper.py with: def to_upper(s): return s.upper()",
    code: "def to_upper(s):\n    return s.upper()",
    validation: "from tasks.c2_to_upper import to_upper; assert to_upper('hello')=='HELLO'; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 3: Low (simple branching)
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
    complexity: 3,
    name: "min_of_three",
    description: "Create tasks/c3_min_of_three.py with function min_of_three(a, b, c) that returns the smallest of three numbers without using min()",
    code: "def min_of_three(a, b, c):\n    smallest = a\n    if b < smallest:\n        smallest = b\n    if c < smallest:\n        smallest = c\n    return smallest",
    validation: "from tasks.c3_min_of_three import min_of_three; assert min_of_three(3,1,2)==1; assert min_of_three(5,5,5)==5; print('PASS')"
  },
  {
    complexity: 3,
    name: "is_leap_year",
    description: "Create tasks/c3_leap_year.py with function is_leap_year(year) that returns True if year is a leap year (divisible by 4, except centuries unless divisible by 400)",
    code: "def is_leap_year(year):\n    if year % 400 == 0:\n        return True\n    if year % 100 == 0:\n        return False\n    if year % 4 == 0:\n        return True\n    return False",
    validation: "from tasks.c3_leap_year import is_leap_year; assert is_leap_year(2000)==True; assert is_leap_year(1900)==False; assert is_leap_year(2024)==True; assert is_leap_year(2023)==False; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 4: Low (loops, string manipulation)
  // ═══════════════════════════════════════════════════════════════════════════
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
  {
    complexity: 4,
    name: "title_case",
    description: "Create tasks/c4_title_case.py with function title_case(s) that capitalizes the first letter of each word in a string",
    code: "def title_case(s):\n    return ' '.join(word.capitalize() for word in s.split())",
    validation: "from tasks.c4_title_case import title_case; assert title_case('hello world')=='Hello World'; assert title_case('foo bar baz')=='Foo Bar Baz'; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 5: Moderate (multiple conditions, string processing)
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
    complexity: 5,
    name: "flatten_list",
    description: "Create tasks/c5_flatten.py with function flatten(nested) that flattens a list one level deep. Example: flatten([[1,2],[3,[4]]]) returns [1,2,3,[4]]",
    code: "def flatten(nested):\n    result = []\n    for item in nested:\n        if isinstance(item, list):\n            result.extend(item)\n        else:\n            result.append(item)\n    return result",
    validation: "from tasks.c5_flatten import flatten; assert flatten([[1,2],[3,4]])==[1,2,3,4]; assert flatten([[1],[2],[3]])==[1,2,3]; assert flatten([1,[2,3]])==[1,2,3]; print('PASS')"
  },
  {
    complexity: 5,
    name: "truncate",
    description: "Create tasks/c5_truncate.py with function truncate(s, max_len) that truncates string s to max_len characters, adding '...' if truncated. If s is shorter than max_len, return s unchanged.",
    code: "def truncate(s, max_len):\n    if len(s) <= max_len:\n        return s\n    return s[:max_len - 3] + '...'",
    validation: "from tasks.c5_truncate import truncate; assert truncate('Hello World', 5)=='He...'; assert truncate('Hi', 10)=='Hi'; assert truncate('abcdef', 6)=='abcdef'; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 6: Moderate (algorithms, data transformation)
  // ═══════════════════════════════════════════════════════════════════════════
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
  {
    complexity: 6,
    name: "caesar_cipher",
    description: "Create tasks/c6_caesar.py with function caesar_encrypt(text, shift) that shifts each letter by shift positions (wrap around z to a). Only shift letters, leave other characters unchanged. Handle uppercase and lowercase.",
    code: "def caesar_encrypt(text, shift):\n    result = []\n    for char in text:\n        if char.isalpha():\n            base = ord('A') if char.isupper() else ord('a')\n            result.append(chr((ord(char) - base + shift) % 26 + base))\n        else:\n            result.append(char)\n    return ''.join(result)",
    validation: "from tasks.c6_caesar import caesar_encrypt; assert caesar_encrypt('abc', 1)=='bcd'; assert caesar_encrypt('xyz', 3)=='abc'; assert caesar_encrypt('Hello!', 13)=='Uryyb!'; print('PASS')"
  },
  {
    complexity: 6,
    name: "unique_sorted",
    description: "Create tasks/c6_unique_sorted.py with function unique_sorted(lst) that returns a new list with duplicates removed AND sorted in ascending order",
    code: "def unique_sorted(lst):\n    return sorted(set(lst))",
    validation: "from tasks.c6_unique_sorted import unique_sorted; assert unique_sorted([3,1,2,3,1])==[1,2,3]; assert unique_sorted([5,5,5])==[5]; assert unique_sorted([])==[]; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 7: Complex (data structures, multi-step algorithms)
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
    complexity: 7,
    name: "matrix_transpose",
    description: "Create tasks/c7_transpose.py with function transpose(matrix) that transposes a 2D list (swap rows and columns). Example: transpose([[1,2],[3,4],[5,6]]) returns [[1,3,5],[2,4,6]]",
    code: "def transpose(matrix):\n    if not matrix:\n        return []\n    rows = len(matrix)\n    cols = len(matrix[0])\n    result = []\n    for c in range(cols):\n        row = []\n        for r in range(rows):\n            row.append(matrix[r][c])\n        result.append(row)\n    return result",
    validation: "from tasks.c7_transpose import transpose; assert transpose([[1,2],[3,4],[5,6]])==[[1,3,5],[2,4,6]]; assert transpose([[1]])==[[1]]; print('PASS')"
  },
  {
    complexity: 7,
    name: "group_by",
    description: "Create tasks/c7_group_by.py with function group_by(items, key_func) that groups items into a dict where keys are results of key_func and values are lists of matching items",
    code: "def group_by(items, key_func):\n    groups = {}\n    for item in items:\n        key = key_func(item)\n        if key not in groups:\n            groups[key] = []\n        groups[key].append(item)\n    return groups",
    validation: "from tasks.c7_group_by import group_by; r = group_by([1,2,3,4,5,6], lambda x: x % 2); assert r[0]==[2,4,6]; assert r[1]==[1,3,5]; print('PASS')"
  },
  {
    complexity: 7,
    name: "roman_to_int",
    description: "Create tasks/c7_roman.py with function roman_to_int(s) that converts a Roman numeral string to integer. Handle subtractive notation (IV=4, IX=9, XL=40, XC=90, CD=400, CM=900).",
    code: "def roman_to_int(s):\n    values = {'I':1,'V':5,'X':10,'L':50,'C':100,'D':500,'M':1000}\n    result = 0\n    for i in range(len(s)):\n        if i + 1 < len(s) and values[s[i]] < values[s[i+1]]:\n            result -= values[s[i]]\n        else:\n            result += values[s[i]]\n    return result",
    validation: "from tasks.c7_roman import roman_to_int; assert roman_to_int('III')==3; assert roman_to_int('IV')==4; assert roman_to_int('IX')==9; assert roman_to_int('MCMXCIV')==1994; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 8: Complex (classic algorithms, multi-function)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 8,
    name: "merge_sorted",
    description: "Create tasks/c8_merge_sorted.py with function merge_sorted(list1, list2) that merges two sorted lists into one sorted list using the two-pointer technique (do NOT just concatenate and sort)",
    code: "def merge_sorted(list1, list2):\n    result = []\n    i, j = 0, 0\n    while i < len(list1) and j < len(list2):\n        if list1[i] <= list2[j]:\n            result.append(list1[i])\n            i += 1\n        else:\n            result.append(list2[j])\n            j += 1\n    result.extend(list1[i:])\n    result.extend(list2[j:])\n    return result",
    validation: "from tasks.c8_merge_sorted import merge_sorted; assert merge_sorted([1,3,5],[2,4,6])==[1,2,3,4,5,6]; print('PASS')"
  },
  {
    complexity: 8,
    name: "binary_search",
    description: "Create tasks/c8_binary_search.py with function binary_search(arr, target) that returns index of target in sorted array, or -1 if not found",
    code: "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
    validation: "from tasks.c8_binary_search import binary_search; assert binary_search([1,2,3,4,5],3)==2; assert binary_search([1,2,3,4,5],6)==-1; print('PASS')"
  },
  {
    complexity: 8,
    name: "run_length_encode",
    description: "Create tasks/c8_rle.py with function rle_encode(s) that performs run-length encoding. Example: rle_encode('aaabbc') returns 'a3b2c1'",
    code: "def rle_encode(s):\n    if not s:\n        return ''\n    result = []\n    count = 1\n    for i in range(1, len(s)):\n        if s[i] == s[i-1]:\n            count += 1\n        else:\n            result.append(s[i-1] + str(count))\n            count = 1\n    result.append(s[-1] + str(count))\n    return ''.join(result)",
    validation: "from tasks.c8_rle import rle_encode; assert rle_encode('aaabbc')=='a3b2c1'; assert rle_encode('aaa')=='a3'; assert rle_encode('abc')=='a1b1c1'; print('PASS')"
  },
  {
    complexity: 8,
    name: "power_set",
    description: "Create tasks/c8_power_set.py with function power_set(s) that returns all subsets of a list. Example: power_set([1,2]) returns [[], [1], [2], [1,2]]",
    code: "def power_set(s):\n    result = [[]]\n    for elem in s:\n        result += [subset + [elem] for subset in result]\n    return result",
    validation: "from tasks.c8_power_set import power_set; r = power_set([1,2]); assert sorted([sorted(x) for x in r])==sorted([sorted(x) for x in [[],[1],[2],[1,2]]]); assert len(power_set([1,2,3]))==8; print('PASS')"
  },
  {
    complexity: 8,
    name: "balanced_parens",
    description: "Create tasks/c8_parens.py with function is_balanced(s) that checks if parentheses/brackets/braces in string are balanced. Handle (), [], {} including nesting.",
    code: "def is_balanced(s):\n    stack = []\n    pairs = {')':'(', ']':'[', '}':'{'}\n    for char in s:\n        if char in '([{':\n            stack.append(char)\n        elif char in ')]}':\n            if not stack or stack[-1] != pairs[char]:\n                return False\n            stack.pop()\n    return len(stack) == 0",
    validation: "from tasks.c8_parens import is_balanced; assert is_balanced('([]){}')==True; assert is_balanced('([)]')==False; assert is_balanced('')==True; assert is_balanced('(((')==False; print('PASS')"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 9: Extreme (classes, multi-method, stateful logic)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 9,
    name: "stack_class",
    description: "Create tasks/c9_stack.py with a Stack class that has: push(item), pop() returning item or None if empty, peek() returning top item or None, size() returning count, and is_empty() returning bool",
    code: "class Stack:\n    def __init__(self):\n        self._items = []\n    def push(self, item):\n        self._items.append(item)\n    def pop(self):\n        if not self._items:\n            return None\n        return self._items.pop()\n    def peek(self):\n        if not self._items:\n            return None\n        return self._items[-1]\n    def size(self):\n        return len(self._items)\n    def is_empty(self):\n        return len(self._items) == 0",
    validation: "from tasks.c9_stack import Stack; s=Stack(); assert s.is_empty()==True; s.push(1); s.push(2); assert s.peek()==2; assert s.size()==2; assert s.pop()==2; assert s.pop()==1; assert s.pop() is None; print('PASS')"
  },
  {
    complexity: 9,
    name: "lru_cache",
    description: "Create tasks/c9_lru.py with an LRUCache class. Constructor takes capacity (int). Methods: get(key) returns value or -1 if not found, put(key, value) inserts/updates and evicts least recently used if over capacity. Use a dict and a list to track order.",
    code: "class LRUCache:\n    def __init__(self, capacity):\n        self.capacity = capacity\n        self.cache = {}\n        self.order = []\n    def get(self, key):\n        if key not in self.cache:\n            return -1\n        self.order.remove(key)\n        self.order.append(key)\n        return self.cache[key]\n    def put(self, key, value):\n        if key in self.cache:\n            self.order.remove(key)\n        elif len(self.cache) >= self.capacity:\n            oldest = self.order.pop(0)\n            del self.cache[oldest]\n        self.cache[key] = value\n        self.order.append(key)",
    validation: "from tasks.c9_lru import LRUCache; c=LRUCache(2); c.put(1,1); c.put(2,2); assert c.get(1)==1; c.put(3,3); assert c.get(2)==-1; assert c.get(3)==3; print('PASS')"
  },
  {
    complexity: 9,
    name: "rpn_calculator",
    description: "Create tasks/c9_rpn.py with function rpn_calc(expression) that evaluates a Reverse Polish Notation expression. Input is a string of space-separated tokens. Support +, -, *, / operators. Return the result as a float. Example: rpn_calc('3 4 +') returns 7.0",
    code: "def rpn_calc(expression):\n    stack = []\n    for token in expression.split():\n        if token in '+-*/':\n            b = stack.pop()\n            a = stack.pop()\n            if token == '+': stack.append(a + b)\n            elif token == '-': stack.append(a - b)\n            elif token == '*': stack.append(a * b)\n            elif token == '/': stack.append(a / b)\n        else:\n            stack.append(float(token))\n    return stack[0]",
    validation: "from tasks.c9_rpn import rpn_calc; assert rpn_calc('3 4 +')==7.0; assert rpn_calc('5 1 2 + 4 * + 3 -')==14.0; assert rpn_calc('10 2 /')==5.0; print('PASS')"
  },
  {
    complexity: 9,
    name: "text_stats",
    description: "Create tasks/c9_text_stats.py with a TextStats class. Constructor takes a string of text. Methods: word_count() returns number of words, char_count() returns number of non-space characters, most_common_word() returns the most frequently occurring word (lowercase). Split on spaces.",
    code: "class TextStats:\n    def __init__(self, text):\n        self.text = text\n        self.words = text.lower().split()\n    def word_count(self):\n        return len(self.words)\n    def char_count(self):\n        return len(self.text.replace(' ', ''))\n    def most_common_word(self):\n        freq = {}\n        for w in self.words:\n            freq[w] = freq.get(w, 0) + 1\n        return max(freq, key=freq.get)",
    validation: "from tasks.c9_text_stats import TextStats; t=TextStats('the cat and the dog'); assert t.word_count()==5; assert t.char_count()==15; assert t.most_common_word()=='the'; print('PASS')"
  },
  {
    complexity: 9,
    name: "sorted_linked_list",
    description: "Create tasks/c9_linked_list.py with two classes. Node class with value and next attributes. SortedList class with: insert(value) that inserts in sorted ascending order, to_list() that returns a Python list of all values, length() that returns the count of nodes.",
    code: "class Node:\n    def __init__(self, value):\n        self.value = value\n        self.next = None\n\nclass SortedList:\n    def __init__(self):\n        self.head = None\n        self._length = 0\n    def insert(self, value):\n        new_node = Node(value)\n        self._length += 1\n        if self.head is None or value < self.head.value:\n            new_node.next = self.head\n            self.head = new_node\n            return\n        current = self.head\n        while current.next and current.next.value < value:\n            current = current.next\n        new_node.next = current.next\n        current.next = new_node\n    def to_list(self):\n        result = []\n        current = self.head\n        while current:\n            result.append(current.value)\n            current = current.next\n        return result\n    def length(self):\n        return self._length",
    validation: "from tasks.c9_linked_list import SortedList; s=SortedList(); s.insert(3); s.insert(1); s.insert(2); assert s.to_list()==[1,2,3]; assert s.length()==3; s.insert(0); assert s.to_list()==[0,1,2,3]; print('PASS')"
  }
];

async function resetSystem() {
  console.log('🔄 Resetting system...');

  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
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
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      title: `[MAX-C${task.complexity}] ${task.name}`,
      description: fullDescription,
      expectedOutput: `File tasks/${fileName}.py created with ${task.name} function/class`,
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

function getOllamaModel(complexity) {
  // Fixed 4K context for 14B Q4_K_S testing
  return 'qwen2.5-coder:14b-q4ks-4k';
}

async function executeTask(taskId, description, complexity) {
  const model = getOllamaModel(complexity);
  console.log(`   Model: ${model}`);
  const response = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: 'coder-01',
      task_description: description,
      use_claude: false,
      model: model
    })
  });

  return response;
}

async function waitForAgent(maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/coder-01`, { headers: { 'X-API-Key': API_KEY } });
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
    const result = execSync(`docker exec abcc-agents sh -c "cd /app/workspace && python -c \\"${validation}\\""`, {
      encoding: 'utf8',
      timeout: 15000
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
  if (c <= 8) return '\x1b[35m';  // Magenta
  return '\x1b[31m';              // Red (C9!)
}
const RST = '\x1b[0m';

async function main() {
  console.log('═'.repeat(70));
  console.log('🔥🔥🔥 ULTIMATE OLLAMA STRESS TEST - 40 TASKS (C1-C9) 🔥🔥🔥');
  console.log('═'.repeat(70));
  console.log('Model: Dynamic (8K/16K/32K by complexity) | Champion Run');
  console.log(`Tasks: ${TASKS.length} | Complexity: 1-9 | C9 = EXTREME (classes!)`);
  console.log(`Rest: ${REST_DELAY_MS/1000}s between tasks | Reset every ${RESET_EVERY_N_TASKS} tasks`);
  console.log('═'.repeat(70) + '\n');

  await resetSystem();

  const results = {
    total: TASKS.length,
    passed: 0,
    failed: 0,
    errors: 0,
    model: 'dynamic (8K/16K/32K)',
    byComplexity: {},
    details: []
  };

  for (let c = 1; c <= 9; c++) {
    results.byComplexity[c] = { total: 0, passed: 0, failed: 0 };
  }

  const startTime = Date.now();

  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    const taskNum = i + 1;
    const color = getComplexityColor(task.complexity);
    const isC9 = task.complexity === 9;

    console.log(`\n[${taskNum}/${TASKS.length}] ${color}C${task.complexity}${RST} ${task.name}${isC9 ? ' 🔴 EXTREME' : ''}`);
    console.log('─'.repeat(50));

    const taskStart = Date.now();
    let status = 'error';
    let error = null;

    results.byComplexity[task.complexity].total++;

    try {
      const created = await createTask(task);
      console.log(`   Created: ${created.id.substring(0, 8)}...`);

      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      console.log('   Executing with Ollama...');
      const execResponse = await executeTask(created.id, task.description, task.complexity);
      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (!execResponse.ok) {
        throw new Error(`Execution failed: ${(await execResponse.text()).substring(0, 100)}`);
      }

      // Extract only success flag — avoids holding large crewAI response in heap
      const execJson = await execResponse.json();
      const execSuccess = Boolean(execJson.success);

      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ success: execSuccess })
      });

      console.log('   Validating...');
      const passed = await runValidation(task.validation);

      if (passed) {
        status = 'passed';
        results.passed++;
        results.byComplexity[task.complexity].passed++;
        console.log(`   ${color}✅ PASSED${RST} (${duration}s)`);
      } else {
        status = 'failed';
        results.failed++;
        results.byComplexity[task.complexity].failed++;
        console.log(`   ${color}❌ FAILED${RST} - validation failed (${duration}s)`);
      }

      await waitForAgent();

    } catch (e) {
      error = e.message;
      results.errors++;
      results.byComplexity[task.complexity].failed++;
      console.log(`   💥 ERROR: ${e.message.substring(0, 80)}`);

      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
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

    // Rest delay
    if (i < TASKS.length - 1) {
      console.log(`   💤 Resting ${REST_DELAY_MS/1000}s...`);
      await sleep(REST_DELAY_MS);
    }

    // Aggressive reset every 3 tasks
    if ((i + 1) % RESET_EVERY_N_TASKS === 0 && i < TASKS.length - 1) {
      console.log(`\n🔄 Resetting agent (clearing context after ${RESET_EVERY_N_TASKS} tasks)...`);
      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
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
  console.log('📊 ULTIMATE STRESS TEST RESULTS - Dynamic Context (8K/16K/32K)');
  console.log('═'.repeat(70));
  console.log(`   Total:    ${results.passed}/${results.total} passed (${successRate}%)`);
  console.log(`   Failed:   ${results.failed} | Errors: ${results.errors}`);
  console.log(`   Duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);

  console.log('\n📈 SUCCESS RATE BY COMPLEXITY:');
  console.log('─'.repeat(50));

  let foundThreshold = null;
  for (let c = 1; c <= 9; c++) {
    const stats = results.byComplexity[c];
    if (stats.total === 0) continue;

    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '█'.repeat(Math.floor(rate / 10)) + '░'.repeat(10 - Math.floor(rate / 10));
    const color = getComplexityColor(c);
    const marker = rate < 60 && !foundThreshold ? ' ← THRESHOLD' : '';
    const label = c === 9 ? ' (EXTREME)' : '';

    if (rate < 60 && !foundThreshold) {
      foundThreshold = c;
    }

    console.log(`   C${c}${label}: ${color}${bar}${RST} ${rate}% (${stats.passed}/${stats.total})${marker}`);
  }

  if (foundThreshold) {
    console.log(`\n🎯 FAILURE THRESHOLD: C${foundThreshold} (recommend Ollama max = C${foundThreshold - 1})`);
  } else {
    console.log('\n🎯 qwen2.5-coder:32k HANDLED EVERYTHING INCLUDING C9! CHAMPION! 🏆');
  }

  // Timing breakdown
  console.log('\n⏱️ TIMING BY COMPLEXITY:');
  console.log('─'.repeat(50));
  for (let c = 1; c <= 9; c++) {
    const taskTimes = results.details.filter(d => d.complexity === c && d.status === 'passed');
    if (taskTimes.length === 0) continue;
    const avg = Math.round(taskTimes.reduce((s, t) => s + t.duration, 0) / taskTimes.length);
    const max = Math.max(...taskTimes.map(t => t.duration));
    const min = Math.min(...taskTimes.map(t => t.duration));
    console.log(`   C${c}: avg ${avg}s | min ${min}s | max ${max}s (${taskTimes.length} passed)`);
  }

  console.log('═'.repeat(70));

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/ollama-stress-results-14b-q4ks-4k.json',
    JSON.stringify({
      ...results,
      totalDuration,
      successRate,
      recommendedThreshold: foundThreshold ? foundThreshold - 1 : 9,
      timestamp: new Date().toISOString()
    }, null, 2)
  );
  console.log('\n💾 Results saved to scripts/ollama-stress-results-14b-q4ks-4k.json');

  return results;
}

main()
  .then(results => process.exit(results.failed + results.errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
