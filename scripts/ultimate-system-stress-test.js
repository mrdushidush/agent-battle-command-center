#!/usr/bin/env node

/**
 * Ultimate System Stress Test - 43 Tasks (40 Ollama + 3 Opus-Decomposed)
 *
 * Phase 1: OLLAMA GAUNTLET — 40 single-file tasks (C1-C9), ~12 min, $0.00
 * Phase 2: OPUS DECOMPOSITION GAUNTLET — 3 multi-file tasks, ~5-8 min, ~$0.45-0.75
 * Phase 3: FINAL REPORT — Combined results, cost breakdown
 *
 * Run: node scripts/ultimate-system-stress-test.js
 * Est. cost: ~$0.45-0.75 (Opus decomposition only)
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || '';
const TASK_TIMEOUT_MS = 5 * 60 * 1000;
const REST_DELAY_MS = 3000;
const RESET_EVERY_N_TASKS = 3;
const DECOMP_MODEL = 'claude-opus-4-5-20251101';
const INTER_DECOMP_PAUSE_MS = 60000; // 60s between Opus calls for rate limiting

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: 40 OLLAMA SINGLE-FILE TASKS (C1-C9)
// ═══════════════════════════════════════════════════════════════════════════

const OLLAMA_TASKS = [
  // C1: Trivial
  { complexity: 1, name: "double", description: "Create tasks/c1_double.py with: def double(n): return n * 2", code: "def double(n):\n    return n * 2", validation: "from tasks.c1_double import double; assert double(5)==10; print('PASS')" },
  { complexity: 1, name: "negate", description: "Create tasks/c1_negate.py with: def negate(n): return -n", code: "def negate(n):\n    return -n", validation: "from tasks.c1_negate import negate; assert negate(5)==-5; print('PASS')" },
  { complexity: 1, name: "square", description: "Create tasks/c1_square.py with: def square(n): return n * n", code: "def square(n):\n    return n * n", validation: "from tasks.c1_square import square; assert square(4)==16; assert square(-3)==9; print('PASS')" },

  // C2: Trivial with formatting
  { complexity: 2, name: "greet", description: "Create tasks/c2_greet.py with: def greet(name): return f'Hello, {name}!'", code: "def greet(name):\n    return f'Hello, {name}!'", validation: "from tasks.c2_greet import greet; assert greet('World')=='Hello, World!'; print('PASS')" },
  { complexity: 2, name: "is_even", description: "Create tasks/c2_is_even.py with: def is_even(n): return n % 2 == 0", code: "def is_even(n):\n    return n % 2 == 0", validation: "from tasks.c2_is_even import is_even; assert is_even(4)==True; assert is_even(3)==False; print('PASS')" },
  { complexity: 2, name: "to_upper", description: "Create tasks/c2_to_upper.py with: def to_upper(s): return s.upper()", code: "def to_upper(s):\n    return s.upper()", validation: "from tasks.c2_to_upper import to_upper; assert to_upper('hello')=='HELLO'; print('PASS')" },

  // C3: Simple branching
  { complexity: 3, name: "absolute", description: "Create tasks/c3_absolute.py with function absolute(n) that returns the absolute value without using abs()", code: "def absolute(n):\n    if n < 0:\n        return -n\n    return n", validation: "from tasks.c3_absolute import absolute; assert absolute(-5)==5; assert absolute(3)==3; print('PASS')" },
  { complexity: 3, name: "max_of_two", description: "Create tasks/c3_max_of_two.py with function max_of_two(a, b) that returns the larger number", code: "def max_of_two(a, b):\n    if a > b:\n        return a\n    return b", validation: "from tasks.c3_max_of_two import max_of_two; assert max_of_two(3,7)==7; assert max_of_two(10,2)==10; print('PASS')" },
  { complexity: 3, name: "min_of_three", description: "Create tasks/c3_min_of_three.py with function min_of_three(a, b, c) that returns the smallest of three numbers without using min()", code: "def min_of_three(a, b, c):\n    smallest = a\n    if b < smallest:\n        smallest = b\n    if c < smallest:\n        smallest = c\n    return smallest", validation: "from tasks.c3_min_of_three import min_of_three; assert min_of_three(3,1,2)==1; assert min_of_three(5,5,5)==5; print('PASS')" },
  { complexity: 3, name: "is_leap_year", description: "Create tasks/c3_leap_year.py with function is_leap_year(year) that returns True if year is a leap year (divisible by 4, except centuries unless divisible by 400)", code: "def is_leap_year(year):\n    if year % 400 == 0:\n        return True\n    if year % 100 == 0:\n        return False\n    if year % 4 == 0:\n        return True\n    return False", validation: "from tasks.c3_leap_year import is_leap_year; assert is_leap_year(2000)==True; assert is_leap_year(1900)==False; assert is_leap_year(2024)==True; assert is_leap_year(2023)==False; print('PASS')" },

  // C4: Loops, string manipulation
  { complexity: 4, name: "clamp", description: "Create tasks/c4_clamp.py with function clamp(value, min_val, max_val) that restricts value to the range [min_val, max_val]", code: "def clamp(value, min_val, max_val):\n    if value < min_val:\n        return min_val\n    if value > max_val:\n        return max_val\n    return value", validation: "from tasks.c4_clamp import clamp; assert clamp(5,0,10)==5; assert clamp(-5,0,10)==0; assert clamp(15,0,10)==10; print('PASS')" },
  { complexity: 4, name: "count_vowels", description: "Create tasks/c4_count_vowels.py with function count_vowels(s) that counts vowels (aeiouAEIOU) in a string", code: "def count_vowels(s):\n    count = 0\n    for char in s:\n        if char in 'aeiouAEIOU':\n            count += 1\n    return count", validation: "from tasks.c4_count_vowels import count_vowels; assert count_vowels('hello')==2; assert count_vowels('AEIOU')==5; print('PASS')" },
  { complexity: 4, name: "reverse_string", description: "Create tasks/c4_reverse.py with function reverse_string(s) that reverses a string without using [::-1]", code: "def reverse_string(s):\n    result = ''\n    for char in s:\n        result = char + result\n    return result", validation: "from tasks.c4_reverse import reverse_string; assert reverse_string('hello')=='olleh'; print('PASS')" },
  { complexity: 4, name: "factorial", description: "Create tasks/c4_factorial.py with function factorial(n) that returns n! using a loop", code: "def factorial(n):\n    result = 1\n    for i in range(1, n + 1):\n        result *= i\n    return result", validation: "from tasks.c4_factorial import factorial; assert factorial(5)==120; assert factorial(0)==1; print('PASS')" },
  { complexity: 4, name: "title_case", description: "Create tasks/c4_title_case.py with function title_case(s) that capitalizes the first letter of each word in a string", code: "def title_case(s):\n    return ' '.join(word.capitalize() for word in s.split())", validation: "from tasks.c4_title_case import title_case; assert title_case('hello world')=='Hello World'; assert title_case('foo bar baz')=='Foo Bar Baz'; print('PASS')" },

  // C5: Multiple conditions, string processing
  { complexity: 5, name: "fizzbuzz_single", description: "Create tasks/c5_fizzbuzz.py with function fizzbuzz(n) that returns 'Fizz' if n divisible by 3, 'Buzz' if by 5, 'FizzBuzz' if both, else str(n)", code: "def fizzbuzz(n):\n    if n % 15 == 0:\n        return 'FizzBuzz'\n    if n % 3 == 0:\n        return 'Fizz'\n    if n % 5 == 0:\n        return 'Buzz'\n    return str(n)", validation: "from tasks.c5_fizzbuzz import fizzbuzz; assert fizzbuzz(15)=='FizzBuzz'; assert fizzbuzz(9)=='Fizz'; assert fizzbuzz(10)=='Buzz'; assert fizzbuzz(7)=='7'; print('PASS')" },
  { complexity: 5, name: "is_palindrome", description: "Create tasks/c5_palindrome.py with function is_palindrome(s) that checks if string is same forwards and backwards (case insensitive, ignore spaces)", code: "def is_palindrome(s):\n    cleaned = s.lower().replace(' ', '')\n    return cleaned == cleaned[::-1]", validation: "from tasks.c5_palindrome import is_palindrome; assert is_palindrome('racecar')==True; assert is_palindrome('A man a plan a canal Panama')==True; assert is_palindrome('hello')==False; print('PASS')" },
  { complexity: 5, name: "safe_divide", description: "Create tasks/c5_safe_divide.py with function safe_divide(a, b) that returns a/b or None if b is 0", code: "def safe_divide(a, b):\n    if b == 0:\n        return None\n    return a / b", validation: "from tasks.c5_safe_divide import safe_divide; assert safe_divide(10,2)==5; assert safe_divide(10,0) is None; print('PASS')" },
  { complexity: 5, name: "flatten_list", description: "Create tasks/c5_flatten.py with function flatten(nested) that flattens a list one level deep. Example: flatten([[1,2],[3,[4]]]) returns [1,2,3,[4]]", code: "def flatten(nested):\n    result = []\n    for item in nested:\n        if isinstance(item, list):\n            result.extend(item)\n        else:\n            result.append(item)\n    return result", validation: "from tasks.c5_flatten import flatten; assert flatten([[1,2],[3,4]])==[1,2,3,4]; assert flatten([[1],[2],[3]])==[1,2,3]; assert flatten([1,[2,3]])==[1,2,3]; print('PASS')" },
  { complexity: 5, name: "truncate", description: "Create tasks/c5_truncate.py with function truncate(s, max_len) that truncates string s to max_len characters, adding '...' if truncated. If s is shorter than max_len, return s unchanged.", code: "def truncate(s, max_len):\n    if len(s) <= max_len:\n        return s\n    return s[:max_len - 3] + '...'", validation: "from tasks.c5_truncate import truncate; assert truncate('Hello World', 5)=='He...'; assert truncate('Hi', 10)=='Hi'; assert truncate('abcdef', 6)=='abcdef'; print('PASS')" },

  // C6: Algorithms, data transformation
  { complexity: 6, name: "sum_of_digits", description: "Create tasks/c6_sum_digits.py with function sum_of_digits(n) that returns sum of all digits in an integer (handle negative numbers)", code: "def sum_of_digits(n):\n    n = abs(n)\n    total = 0\n    while n > 0:\n        total += n % 10\n        n //= 10\n    return total", validation: "from tasks.c6_sum_digits import sum_of_digits; assert sum_of_digits(123)==6; assert sum_of_digits(-456)==15; print('PASS')" },
  { complexity: 6, name: "find_second_largest", description: "Create tasks/c6_second_largest.py with function find_second_largest(numbers) that returns the second largest unique number in a list", code: "def find_second_largest(numbers):\n    unique = list(set(numbers))\n    if len(unique) < 2:\n        return None\n    unique.sort(reverse=True)\n    return unique[1]", validation: "from tasks.c6_second_largest import find_second_largest; assert find_second_largest([1,3,5,7,9])==7; assert find_second_largest([5,5,5]) is None; print('PASS')" },
  { complexity: 6, name: "is_prime", description: "Create tasks/c6_is_prime.py with function is_prime(n) that returns True if n is a prime number", code: "def is_prime(n):\n    if n < 2:\n        return False\n    if n == 2:\n        return True\n    if n % 2 == 0:\n        return False\n    for i in range(3, int(n**0.5) + 1, 2):\n        if n % i == 0:\n            return False\n    return True", validation: "from tasks.c6_is_prime import is_prime; assert is_prime(17)==True; assert is_prime(4)==False; assert is_prime(2)==True; assert is_prime(1)==False; print('PASS')" },
  { complexity: 6, name: "caesar_cipher", description: "Create tasks/c6_caesar.py with function caesar_encrypt(text, shift) that shifts each letter by shift positions (wrap around z to a). Only shift letters, leave other characters unchanged. Handle uppercase and lowercase.", code: "def caesar_encrypt(text, shift):\n    result = []\n    for char in text:\n        if char.isalpha():\n            base = ord('A') if char.isupper() else ord('a')\n            result.append(chr((ord(char) - base + shift) % 26 + base))\n        else:\n            result.append(char)\n    return ''.join(result)", validation: "from tasks.c6_caesar import caesar_encrypt; assert caesar_encrypt('abc', 1)=='bcd'; assert caesar_encrypt('xyz', 3)=='abc'; assert caesar_encrypt('Hello!', 13)=='Uryyb!'; print('PASS')" },
  { complexity: 6, name: "unique_sorted", description: "Create tasks/c6_unique_sorted.py with function unique_sorted(lst) that returns a new list with duplicates removed AND sorted in ascending order", code: "def unique_sorted(lst):\n    return sorted(set(lst))", validation: "from tasks.c6_unique_sorted import unique_sorted; assert unique_sorted([3,1,2,3,1])==[1,2,3]; assert unique_sorted([5,5,5])==[5]; assert unique_sorted([])==[]; print('PASS')" },

  // C7: Complex data structures, multi-step algorithms
  { complexity: 7, name: "fibonacci", description: "Create tasks/c7_fibonacci.py with function fibonacci(n) that returns a list of first n Fibonacci numbers", code: "def fibonacci(n):\n    if n <= 0:\n        return []\n    if n == 1:\n        return [0]\n    result = [0, 1]\n    while len(result) < n:\n        result.append(result[-1] + result[-2])\n    return result", validation: "from tasks.c7_fibonacci import fibonacci; assert fibonacci(7)==[0,1,1,2,3,5,8]; assert fibonacci(1)==[0]; print('PASS')" },
  { complexity: 7, name: "word_frequency", description: "Create tasks/c7_word_freq.py with function word_frequency(text) that returns a dict of word counts (lowercase, split on spaces)", code: "def word_frequency(text):\n    words = text.lower().split()\n    freq = {}\n    for word in words:\n        if word in freq:\n            freq[word] += 1\n        else:\n            freq[word] = 1\n    return freq", validation: "from tasks.c7_word_freq import word_frequency; r = word_frequency('the cat and the dog'); assert r['the']==2; assert r['cat']==1; print('PASS')" },
  { complexity: 7, name: "matrix_transpose", description: "Create tasks/c7_transpose.py with function transpose(matrix) that transposes a 2D list (swap rows and columns). Example: transpose([[1,2],[3,4],[5,6]]) returns [[1,3,5],[2,4,6]]", code: "def transpose(matrix):\n    if not matrix:\n        return []\n    rows = len(matrix)\n    cols = len(matrix[0])\n    result = []\n    for c in range(cols):\n        row = []\n        for r in range(rows):\n            row.append(matrix[r][c])\n        result.append(row)\n    return result", validation: "from tasks.c7_transpose import transpose; assert transpose([[1,2],[3,4],[5,6]])==[[1,3,5],[2,4,6]]; assert transpose([[1]])==[[1]]; print('PASS')" },
  { complexity: 7, name: "group_by", description: "Create tasks/c7_group_by.py with function group_by(items, key_func) that groups items into a dict where keys are results of key_func and values are lists of matching items", code: "def group_by(items, key_func):\n    groups = {}\n    for item in items:\n        key = key_func(item)\n        if key not in groups:\n            groups[key] = []\n        groups[key].append(item)\n    return groups", validation: "from tasks.c7_group_by import group_by; r = group_by([1,2,3,4,5,6], lambda x: x % 2); assert r[0]==[2,4,6]; assert r[1]==[1,3,5]; print('PASS')" },
  { complexity: 7, name: "roman_to_int", description: "Create tasks/c7_roman.py with function roman_to_int(s) that converts a Roman numeral string to integer. Handle subtractive notation (IV=4, IX=9, XL=40, XC=90, CD=400, CM=900).", code: "def roman_to_int(s):\n    values = {'I':1,'V':5,'X':10,'L':50,'C':100,'D':500,'M':1000}\n    result = 0\n    for i in range(len(s)):\n        if i + 1 < len(s) and values[s[i]] < values[s[i+1]]:\n            result -= values[s[i]]\n        else:\n            result += values[s[i]]\n    return result", validation: "from tasks.c7_roman import roman_to_int; assert roman_to_int('III')==3; assert roman_to_int('IV')==4; assert roman_to_int('IX')==9; assert roman_to_int('MCMXCIV')==1994; print('PASS')" },

  // C8: Classic algorithms, multi-function
  { complexity: 8, name: "merge_sorted", description: "Create tasks/c8_merge_sorted.py with function merge_sorted(list1, list2) that merges two sorted lists into one sorted list using the two-pointer technique (do NOT just concatenate and sort)", code: "def merge_sorted(list1, list2):\n    result = []\n    i, j = 0, 0\n    while i < len(list1) and j < len(list2):\n        if list1[i] <= list2[j]:\n            result.append(list1[i])\n            i += 1\n        else:\n            result.append(list2[j])\n            j += 1\n    result.extend(list1[i:])\n    result.extend(list2[j:])\n    return result", validation: "from tasks.c8_merge_sorted import merge_sorted; assert merge_sorted([1,3,5],[2,4,6])==[1,2,3,4,5,6]; print('PASS')" },
  { complexity: 8, name: "binary_search", description: "Create tasks/c8_binary_search.py with function binary_search(arr, target) that returns index of target in sorted array, or -1 if not found", code: "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1", validation: "from tasks.c8_binary_search import binary_search; assert binary_search([1,2,3,4,5],3)==2; assert binary_search([1,2,3,4,5],6)==-1; print('PASS')" },
  { complexity: 8, name: "run_length_encode", description: "Create tasks/c8_rle.py with function rle_encode(s) that performs run-length encoding. Example: rle_encode('aaabbc') returns 'a3b2c1'", code: "def rle_encode(s):\n    if not s:\n        return ''\n    result = []\n    count = 1\n    for i in range(1, len(s)):\n        if s[i] == s[i-1]:\n            count += 1\n        else:\n            result.append(s[i-1] + str(count))\n            count = 1\n    result.append(s[-1] + str(count))\n    return ''.join(result)", validation: "from tasks.c8_rle import rle_encode; assert rle_encode('aaabbc')=='a3b2c1'; assert rle_encode('aaa')=='a3'; assert rle_encode('abc')=='a1b1c1'; print('PASS')" },
  { complexity: 8, name: "power_set", description: "Create tasks/c8_power_set.py with function power_set(s) that returns all subsets of a list. Example: power_set([1,2]) returns [[], [1], [2], [1,2]]", code: "def power_set(s):\n    result = [[]]\n    for elem in s:\n        result += [subset + [elem] for subset in result]\n    return result", validation: "from tasks.c8_power_set import power_set; r = power_set([1,2]); assert sorted([sorted(x) for x in r])==sorted([sorted(x) for x in [[],[1],[2],[1,2]]]); assert len(power_set([1,2,3]))==8; print('PASS')" },
  { complexity: 8, name: "balanced_parens", description: "Create tasks/c8_parens.py with function is_balanced(s) that checks if parentheses/brackets/braces in string are balanced. Handle (), [], {} including nesting.", code: "def is_balanced(s):\n    stack = []\n    pairs = {')':'(', ']':'[', '}':'{'}\n    for char in s:\n        if char in '([{':\n            stack.append(char)\n        elif char in ')]}':\n            if not stack or stack[-1] != pairs[char]:\n                return False\n            stack.pop()\n    return len(stack) == 0", validation: "from tasks.c8_parens import is_balanced; assert is_balanced('([]){}')==True; assert is_balanced('([)]')==False; assert is_balanced('')==True; assert is_balanced('(((')==False; print('PASS')" },

  // C9: Extreme (classes, multi-method, stateful logic)
  { complexity: 9, name: "stack_class", description: "Create tasks/c9_stack.py with a Stack class that has: push(item), pop() returning item or None if empty, peek() returning top item or None, size() returning count, and is_empty() returning bool", code: "class Stack:\n    def __init__(self):\n        self._items = []\n    def push(self, item):\n        self._items.append(item)\n    def pop(self):\n        if not self._items:\n            return None\n        return self._items.pop()\n    def peek(self):\n        if not self._items:\n            return None\n        return self._items[-1]\n    def size(self):\n        return len(self._items)\n    def is_empty(self):\n        return len(self._items) == 0", validation: "from tasks.c9_stack import Stack; s=Stack(); assert s.is_empty()==True; s.push(1); s.push(2); assert s.peek()==2; assert s.size()==2; assert s.pop()==2; assert s.pop()==1; assert s.pop() is None; print('PASS')" },
  { complexity: 9, name: "lru_cache", description: "Create tasks/c9_lru.py with an LRUCache class. Constructor takes capacity (int). Methods: get(key) returns value or -1 if not found, put(key, value) inserts/updates and evicts least recently used if over capacity. Use a dict and a list to track order.", code: "class LRUCache:\n    def __init__(self, capacity):\n        self.capacity = capacity\n        self.cache = {}\n        self.order = []\n    def get(self, key):\n        if key not in self.cache:\n            return -1\n        self.order.remove(key)\n        self.order.append(key)\n        return self.cache[key]\n    def put(self, key, value):\n        if key in self.cache:\n            self.order.remove(key)\n        elif len(self.cache) >= self.capacity:\n            oldest = self.order.pop(0)\n            del self.cache[oldest]\n        self.cache[key] = value\n        self.order.append(key)", validation: "from tasks.c9_lru import LRUCache; c=LRUCache(2); c.put(1,1); c.put(2,2); assert c.get(1)==1; c.put(3,3); assert c.get(2)==-1; assert c.get(3)==3; print('PASS')" },
  { complexity: 9, name: "rpn_calculator", description: "Create tasks/c9_rpn.py with function rpn_calc(expression) that evaluates a Reverse Polish Notation expression. Input is a string of space-separated tokens. Support +, -, *, / operators. Return the result as a float. Example: rpn_calc('3 4 +') returns 7.0", code: "def rpn_calc(expression):\n    stack = []\n    for token in expression.split():\n        if token in '+-*/':\n            b = stack.pop()\n            a = stack.pop()\n            if token == '+': stack.append(a + b)\n            elif token == '-': stack.append(a - b)\n            elif token == '*': stack.append(a * b)\n            elif token == '/': stack.append(a / b)\n        else:\n            stack.append(float(token))\n    return stack[0]", validation: "from tasks.c9_rpn import rpn_calc; assert rpn_calc('3 4 +')==7.0; assert rpn_calc('5 1 2 + 4 * + 3 -')==14.0; assert rpn_calc('10 2 /')==5.0; print('PASS')" },
  { complexity: 9, name: "text_stats", description: "Create tasks/c9_text_stats.py with a TextStats class. Constructor takes a string of text. Methods: word_count() returns number of words, char_count() returns number of non-space characters, most_common_word() returns the most frequently occurring word (lowercase). Split on spaces.", code: "class TextStats:\n    def __init__(self, text):\n        self.text = text\n        self.words = text.lower().split()\n    def word_count(self):\n        return len(self.words)\n    def char_count(self):\n        return len(self.text.replace(' ', ''))\n    def most_common_word(self):\n        freq = {}\n        for w in self.words:\n            freq[w] = freq.get(w, 0) + 1\n        return max(freq, key=freq.get)", validation: "from tasks.c9_text_stats import TextStats; t=TextStats('the cat and the dog'); assert t.word_count()==5; assert t.char_count()==15; assert t.most_common_word()=='the'; print('PASS')" },
  { complexity: 9, name: "sorted_linked_list", description: "Create tasks/c9_linked_list.py with two classes. Node class with value and next attributes. SortedList class with: insert(value) that inserts in sorted ascending order, to_list() that returns a Python list of all values, length() that returns the count of nodes.", code: "class Node:\n    def __init__(self, value):\n        self.value = value\n        self.next = None\n\nclass SortedList:\n    def __init__(self):\n        self.head = None\n        self._length = 0\n    def insert(self, value):\n        new_node = Node(value)\n        self._length += 1\n        if self.head is None or value < self.head.value:\n            new_node.next = self.head\n            self.head = new_node\n            return\n        current = self.head\n        while current.next and current.next.value < value:\n            current = current.next\n        new_node.next = current.next\n        current.next = new_node\n    def to_list(self):\n        result = []\n        current = self.head\n        while current:\n            result.append(current.value)\n            current = current.next\n        return result\n    def length(self):\n        return self._length", validation: "from tasks.c9_linked_list import SortedList; s=SortedList(); s.insert(3); s.insert(1); s.insert(2); assert s.to_list()==[1,2,3]; assert s.length()==3; s.insert(0); assert s.to_list()==[0,1,2,3]; print('PASS')" }
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: 3 MULTI-FILE DECOMPOSITION TASKS
// ═══════════════════════════════════════════════════════════════════════════

const DECOMP_TASKS = [
  {
    name: "Calculator Package",
    dir: "tasks/calc",
    files: ["__init__.py", "operations.py", "formatter.py"],
    description: `Decompose this task into EXACTLY 3 subtasks using the create_subtask tool.
Use the PARENT_TASK_ID provided above as the parent_task_id argument for each create_subtask call.

Build a Calculator Package as a Python package in tasks/calc/ with 3 files.

IMPORTANT: Each subtask description must be VERY DETAILED — include the FULL specification
of what the file should contain. The coder agent CANNOT see other files, so each subtask
description must be SELF-CONTAINED with ALL needed information (exact function signatures,
class definitions, import statements, return types, edge cases). Write 15-30 lines of description per subtask.

CREATE EXACTLY THESE 3 SUBTASKS IN THIS ORDER:

SUBTASK 1: tasks/calc/operations.py
Create file tasks/calc/operations.py with these EXACT functions:

def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b

def divide(a, b):
    if b == 0:
        return None
    return a / b

def power(a, b):
    return a ** b

def chain(value, *operations):
    """Apply a chain of operations to a starting value.
    Each operation is a tuple like ('add', 5) or ('multiply', 3).
    Supported operations: add, subtract, multiply, divide, power.
    Returns the final result after applying all operations in order."""
    ops = {'add': add, 'subtract': subtract, 'multiply': multiply, 'divide': divide, 'power': power}
    result = value
    for op_name, operand in operations:
        result = ops[op_name](result, operand)
    return result

- validation_command: python -c "import os; assert os.path.exists('tasks/calc/operations.py'), 'File missing'; print('OK')"
- suggested_agent: coder

SUBTASK 2: tasks/calc/formatter.py
Create file tasks/calc/formatter.py with these EXACT functions:

def format_result(value, precision=2):
    """Format a numeric result to a string with the specified number of decimal places.
    Example: format_result(3.14159, 2) returns '3.14'
    Example: format_result(42, 3) returns '42.000'"""
    return f"{value:.{precision}f}"

def format_table(results):
    """Format a list of result dicts into an aligned text table.
    Each dict has keys: 'op' (str), 'a' (number), 'b' (number), 'result' (number).
    Returns a multi-line string with columns: Op, A, B, Result.
    Each column should be padded to at least 10 characters wide.
    Include a header row."""
    header = f"{'Op':<10}{'A':<10}{'B':<10}{'Result':<10}"
    lines = [header]
    for r in results:
        lines.append(f"{r['op']:<10}{str(r['a']):<10}{str(r['b']):<10}{str(r['result']):<10}")
    return '\\n'.join(lines)

- validation_command: python -c "import os; assert os.path.exists('tasks/calc/formatter.py'), 'File missing'; print('OK')"
- suggested_agent: coder

SUBTASK 3: tasks/calc/__init__.py
Create file tasks/calc/__init__.py that imports and re-exports everything from operations and formatter:

from tasks.calc.operations import add, subtract, multiply, divide, power, chain
from tasks.calc.formatter import format_result, format_table

This file makes it possible to do "from tasks.calc import add, format_result" etc.

- validation_command: python -c "import os; assert os.path.exists('tasks/calc/__init__.py'), 'File missing'; print('OK')"
- suggested_agent: coder

After creating ALL 3 subtasks, call complete_decomposition.

RULES:
- Each subtask = ONE file
- suggested_agent must be "coder" for all subtasks
- validation_command should ONLY check file existence
- After creating ALL 3 subtasks, call complete_decomposition`,
    validation: "from tasks.calc import add, subtract, multiply, divide, power, chain, format_result; assert add(2,3)==5; assert divide(10,0) is None; assert chain(5, ('add',3), ('multiply',2))==16; assert format_result(3.14159, 2)=='3.14'; print('PASS')"
  },
  {
    name: "Todo Manager",
    dir: "tasks/todo",
    files: ["models.py", "store.py", "cli.py"],
    description: `Decompose this task into EXACTLY 3 subtasks using the create_subtask tool.
Use the PARENT_TASK_ID provided above as the parent_task_id argument for each create_subtask call.

Build a Todo Manager as a Python package in tasks/todo/ with 3 files.

IMPORTANT: Each subtask description must be VERY DETAILED — include the FULL specification
of what the file should contain. The coder agent CANNOT see other files, so each subtask
description must be SELF-CONTAINED with ALL needed information (exact function signatures,
class definitions, import statements, return types, edge cases). Write 15-30 lines of description per subtask.

CREATE EXACTLY THESE 3 SUBTASKS IN THIS ORDER:

SUBTASK 1: tasks/todo/models.py
Create file tasks/todo/models.py with this EXACT class:

class TodoItem:
    def __init__(self, id, title, done=False, priority=1):
        self.id = id          # int
        self.title = title    # str
        self.done = done      # bool, defaults to False
        self.priority = priority  # int, defaults to 1

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'done': self.done,
            'priority': self.priority
        }

    @classmethod
    def from_dict(cls, d):
        return cls(
            id=d['id'],
            title=d['title'],
            done=d.get('done', False),
            priority=d.get('priority', 1)
        )

- validation_command: python -c "import os; assert os.path.exists('tasks/todo/models.py'), 'File missing'; print('OK')"
- suggested_agent: coder

SUBTASK 2: tasks/todo/store.py
Create file tasks/todo/store.py with this EXACT class.
IMPORTANT: This file must import TodoItem from tasks.todo.models at the top: "from tasks.todo.models import TodoItem"

class TodoStore:
    def __init__(self):
        self.items = []       # list of TodoItem objects
        self._next_id = 1     # auto-incrementing ID counter

    def add(self, title, priority=1):
        """Add a new todo item. Returns the created TodoItem with auto-assigned id."""
        item = TodoItem(id=self._next_id, title=title, priority=priority)
        self._next_id += 1
        self.items.append(item)
        return item

    def complete(self, id):
        """Mark a todo item as done by id. Returns True if found, False otherwise."""
        for item in self.items:
            if item.id == id:
                item.done = True
                return True
        return False

    def delete(self, id):
        """Delete a todo item by id. Returns True if found and deleted, False otherwise."""
        for i, item in enumerate(self.items):
            if item.id == id:
                self.items.pop(i)
                return True
        return False

    def list_all(self):
        """Return all todo items."""
        return self.items

    def list_pending(self):
        """Return only undone todo items."""
        return [item for item in self.items if not item.done]

    def list_by_priority(self):
        """Return all items sorted by priority descending (highest first)."""
        return sorted(self.items, key=lambda x: x.priority, reverse=True)

- validation_command: python -c "import os; assert os.path.exists('tasks/todo/store.py'), 'File missing'; print('OK')"
- suggested_agent: coder

SUBTASK 3: tasks/todo/cli.py
Create file tasks/todo/cli.py with these EXACT functions.
NOTE: This file does NOT import anything — it receives TodoItem objects as arguments and reads their attributes.
A TodoItem has attributes: id (int), title (str), done (bool), priority (int).

def format_todo(item):
    """Format a single todo item for display.
    Returns string like '[x] #1 Buy milk (P:3)' if done, '[ ] #1 Buy milk (P:3)' if not done.
    The format is: [checkbox] #id title (P:priority)"""
    checkbox = '[x]' if item.done else '[ ]'
    return f"{checkbox} #{item.id} {item.title} (P:{item.priority})"

def format_list(items):
    """Format a list of todo items for display.
    Returns a multi-line string with one item per line using format_todo.
    If the list is empty, returns 'No items.'"""
    if not items:
        return 'No items.'
    return '\\n'.join(format_todo(item) for item in items)

- validation_command: python -c "import os; assert os.path.exists('tasks/todo/cli.py'), 'File missing'; print('OK')"
- suggested_agent: coder

After creating ALL 3 subtasks, call complete_decomposition.

RULES:
- Each subtask = ONE file
- suggested_agent must be "coder" for all subtasks
- validation_command should ONLY check file existence
- After creating ALL 3 subtasks, call complete_decomposition`,
    validation: "from tasks.todo.store import TodoStore; s=TodoStore(); t1=s.add('Buy milk', 3); t2=s.add('Code review', 1); assert t1.id==1; assert t2.id==2; assert len(s.list_all())==2; assert s.complete(1)==True; assert len(s.list_pending())==1; assert s.list_by_priority()[0].priority==3; print('PASS')"
  },
  {
    name: "Mini Test Framework",
    dir: "tasks/testlib",
    files: ["assertions.py", "runner.py", "reporter.py"],
    description: `Decompose this task into EXACTLY 3 subtasks using the create_subtask tool.
Use the PARENT_TASK_ID provided above as the parent_task_id argument for each create_subtask call.

Build a Mini Test Framework as a Python package in tasks/testlib/ with 3 files.

IMPORTANT: Each subtask description must be VERY DETAILED — include the FULL specification
of what the file should contain. The coder agent CANNOT see other files, so each subtask
description must be SELF-CONTAINED with ALL needed information (exact function signatures,
class definitions, import statements, return types, edge cases). Write 15-30 lines of description per subtask.

CREATE EXACTLY THESE 3 SUBTASKS IN THIS ORDER:

SUBTASK 1: tasks/testlib/assertions.py
Create file tasks/testlib/assertions.py with these EXACT functions:

def assert_equal(actual, expected, msg=''):
    """Assert that actual equals expected. Raises AssertionError with details if not.
    Error message format: 'Expected {expected}, got {actual}' optionally followed by ': {msg}' if msg is provided."""
    if actual != expected:
        error = f"Expected {expected}, got {actual}"
        if msg:
            error += f": {msg}"
        raise AssertionError(error)

def assert_true(value, msg=''):
    """Assert that value is truthy. Raises AssertionError if not.
    Error message format: 'Expected truthy value, got {value}' optionally followed by ': {msg}'."""
    if not value:
        error = f"Expected truthy value, got {value}"
        if msg:
            error += f": {msg}"
        raise AssertionError(error)

def assert_false(value, msg=''):
    """Assert that value is falsy. Raises AssertionError if not.
    Error message format: 'Expected falsy value, got {value}' optionally followed by ': {msg}'."""
    if value:
        error = f"Expected falsy value, got {value}"
        if msg:
            error += f": {msg}"
        raise AssertionError(error)

def assert_raises(exc_type, fn, *args):
    """Assert that calling fn(*args) raises an exception of type exc_type.
    Returns True if the correct exception is raised.
    Raises AssertionError if no exception is raised or wrong type is raised."""
    try:
        fn(*args)
        raise AssertionError(f"Expected {exc_type.__name__} to be raised, but no exception was raised")
    except exc_type:
        return True
    except Exception as e:
        raise AssertionError(f"Expected {exc_type.__name__}, got {type(e).__name__}: {e}")

- validation_command: python -c "import os; assert os.path.exists('tasks/testlib/assertions.py'), 'File missing'; print('OK')"
- suggested_agent: coder

SUBTASK 2: tasks/testlib/runner.py
Create file tasks/testlib/runner.py with this EXACT class:

class TestRunner:
    def __init__(self):
        self.tests = []  # list of tuples (name, fn)

    def add_test(self, name, fn):
        """Register a test function with a name.
        name is a string, fn is a callable that takes no arguments.
        The test passes if fn() completes without raising an exception.
        The test fails if fn() raises any exception."""
        self.tests.append((name, fn))

    def run(self):
        """Execute all registered tests and return results dict.
        Returns: {
            'passed': int,   # count of tests that passed
            'failed': int,   # count of tests that failed
            'errors': [      # list of failure details
                {'name': str, 'error': str},  # name is test name, error is str(exception)
                ...
            ]
        }
        Each test is run independently — a failure in one test does not stop others."""
        passed = 0
        failed = 0
        errors = []
        for name, fn in self.tests:
            try:
                fn()
                passed += 1
            except Exception as e:
                failed += 1
                errors.append({'name': name, 'error': str(e)})
        return {'passed': passed, 'failed': failed, 'errors': errors}

- validation_command: python -c "import os; assert os.path.exists('tasks/testlib/runner.py'), 'File missing'; print('OK')"
- suggested_agent: coder

SUBTASK 3: tasks/testlib/reporter.py
Create file tasks/testlib/reporter.py with this EXACT function:

def format_report(results):
    """Format test runner results into a human-readable string.
    Input is a dict with keys: 'passed' (int), 'failed' (int), 'errors' (list of dicts with 'name' and 'error').

    Output format:
    Line 1: "Tests: {passed} passed, {failed} failed"
    Then for each error:
    "FAILED: {name} - {error}"

    Example output:
    "Tests: 5 passed, 1 failed
    FAILED: test_xxx - AssertionError: Expected 2, got 3"

    If no failures, just return "Tests: {passed} passed, 0 failed"
    """
    lines = [f"Tests: {results['passed']} passed, {results['failed']} failed"]
    for err in results['errors']:
        lines.append(f"FAILED: {err['name']} - {err['error']}")
    return '\\n'.join(lines)

- validation_command: python -c "import os; assert os.path.exists('tasks/testlib/reporter.py'), 'File missing'; print('OK')"
- suggested_agent: coder

After creating ALL 3 subtasks, call complete_decomposition.

RULES:
- Each subtask = ONE file
- suggested_agent must be "coder" for all subtasks
- validation_command should ONLY check file existence
- After creating ALL 3 subtasks, call complete_decomposition`,
    validation: "from tasks.testlib.runner import TestRunner; from tasks.testlib.assertions import assert_equal, assert_true, assert_raises; r=TestRunner(); r.add_test('pass_test', lambda: assert_equal(1+1, 2)); r.add_test('fail_test', lambda: assert_equal(1, 2)); results=r.run(); assert results['passed']==1; assert results['failed']==1; print('PASS')"
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function resetSystem() {
  console.log('\n\x1b[36m[SYSTEM]\x1b[0m Resetting system...');
  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await fetch(`${API_BASE}/queue/resources/clear`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await fetch(`${API_BASE}/agents/ollama-reset-counter`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    console.log('   Agents, resources, and Ollama counter reset');
  } catch (e) {
    console.log('   Could not reset: ' + e.message);
  }

  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/c*.py 2>/dev/null; rm -rf /app/workspace/tasks/calc /app/workspace/tasks/todo /app/workspace/tasks/testlib 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
    console.log('   Workspace cleaned');
  } catch (e) {
    console.log('   Could not clean workspace: ' + e.message);
  }

  await sleep(2000);
}

async function waitForAgent(agentId, maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`, { headers: { 'X-API-Key': API_KEY } });
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(1000);
  }
  return false;
}

async function runValidation(validation) {
  if (!validation) return null;
  try {
    const { execSync } = require('child_process');
    // Strip "python -c" or "python3 -c" prefix if present — we wrap with our own
    let code = validation.trim();
    const prefixMatch = code.match(/^python3?\s+-c\s+["'](.*)["']$/s);
    if (prefixMatch) {
      code = prefixMatch[1];
    } else if (code.startsWith('python3 -c ') || code.startsWith('python -c ')) {
      code = code.replace(/^python3?\s+-c\s+/, '');
      if ((code.startsWith('"') && code.endsWith('"')) || (code.startsWith("'") && code.endsWith("'"))) {
        code = code.slice(1, -1);
      }
    }
    const b64 = Buffer.from(code).toString('base64');
    const cmd = `docker exec -w /app/workspace abcc-agents python3 -c "import base64; exec(base64.b64decode('${b64}').decode())"`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    return result.includes('PASS') || result.includes('OK');
  } catch (e) {
    return false;
  }
}

async function assignToAgent(taskId, agentId) {
  await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ assignedAgentId: agentId, status: 'assigned' })
  });
}

async function completeTask(taskId, success, result) {
  await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ success, result })
  });
}

function getComplexityColor(c) {
  if (c <= 2) return '\x1b[32m';  // Green
  if (c <= 4) return '\x1b[36m';  // Cyan
  if (c <= 6) return '\x1b[33m';  // Yellow
  if (c <= 8) return '\x1b[35m';  // Magenta
  return '\x1b[31m';              // Red
}
const RST = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

async function rateLimitPause(label) {
  console.log(`\n${DIM}   Rate limit pause (${INTER_DECOMP_PAUSE_MS / 1000}s) before ${label}...${RST}`);
  const start = Date.now();
  while (Date.now() - start < INTER_DECOMP_PAUSE_MS) {
    const remaining = Math.ceil((INTER_DECOMP_PAUSE_MS - (Date.now() - start)) / 1000);
    process.stdout.write(`\r${DIM}   Waiting... ${remaining}s remaining   ${RST}`);
    await sleep(1000);
  }
  process.stdout.write(`\r   Ready.                              \n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: OLLAMA GAUNTLET
// ═══════════════════════════════════════════════════════════════════════════

async function phase1_ollamaGauntlet() {
  console.log('\n' + '═'.repeat(70));
  console.log(`${BOLD}  PHASE 1: OLLAMA GAUNTLET — 40 Single-File Tasks (C1-C9)${RST}`);
  console.log('═'.repeat(70));
  console.log(`  Model: qwen2.5-coder:32k | Agent: coder-01`);
  console.log(`  Tasks: ${OLLAMA_TASKS.length} | Rest: ${REST_DELAY_MS/1000}s | Reset every ${RESET_EVERY_N_TASKS} tasks`);
  console.log('  Cost: $0.00 (free local GPU)');
  console.log('─'.repeat(70));

  const results = {
    total: OLLAMA_TASKS.length,
    passed: 0,
    failed: 0,
    errors: 0,
    byComplexity: {},
    details: []
  };

  for (let c = 1; c <= 9; c++) {
    results.byComplexity[c] = { total: 0, passed: 0, failed: 0 };
  }

  const phaseStart = Date.now();

  for (let i = 0; i < OLLAMA_TASKS.length; i++) {
    const task = OLLAMA_TASKS[i];
    const taskNum = i + 1;
    const color = getComplexityColor(task.complexity);
    const isC9 = task.complexity === 9;

    process.stdout.write(`  [${String(taskNum).padStart(2)}/${OLLAMA_TASKS.length}] ${color}C${task.complexity}${RST} ${task.name.padEnd(20)}${isC9 ? ' EXTREME' : ''}`);

    const taskStart = Date.now();
    let status = 'error';
    let error = null;

    results.byComplexity[task.complexity].total++;

    try {
      const fileName = `c${task.complexity}_${task.name}`;
      const fullDescription = `IMPORTANT: You MUST use the file_write tool to create the file.\n\nStep 1: Use file_write to create tasks/${fileName}.py with this content:\n${task.code}\n\nStep 2: Verify the file was created.\n\nDO NOT just output the code - you MUST call file_write(path="tasks/${fileName}.py", content="...")`;

      const createResp = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
          title: `[STRESS-C${task.complexity}] ${task.name}`,
          description: fullDescription,
          expectedOutput: `File tasks/${fileName}.py created with ${task.name} function/class`,
          taskType: 'code',
          priority: task.complexity <= 4 ? 3 : task.complexity,
          maxIterations: 5
        })
      });
      const created = await createResp.json();

      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      const execResponse = await fetch(`${AGENTS_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
          task_id: created.id,
          agent_id: 'coder-01',
          task_description: task.description,
          use_claude: false,
          model: null
        })
      });

      if (!execResponse.ok) {
        throw new Error(`Exec HTTP ${execResponse.status}`);
      }

      const execResult = await execResponse.json();

      await completeTask(created.id, execResult.success, execResult);

      const passed = await runValidation(task.validation);
      const duration = Math.floor((Date.now() - taskStart) / 1000);

      if (passed) {
        status = 'passed';
        results.passed++;
        results.byComplexity[task.complexity].passed++;
        console.log(` ${color}PASS${RST} (${duration}s)`);
      } else {
        status = 'failed';
        results.failed++;
        results.byComplexity[task.complexity].failed++;
        console.log(` ${color}FAIL${RST} (${duration}s)`);
      }

      await waitForAgent('coder-01', 60000);

    } catch (e) {
      error = e.message;
      results.errors++;
      results.byComplexity[task.complexity].failed++;
      const duration = Math.floor((Date.now() - taskStart) / 1000);
      console.log(` ERROR (${duration}s) ${e.message.substring(0, 40)}`);

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
    if (i < OLLAMA_TASKS.length - 1) {
      await sleep(REST_DELAY_MS);
    }

    // Aggressive reset every N tasks
    if ((i + 1) % RESET_EVERY_N_TASKS === 0 && i < OLLAMA_TASKS.length - 1) {
      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
      } catch (e) {}
      await sleep(1000);
    }
  }

  const phaseDuration = Math.floor((Date.now() - phaseStart) / 1000);
  const successRate = Math.round((results.passed / results.total) * 100);

  console.log('\n' + '─'.repeat(70));
  console.log(`  PHASE 1 RESULT: ${results.passed}/${results.total} passed (${successRate}%) in ${Math.floor(phaseDuration / 60)}m ${phaseDuration % 60}s`);

  console.log('\n  BY COMPLEXITY:');
  for (let c = 1; c <= 9; c++) {
    const stats = results.byComplexity[c];
    if (stats.total === 0) continue;
    const rate = Math.round((stats.passed / stats.total) * 100);
    const bar = '\u2588'.repeat(Math.floor(rate / 10)) + '\u2591'.repeat(10 - Math.floor(rate / 10));
    const color = getComplexityColor(c);
    const label = c === 9 ? ' (EXTREME)' : '';
    console.log(`  C${c}${label}: ${color}${bar}${RST} ${rate}% (${stats.passed}/${stats.total})`);
  }

  console.log('\n  TIMING:');
  for (let c = 1; c <= 9; c++) {
    const taskTimes = results.details.filter(d => d.complexity === c && d.status === 'passed');
    if (taskTimes.length === 0) continue;
    const avg = Math.round(taskTimes.reduce((s, t) => s + t.duration, 0) / taskTimes.length);
    console.log(`  C${c}: avg ${avg}s (${taskTimes.length} passed)`);
  }

  return { ...results, phaseDuration, successRate };
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: OPUS DECOMPOSITION GAUNTLET
// ═══════════════════════════════════════════════════════════════════════════

async function phase2_decompGauntlet() {
  console.log('\n\n' + '═'.repeat(70));
  console.log(`${BOLD}  PHASE 2: OPUS DECOMPOSITION GAUNTLET — 3 Multi-File Tasks${RST}`);
  console.log('═'.repeat(70));
  console.log(`  Decomposition: ${DECOMP_MODEL} via cto-01`);
  console.log(`  Execution: qwen2.5-coder:32k via coder-01`);
  console.log(`  Est. cost: ~$0.45-0.75`);
  console.log('─'.repeat(70));

  // Reset before starting decomposition phase
  await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
  await sleep(2000);

  const decompResults = [];
  const phaseStart = Date.now();
  let totalDecompCost = 0;

  for (let d = 0; d < DECOMP_TASKS.length; d++) {
    const decompTask = DECOMP_TASKS[d];

    if (d > 0) {
      await rateLimitPause(`decomposition ${d + 1}`);
    }

    console.log(`\n  ${BOLD}[${d + 1}/${DECOMP_TASKS.length}] ${decompTask.name}${RST}`);
    console.log(`  Files: ${decompTask.files.join(', ')}`);

    // Create __init__.py for package directory
    try {
      const { execSync } = require('child_process');
      execSync(`docker exec abcc-agents sh -c "mkdir -p /app/workspace/${decompTask.dir} && touch /app/workspace/${decompTask.dir}/__init__.py"`, { stdio: 'pipe' });
    } catch (e) {}

    // --- STEP 1: Opus Decomposition ---
    console.log(`\n  Step 1: Opus decomposition...`);
    const decompStart = Date.now();

    const parentResp = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({
        title: `[ULTIMATE] ${decompTask.name}`,
        description: decompTask.description,
        taskType: 'code',
        priority: 10,
        maxIterations: 10
      })
    });
    const parentTask = await parentResp.json();
    console.log(`  Parent task: ${parentTask.id.substring(0, 8)}...`);

    await assignToAgent(parentTask.id, 'cto-01');

    const execResp = await fetch(`${AGENTS_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({
        task_id: parentTask.id,
        agent_id: 'cto-01',
        task_description: `PARENT_TASK_ID: ${parentTask.id}\n\n${decompTask.description}`,
        expected_output: 'All subtasks created and decomposition marked complete.',
        use_claude: true,
        model: DECOMP_MODEL,
        env: { SUBTASK_CREATION_DELAY: '15' }
      })
    });

    const decompTime = Math.floor((Date.now() - decompStart) / 1000);
    const execResult = await execResp.json();
    const decompCost = execResult.metrics?.api_credits_used || 0;
    totalDecompCost += (typeof decompCost === 'number' ? decompCost : 0);

    if (!execResult.success) {
      console.log(`  Opus execution result: ${execResult.error?.substring(0, 80) || 'unknown error'}`);
      console.log(`  Continuing — checking if subtasks were created...`);
    } else {
      console.log(`  Opus completed (${decompTime}s, ~$${typeof decompCost === 'number' ? decompCost.toFixed(4) : decompCost})`);
    }

    // Complete parent task to release CTO
    await completeTask(parentTask.id, true, { decomposed: true });
    await waitForAgent('cto-01', 30000);

    // Fetch subtasks
    const subtasksResp = await fetch(`${API_BASE}/task-planning/${parentTask.id}/subtasks`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const subtasksData = await subtasksResp.json();
    const subtasks = subtasksData.subtasks || [];

    console.log(`  Subtasks created: ${subtasks.length}`);
    subtasks.forEach((st, i) => {
      const title = (st.title || 'Untitled').substring(0, 60);
      console.log(`    ${i + 1}. ${title}`);
    });

    if (subtasks.length === 0) {
      console.log(`  ERROR: No subtasks created. Marking as failed.`);
      decompResults.push({
        name: decompTask.name,
        subtasksCreated: 0,
        subtasksPassed: 0,
        decompTime,
        decompCost,
        execTime: 0,
        validationPassed: false,
        error: 'No subtasks created'
      });
      continue;
    }

    // --- STEP 2: Ollama executes subtasks ---
    console.log(`\n  Step 2: Ollama executing ${subtasks.length} subtasks...`);

    // Reset coder before executing subtasks
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await sleep(2000);

    const execStart = Date.now();
    let subtasksPassed = 0;

    for (let s = 0; s < subtasks.length; s++) {
      const subtask = subtasks[s];
      const stTitle = (subtask.title || 'Untitled').substring(0, 45);
      process.stdout.write(`    [${s + 1}/${subtasks.length}] ${stTitle.padEnd(47)}`);

      const stStart = Date.now();
      try {
        await assignToAgent(subtask.id, 'coder-01');

        const stExecResp = await fetch(`${AGENTS_BASE}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
          body: JSON.stringify({
            task_id: subtask.id,
            agent_id: 'coder-01',
            task_description: subtask.description,
            expected_output: 'File created successfully.',
            use_claude: false,
            model: null
          })
        });

        if (!stExecResp.ok) throw new Error(`HTTP ${stExecResp.status}`);
        const stResult = await stExecResp.json();

        await completeTask(subtask.id, stResult.success, stResult);
        await waitForAgent('coder-01', 120000);

        // Validate subtask
        let stPassed = stResult.success;
        if (subtask.validationCommand) {
          stPassed = await runValidation(subtask.validationCommand);
        }

        const stDuration = Math.floor((Date.now() - stStart) / 1000);
        if (stPassed) {
          subtasksPassed++;
          console.log(`PASS (${stDuration}s)`);
        } else {
          console.log(`FAIL (${stDuration}s)`);
        }

      } catch (e) {
        const stDuration = Math.floor((Date.now() - stStart) / 1000);
        console.log(`ERROR (${stDuration}s) ${e.message.substring(0, 30)}`);
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } }).catch(() => {});
        await sleep(2000);
      }

      // Rest between subtasks
      if (s < subtasks.length - 1) {
        await sleep(REST_DELAY_MS);
      }

      // Reset every N subtasks
      if ((s + 1) % RESET_EVERY_N_TASKS === 0 && s < subtasks.length - 1) {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } }).catch(() => {});
        await sleep(1000);
      }
    }

    const execTime = Math.floor((Date.now() - execStart) / 1000);

    // --- STEP 3: Integrated validation ---
    console.log(`\n  Step 3: Integrated validation...`);
    const validationPassed = await runValidation(decompTask.validation);
    const icon = validationPassed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${decompTask.name}: ${icon}`);
    console.log(`  Subtasks: ${subtasksPassed}/${subtasks.length} | Decomp: ${decompTime}s | Exec: ${execTime}s`);

    decompResults.push({
      name: decompTask.name,
      subtasksCreated: subtasks.length,
      subtasksPassed,
      decompTime,
      decompCost,
      execTime,
      validationPassed,
      error: null
    });
  }

  const phaseDuration = Math.floor((Date.now() - phaseStart) / 1000);
  const decompsPassed = decompResults.filter(r => r.validationPassed).length;

  console.log('\n' + '─'.repeat(70));
  console.log(`  PHASE 2 RESULT: ${decompsPassed}/${DECOMP_TASKS.length} multi-file tasks passed`);
  console.log(`  Total decomposition cost: ~$${totalDecompCost.toFixed(4)}`);
  console.log(`  Duration: ${Math.floor(phaseDuration / 60)}m ${phaseDuration % 60}s`);

  return { decompResults, phaseDuration, totalDecompCost, decompsPassed };
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════════

function phase3_finalReport(ollamaResults, decompResults, totalDuration) {
  const ollamaRate = ollamaResults.successRate;
  const decompsPassed = decompResults.decompsPassed;
  const decompsTotal = DECOMP_TASKS.length;
  const totalTasks = ollamaResults.total + decompsTotal;
  const totalPassed = ollamaResults.passed + decompsPassed;
  const overallRate = Math.round((totalPassed / totalTasks) * 100);

  console.log('\n\n' + '═'.repeat(70));
  console.log(`${BOLD}  ULTIMATE SYSTEM STRESS TEST — FINAL REPORT${RST}`);
  console.log('═'.repeat(70));

  console.log(`\n  ${BOLD}PHASE 1: OLLAMA GAUNTLET${RST}`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  Tasks:     ${ollamaResults.passed}/${ollamaResults.total} passed (${ollamaRate}%)`);
  console.log(`  Failed:    ${ollamaResults.failed} | Errors: ${ollamaResults.errors}`);
  console.log(`  Duration:  ${Math.floor(ollamaResults.phaseDuration / 60)}m ${ollamaResults.phaseDuration % 60}s`);
  console.log(`  Cost:      $0.00`);

  // Failures list
  const failures = ollamaResults.details.filter(d => d.status !== 'passed');
  if (failures.length > 0) {
    console.log(`\n  Failures:`);
    failures.forEach(f => {
      const color = getComplexityColor(f.complexity);
      console.log(`    ${color}C${f.complexity}${RST} ${f.task}: ${f.status}${f.error ? ` (${f.error.substring(0, 50)})` : ''}`);
    });
  }

  console.log(`\n  ${BOLD}PHASE 2: OPUS DECOMPOSITION GAUNTLET${RST}`);
  console.log(`  ─────────────────────────────────────────`);
  decompResults.decompResults.forEach(r => {
    const icon = r.validationPassed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${r.name.padEnd(25)} ${icon}  (subtasks: ${r.subtasksPassed}/${r.subtasksCreated}, decomp: ${r.decompTime}s, exec: ${r.execTime}s)`);
  });
  console.log(`  Duration:  ${Math.floor(decompResults.phaseDuration / 60)}m ${decompResults.phaseDuration % 60}s`);
  console.log(`  Cost:      ~$${decompResults.totalDecompCost.toFixed(4)}`);

  console.log(`\n  ${BOLD}COMBINED RESULTS${RST}`);
  console.log(`  ═════════════════════════════════════════`);
  console.log(`  Total tasks:    ${totalPassed}/${totalTasks} passed (${overallRate}%)`);
  console.log(`    Ollama:       ${ollamaResults.passed}/${ollamaResults.total} (${ollamaRate}%)`);
  console.log(`    Decomposed:   ${decompsPassed}/${decompsTotal}`);
  console.log(`  Total duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);
  console.log(`  Total cost:     ~$${decompResults.totalDecompCost.toFixed(4)}`);

  // Grade
  let grade;
  if (overallRate >= 95) grade = 'S';
  else if (overallRate >= 90) grade = 'A';
  else if (overallRate >= 80) grade = 'B';
  else if (overallRate >= 70) grade = 'C';
  else grade = 'F';

  console.log(`\n  GRADE: ${grade}`);

  if (grade === 'S') {
    console.log('  PERFECT SCORE! The system is battle-ready.');
  } else if (grade === 'A') {
    console.log('  Excellent! Minor issues but system is production-quality.');
  } else if (grade === 'B') {
    console.log('  Good. Some failures but core pipeline works.');
  } else {
    console.log('  Needs improvement. Review failures above.');
  }

  console.log('\n' + '═'.repeat(70));

  return {
    timestamp: new Date().toISOString(),
    grade,
    overallRate,
    totalTasks,
    totalPassed,
    totalDuration,
    totalCost: decompResults.totalDecompCost,
    phase1: {
      model: 'qwen2.5-coder:32k',
      passed: ollamaResults.passed,
      total: ollamaResults.total,
      successRate: ollamaRate,
      duration: ollamaResults.phaseDuration,
      cost: 0,
      byComplexity: ollamaResults.byComplexity,
      details: ollamaResults.details
    },
    phase2: {
      decompModel: DECOMP_MODEL,
      execModel: 'qwen2.5-coder:32k',
      passed: decompsPassed,
      total: decompsTotal,
      duration: decompResults.phaseDuration,
      cost: decompResults.totalDecompCost,
      results: decompResults.decompResults
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(70));
  console.log(`${BOLD}  ULTIMATE SYSTEM STRESS TEST${RST}`);
  console.log(`${BOLD}  40 Ollama Tasks + 3 Opus-Decomposed Multi-File Tasks${RST}`);
  console.log('═'.repeat(70));
  console.log('  Phase 1: Ollama Gauntlet — 40 tasks C1-C9 (~12 min, $0.00)');
  console.log('  Phase 2: Opus Decomposition — 3 multi-file tasks (~5-8 min, ~$0.45-0.75)');
  console.log('  Phase 3: Final Report');
  console.log('═'.repeat(70) + '\n');

  // Pre-flight checks
  console.log('  Pre-flight checks...');
  try {
    const resp = await fetch(`${API_BASE}/agents`, { headers: { 'X-API-Key': API_KEY } });
    const agents = await resp.json();
    const coder = agents.find(a => a.id === 'coder-01');
    const cto = agents.find(a => a.id === 'cto-01');
    if (!coder) throw new Error('coder-01 not found');
    if (!cto) throw new Error('cto-01 not found');
    console.log(`  coder-01: ${coder.status} | cto-01: ${cto.status}`);

    const healthResp = await fetch(`${AGENTS_BASE}/health`);
    const health = await healthResp.json();
    console.log(`  Ollama: ${health.ollama ? 'available' : 'MISSING'} | Claude: ${health.claude ? 'available' : 'MISSING'}`);
    if (!health.ollama) throw new Error('Ollama not available');
    if (!health.claude) throw new Error('Claude API not available');
    console.log('  Pre-flight OK');
  } catch (e) {
    console.error(`  Pre-flight FAILED: ${e.message}`);
    process.exit(1);
  }

  await resetSystem();
  const globalStart = Date.now();

  // Phase 1: Ollama Gauntlet
  const ollamaResults = await phase1_ollamaGauntlet();

  // Phase 2: Opus Decomposition Gauntlet
  const decompResults = await phase2_decompGauntlet();

  const totalDuration = Math.floor((Date.now() - globalStart) / 1000);

  // Phase 3: Final Report
  const report = phase3_finalReport(ollamaResults, decompResults, totalDuration);

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/ultimate-stress-results.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\nResults saved to scripts/ultimate-stress-results.json');

  return report;
}

main()
  .then(report => process.exit(report.totalPassed < report.totalTasks ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
