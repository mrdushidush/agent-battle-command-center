# Agent Test Tasks for Local 8B Models

Simple, clear tasks to test agent capabilities. Each task has defined success criteria.

---

## Task 1: Basic Function Creation

**Description:**
Create a file `calculator.py` with a function `add(a, b)` that returns the sum of two numbers. Create a test file that verifies it works.

**Success Criteria:**
- File `calculator.py` exists
- Function `add(a, b)` returns correct sum
- Test file exists and passes
- At least 2 test cases

---

## Task 2: File Reading and Counting

**Description:**
Create a file `counter.py` with a function `count_lines(filename)` that reads a file and returns the number of lines. Create a sample text file with 5 lines and test the function.

**Success Criteria:**
- `counter.py` exists with working function
- Sample file created with exactly 5 lines
- Test proves function returns 5

---

## Task 3: String Manipulation

**Description:**
Create `strings.py` with a function `reverse_words(sentence)` that reverses the order of words in a sentence. Example: "hello world" becomes "world hello". Write tests.

**Success Criteria:**
- Function handles basic case
- Function handles single word
- Function handles empty string
- All tests pass

---

## Task 4: List Operations

**Description:**
Create `listutils.py` with a function `find_max(numbers)` that returns the largest number in a list. Do NOT use the built-in max() function. Write tests including edge cases.

**Success Criteria:**
- Function works without using max()
- Handles list with one element
- Handles list with negative numbers
- Tests cover all cases

---

## Task 5: Simple Validation

**Description:**
Create `validator.py` with a function `is_valid_email(email)` that returns True if email contains exactly one "@" and at least one "." after the "@". Write tests for valid and invalid emails.

**Success Criteria:**
- "test@example.com" returns True
- "invalid" returns False
- "no@dot" returns False
- "two@@signs.com" returns False

---

## Task 6: Dictionary Operations

**Description:**
Create `wordcount.py` with a function `count_words(text)` that returns a dictionary with word counts. Example: "hello hello world" returns {"hello": 2, "world": 1}. Write tests.

**Success Criteria:**
- Returns correct dictionary
- Handles empty string
- Test verifies counts are accurate

---

## Task 7: File Creation and Verification

**Description:**
Create a function `save_data(filename, data)` in `fileops.py` that saves a list of strings to a file, one per line. Then create `load_data(filename)` that reads them back. Write tests proving round-trip works.

**Success Criteria:**
- save_data creates file
- load_data reads file
- Data matches after round-trip
- Test proves equality

---

## Task 8: Simple FizzBuzz

**Description:**
Create `fizzbuzz.py` with a function `fizzbuzz(n)` that returns a list from 1 to n where: multiples of 3 are "Fizz", multiples of 5 are "Buzz", multiples of both are "FizzBuzz", others are the number as string. Write tests.

**Success Criteria:**
- fizzbuzz(15) returns correct list
- Position 3 is "Fizz"
- Position 5 is "Buzz"
- Position 15 is "FizzBuzz"
- Position 1 is "1"

---

## Task 9: Temperature Converter

**Description:**
Create `temperature.py` with two functions: `celsius_to_fahrenheit(c)` and `fahrenheit_to_celsius(f)`. Formula: F = C * 9/5 + 32. Write tests with known values.

**Success Criteria:**
- 0°C = 32°F
- 100°C = 212°F
- 32°F = 0°C
- Round-trip conversion works

---

## Task 10: Bug Fix Task

**Description:**
Create this buggy file `buggy.py`:
```python
def get_average(numbers):
    total = 0
    for n in numbers:
        total += n
    return total / len(numbers)
```
This crashes on empty list. Fix the bug to return 0 for empty list. Write tests proving the fix works.

**Success Criteria:**
- Empty list returns 0 (not crash)
- Normal list still works
- Test covers both cases

---

## Task 11: Simple Search

**Description:**
Create `search.py` with a function `find_index(items, target)` that returns the index of target in list, or -1 if not found. Do NOT use the built-in index() method. Write tests.

**Success Criteria:**
- Finds item in middle of list
- Finds item at start
- Finds item at end
- Returns -1 when not found

---

## Task 12: Even/Odd Filter

**Description:**
Create `filters.py` with two functions: `get_evens(numbers)` returns only even numbers, `get_odds(numbers)` returns only odd numbers. Write tests.

**Success Criteria:**
- get_evens([1,2,3,4]) returns [2,4]
- get_odds([1,2,3,4]) returns [1,3]
- Empty list returns empty list
- Tests verify all cases

---

## Task 13: Palindrome Checker

**Description:**
Create `palindrome.py` with a function `is_palindrome(text)` that returns True if text reads the same forwards and backwards (ignore case and spaces). Write tests.

**Success Criteria:**
- "radar" returns True
- "hello" returns False
- "A man a plan a canal Panama" returns True (ignore case/spaces)
- Tests cover all cases

---

## Task 14: Simple Sort Verification

**Description:**
Create `sortcheck.py` with a function `is_sorted(numbers)` that returns True if the list is sorted in ascending order. Write tests including edge cases.

**Success Criteria:**
- [1,2,3] returns True
- [3,1,2] returns False
- [1] returns True (single element)
- [] returns True (empty list)

---

## Task 15: Duplicate Finder

**Description:**
Create `duplicates.py` with a function `find_duplicates(items)` that returns a list of items that appear more than once. Write tests.

**Success Criteria:**
- [1,2,2,3,3,3] returns [2,3]
- [1,2,3] returns []
- Tests verify behavior

---

## Scoring Guide

For each task, evaluate:

| Aspect | Points |
|--------|--------|
| Files created correctly | 1 |
| Function works for basic case | 1 |
| Edge cases handled | 1 |
| Tests exist and actually run | 1 |
| Tests pass (verified from output) | 1 |

**Max per task: 5 points**

**Agent Quality Indicators:**
- Stops and reflects on repeated actions: +bonus
- Honest about failures: +bonus
- Claims false success: -2 points
- Gets stuck in loop: -2 points

---

## Usage Tips

1. Run tasks one at a time
2. Check actual test output, not just agent claims
3. Verify files exist and contain correct code
4. Note any loops or repeated actions
5. Track honest vs hallucinated results

Good luck testing your agents!
