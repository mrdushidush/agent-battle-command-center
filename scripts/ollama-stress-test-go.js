#!/usr/bin/env node

/**
 * Ollama Go Stress Test - Graduated Complexity (1-8)
 *
 * Tests Ollama's ability to produce Go code.
 * Each task is a standalone `package main` Go file with assertions.
 * Validation: `go run tasks/c1_double.go` — prints "PASS" on success.
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

// Tasks organized by complexity level — all Go (standalone package main)
const TASKS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 1-2: Trivial (single-line, clear I/O)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 1,
    name: "double",
    description: `Create tasks/c1_double.go with a Go program. It must have package main and import "fmt". Define func double(n int) int that returns n * 2. In func main(), test: if double(5) != 10, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c1_double.go",
    code: `package main

import "fmt"

func double(n int) int { return n * 2 }

func main() {
	if double(5) != 10 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 1,
    name: "negate",
    description: `Create tasks/c1_negate.go with a Go program. It must have package main and import "fmt". Define func negate(n int) int that returns -n. In func main(), test: if negate(5) != -5, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c1_negate.go",
    code: `package main

import "fmt"

func negate(n int) int { return -n }

func main() {
	if negate(5) != -5 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 2,
    name: "greet",
    description: `Create tasks/c2_greet.go with a Go program. It must have package main and import "fmt". Define func greet(name string) string that returns "Hello, " + name + "!". In func main(), test: if greet("World") != "Hello, World!", panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c2_greet.go",
    code: `package main

import "fmt"

func greet(name string) string { return "Hello, " + name + "!" }

func main() {
	if greet("World") != "Hello, World!" { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 2,
    name: "isEven",
    description: `Create tasks/c2_is_even.go with a Go program. It must have package main and import "fmt". Define func isEven(n int) bool that returns true if n is even. In func main(), test: if isEven(4) != true or isEven(3) != false, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c2_is_even.go",
    code: `package main

import "fmt"

func isEven(n int) bool { return n%2 == 0 }

func main() {
	if isEven(4) != true || isEven(3) != false { panic("FAIL") }
	fmt.Println("PASS")
}`
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 3-4: Low (simple logic, basic conditions)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 3,
    name: "absolute",
    description: `Create tasks/c3_absolute.go with a Go program. It must have package main and import "fmt". Define func absolute(n int) int that returns the absolute value of n without using math.Abs(). In func main(), test: if absolute(-5) != 5 or absolute(3) != 3, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c3_absolute.go",
    code: `package main

import "fmt"

func absolute(n int) int {
	if n < 0 { return -n }
	return n
}

func main() {
	if absolute(-5) != 5 || absolute(3) != 3 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 3,
    name: "maxOfTwo",
    description: `Create tasks/c3_max_of_two.go with a Go program. It must have package main and import "fmt". Define func maxOfTwo(a, b int) int that returns the larger number. In func main(), test: if maxOfTwo(3, 7) != 7 or maxOfTwo(10, 2) != 10, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c3_max_of_two.go",
    code: `package main

import "fmt"

func maxOfTwo(a, b int) int {
	if a > b { return a }
	return b
}

func main() {
	if maxOfTwo(3, 7) != 7 || maxOfTwo(10, 2) != 10 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 4,
    name: "clamp",
    description: `Create tasks/c4_clamp.go with a Go program. It must have package main and import "fmt". Define func clamp(value, min, max int) int that restricts value to the range [min, max]. In func main(), test: if clamp(5,0,10)!=5 or clamp(-5,0,10)!=0 or clamp(15,0,10)!=10, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c4_clamp.go",
    code: `package main

import "fmt"

func clamp(value, min, max int) int {
	if value < min { return min }
	if value > max { return max }
	return value
}

func main() {
	if clamp(5,0,10) != 5 || clamp(-5,0,10) != 0 || clamp(15,0,10) != 10 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 4,
    name: "countVowels",
    description: `Create tasks/c4_count_vowels.go with a Go program. It must have package main and import ("fmt"; "strings"). Define func countVowels(s string) int that counts vowels (aeiouAEIOU) in a string. In func main(), test: if countVowels("hello") != 2 or countVowels("AEIOU") != 5, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c4_count_vowels.go",
    code: `package main

import (
	"fmt"
	"strings"
)

func countVowels(s string) int {
	count := 0
	for _, c := range s {
		if strings.ContainsRune("aeiouAEIOU", c) { count++ }
	}
	return count
}

func main() {
	if countVowels("hello") != 2 || countVowels("AEIOU") != 5 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 4,
    name: "reverseString",
    description: `Create tasks/c4_reverse.go with a Go program. It must have package main and import "fmt". Define func reverseString(s string) string that reverses a string using a loop. In func main(), test: if reverseString("hello") != "olleh", panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c4_reverse.go",
    code: `package main

import "fmt"

func reverseString(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

func main() {
	if reverseString("hello") != "olleh" { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 4,
    name: "factorial",
    description: `Create tasks/c4_factorial.go with a Go program. It must have package main and import "fmt". Define func factorial(n int) int that returns n! using a loop. In func main(), test: if factorial(5) != 120 or factorial(0) != 1, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c4_factorial.go",
    code: `package main

import "fmt"

func factorial(n int) int {
	result := 1
	for i := 1; i <= n; i++ { result *= i }
	return result
}

func main() {
	if factorial(5) != 120 || factorial(0) != 1 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 5-6: Moderate (multiple conditions, validation, helper logic)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 5,
    name: "fizzBuzz",
    description: `Create tasks/c5_fizzbuzz.go with a Go program. It must have package main and import "fmt". Define func fizzBuzz(n int) string that returns "Fizz" if n divisible by 3, "Buzz" if by 5, "FizzBuzz" if both, else the number as string. In func main(), test: if fizzBuzz(15)!="FizzBuzz" or fizzBuzz(9)!="Fizz" or fizzBuzz(10)!="Buzz" or fizzBuzz(7)!="7", panic. Otherwise fmt.Println("PASS"). Use fmt.Sprintf for int-to-string.`,
    validation: "go run tasks/c5_fizzbuzz.go",
    code: `package main

import "fmt"

func fizzBuzz(n int) string {
	if n%15 == 0 { return "FizzBuzz" }
	if n%3 == 0 { return "Fizz" }
	if n%5 == 0 { return "Buzz" }
	return fmt.Sprintf("%d", n)
}

func main() {
	if fizzBuzz(15) != "FizzBuzz" || fizzBuzz(9) != "Fizz" || fizzBuzz(10) != "Buzz" || fizzBuzz(7) != "7" { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 5,
    name: "isPalindrome",
    description: `Create tasks/c5_palindrome.go with a Go program. It must have package main and import ("fmt"; "strings"). Define func isPalindrome(s string) bool that checks if string is the same forwards and backwards (case insensitive, ignore spaces). In func main(), test: if isPalindrome("racecar")!=true or isPalindrome("hello")!=false, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c5_palindrome.go",
    code: `package main

import (
	"fmt"
	"strings"
)

func isPalindrome(s string) bool {
	cleaned := strings.ToLower(strings.ReplaceAll(s, " ", ""))
	runes := []rune(cleaned)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		if runes[i] != runes[j] { return false }
	}
	return true
}

func main() {
	if isPalindrome("racecar") != true || isPalindrome("hello") != false { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 5,
    name: "safeDivide",
    description: `Create tasks/c5_safe_divide.go with a Go program. It must have package main and import "fmt". Define func safeDivide(a, b float64) (float64, bool) that returns (a/b, true) normally, or (0, false) if b is 0. In func main(), test: r1,ok1 := safeDivide(10,2); r2,ok2 := safeDivide(10,0); if r1!=5 or !ok1 or ok2, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c5_safe_divide.go",
    code: `package main

import "fmt"

func safeDivide(a, b float64) (float64, bool) {
	if b == 0 { return 0, false }
	return a / b, true
}

func main() {
	r1, ok1 := safeDivide(10, 2)
	_, ok2 := safeDivide(10, 0)
	if r1 != 5 || !ok1 || ok2 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 6,
    name: "sumOfDigits",
    description: `Create tasks/c6_sum_digits.go with a Go program. It must have package main and import "fmt". Define func sumOfDigits(n int) int that returns the sum of all digits (handle negative numbers by using absolute value). In func main(), test: if sumOfDigits(123)!=6 or sumOfDigits(-456)!=15, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c6_sum_digits.go",
    code: `package main

import "fmt"

func sumOfDigits(n int) int {
	if n < 0 { n = -n }
	total := 0
	for n > 0 {
		total += n % 10
		n /= 10
	}
	return total
}

func main() {
	if sumOfDigits(123) != 6 || sumOfDigits(-456) != 15 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 6,
    name: "findSecondLargest",
    description: `Create tasks/c6_second_largest.go with a Go program. It must have package main and import "fmt". Define func findSecondLargest(nums []int) (int, bool) that returns the second largest unique value and true, or (0, false) if not possible. In func main(), test: r1,ok1 := findSecondLargest([]int{1,3,5,7,9}); _,ok2 := findSecondLargest([]int{5,5,5}); if r1!=7 or !ok1 or ok2, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c6_second_largest.go",
    code: `package main

import (
	"fmt"
	"sort"
)

func findSecondLargest(nums []int) (int, bool) {
	unique := make(map[int]bool)
	for _, n := range nums { unique[n] = true }
	if len(unique) < 2 { return 0, false }
	sorted := make([]int, 0, len(unique))
	for n := range unique { sorted = append(sorted, n) }
	sort.Ints(sorted)
	return sorted[len(sorted)-2], true
}

func main() {
	r1, ok1 := findSecondLargest([]int{1, 3, 5, 7, 9})
	_, ok2 := findSecondLargest([]int{5, 5, 5})
	if r1 != 7 || !ok1 || ok2 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 6,
    name: "isPrime",
    description: `Create tasks/c6_is_prime.go with a Go program. It must have package main and import "fmt". Define func isPrime(n int) bool that returns true if n is a prime number. In func main(), test: if isPrime(17)!=true or isPrime(4)!=false or isPrime(2)!=true or isPrime(1)!=false, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c6_is_prime.go",
    code: `package main

import "fmt"

func isPrime(n int) bool {
	if n < 2 { return false }
	if n == 2 { return true }
	if n%2 == 0 { return false }
	for i := 3; i*i <= n; i += 2 {
		if n%i == 0 { return false }
	}
	return true
}

func main() {
	if isPrime(17) != true || isPrime(4) != false || isPrime(2) != true || isPrime(1) != false { panic("FAIL") }
	fmt.Println("PASS")
}`
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLEXITY 7-8: Complex (multiple functions, algorithms)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    complexity: 7,
    name: "fibonacci",
    description: `Create tasks/c7_fibonacci.go with a Go program. It must have package main and import "fmt". Define func fibonacci(n int) []int that returns a slice of the first n Fibonacci numbers. In func main(), test: r := fibonacci(7); expected := []int{0,1,1,2,3,5,8}; compare element by element — if any mismatch, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c7_fibonacci.go",
    code: `package main

import "fmt"

func fibonacci(n int) []int {
	if n <= 0 { return []int{} }
	if n == 1 { return []int{0} }
	result := []int{0, 1}
	for len(result) < n {
		result = append(result, result[len(result)-1]+result[len(result)-2])
	}
	return result
}

func main() {
	r := fibonacci(7)
	expected := []int{0, 1, 1, 2, 3, 5, 8}
	if len(r) != len(expected) { panic("FAIL: wrong length") }
	for i := range r {
		if r[i] != expected[i] { panic("FAIL: mismatch") }
	}
	fmt.Println("PASS")
}`
  },
  {
    complexity: 7,
    name: "wordFrequency",
    description: `Create tasks/c7_word_freq.go with a Go program. It must have package main and import ("fmt"; "strings"). Define func wordFrequency(text string) map[string]int that returns word counts (lowercase, split on spaces). In func main(), test: r := wordFrequency("the cat and the dog"); if r["the"]!=2 or r["cat"]!=1, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c7_word_freq.go",
    code: `package main

import (
	"fmt"
	"strings"
)

func wordFrequency(text string) map[string]int {
	freq := make(map[string]int)
	for _, word := range strings.Fields(strings.ToLower(text)) {
		freq[word]++
	}
	return freq
}

func main() {
	r := wordFrequency("the cat and the dog")
	if r["the"] != 2 || r["cat"] != 1 { panic("FAIL") }
	fmt.Println("PASS")
}`
  },
  {
    complexity: 8,
    name: "mergeSorted",
    description: `Create tasks/c8_merge_sorted.go with a Go program. It must have package main and import "fmt". Define func mergeSorted(a, b []int) []int that merges two sorted slices into one sorted slice using a two-pointer approach (do NOT use sort.Ints). In func main(), test: r := mergeSorted([]int{1,3,5}, []int{2,4,6}); expected := []int{1,2,3,4,5,6}; compare element by element — if any mismatch, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c8_merge_sorted.go",
    code: `package main

import "fmt"

func mergeSorted(a, b []int) []int {
	result := make([]int, 0, len(a)+len(b))
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		if a[i] <= b[j] {
			result = append(result, a[i]); i++
		} else {
			result = append(result, b[j]); j++
		}
	}
	result = append(result, a[i:]...)
	result = append(result, b[j:]...)
	return result
}

func main() {
	r := mergeSorted([]int{1, 3, 5}, []int{2, 4, 6})
	expected := []int{1, 2, 3, 4, 5, 6}
	if len(r) != len(expected) { panic("FAIL: wrong length") }
	for i := range r {
		if r[i] != expected[i] { panic("FAIL: mismatch") }
	}
	fmt.Println("PASS")
}`
  },
  {
    complexity: 8,
    name: "binarySearch",
    description: `Create tasks/c8_binary_search.go with a Go program. It must have package main and import "fmt". Define func binarySearch(arr []int, target int) int that returns the index of target in a sorted slice, or -1 if not found. In func main(), test: if binarySearch([]int{1,2,3,4,5}, 3) != 2 or binarySearch([]int{1,2,3,4,5}, 6) != -1, panic. Otherwise fmt.Println("PASS").`,
    validation: "go run tasks/c8_binary_search.go",
    code: `package main

import "fmt"

func binarySearch(arr []int, target int) int {
	left, right := 0, len(arr)-1
	for left <= right {
		mid := (left + right) / 2
		if arr[mid] == target { return mid }
		if arr[mid] < target { left = mid + 1 } else { right = mid - 1 }
	}
	return -1
}

func main() {
	if binarySearch([]int{1, 2, 3, 4, 5}, 3) != 2 || binarySearch([]int{1, 2, 3, 4, 5}, 6) != -1 { panic("FAIL") }
	fmt.Println("PASS")
}`
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
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/c*.go 2>/dev/null"', { stdio: 'pipe' });
    console.log('   \u2713 Go workspace cleaned');
  } catch (e) {
    console.log('   \u26a0 Could not clean workspace: ' + e.message);
  }

  await sleep(2000);
}

async function createTask(task) {
  const fileName = `c${task.complexity}_${task.name}`;
  const fullDescription = `IMPORTANT: You MUST use the file_write tool to create the file. This is a GO task.

Step 1: Use file_write to create tasks/${fileName}.go with this content:
${task.code}

Step 2: Verify with: go run tasks/${fileName}.go

The file MUST start with "package main" and include a func main() that prints "PASS" if all tests pass.

DO NOT just output the code - you MUST call file_write(path="tasks/${fileName}.go", content="...")`;

  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      title: `[GO-STRESS-C${task.complexity}] ${task.name}`,
      description: fullDescription,
      expectedOutput: `File tasks/${fileName}.go created with ${task.name} function`,
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
      timeout: 30000  // Go compile can be slow first time
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
  console.log('\u{1f7e6} OLLAMA GO STRESS TEST - GRADUATED COMPLEXITY (1-8)');
  console.log('\u2550'.repeat(70));
  console.log('Goal: Validate Ollama can produce correct Go code');
  console.log('Tasks: 20 | Complexity range: 1-8 | Model: qwen2.5-coder:7b');
  console.log('Language: Go 1.22 | Standalone package main files');
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

    console.log(`\n[${taskNum}/${TASKS.length}] ${color}C${task.complexity}${RESET} ${task.name} (Go)`);
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
      console.log('   Validating with go run...');
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
  console.log('\u{1f4ca} GO STRESS TEST RESULTS');
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
    console.log(`\n\u{1f3af} RECOMMENDATION: Go tasks struggle at complexity ${foundThreshold}+`);
  } else {
    console.log('\n\u{1f3af} Ollama handled all Go complexity levels well!');
  }

  console.log('\u2550'.repeat(70));

  // Save results
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/ollama-stress-results-go.json',
    JSON.stringify({
      ...results,
      language: 'go',
      totalDuration,
      successRate,
      recommendedThreshold: foundThreshold ? foundThreshold - 1 : 8
    }, null, 2)
  );
  console.log('\n\u{1f4be} Results saved to scripts/ollama-stress-results-go.json');

  return results;
}

main()
  .then(results => process.exit(results.errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
