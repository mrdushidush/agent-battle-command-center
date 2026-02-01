#!/usr/bin/env node

/**
 * Create 10 progressive difficulty test tasks
 * Tests local agent (Ollama) capabilities and CTO routing
 */

// Prefix to identify this test run
const TEST_PREFIX = "[SFFIX-v2] ";

const tasks = [
  // Task 1: Hello World (Complexity ~1.5)
  {
    title: TEST_PREFIX + "Create simple hello world function",
    description: "Create a file tasks/hello.py with a function called greet() that returns 'Hello, World!'",
    taskType: "code",
    priority: 5,
    maxIterations: 10
  },

  // Task 2: Calculator Module (Complexity ~2.5)
  {
    title: TEST_PREFIX + "Create calculator module with basic operations",
    description: "Create tasks/calculator.py with four functions: add(a, b), subtract(a, b), multiply(a, b), and divide(a, b). Each function should perform the operation and return the result.",
    taskType: "code",
    priority: 5,
    maxIterations: 10
  },

  // Task 3: String Utilities with Tests (Complexity ~4.0)
  {
    title: TEST_PREFIX + "Create string utilities module with tests",
    description: "Create tasks/string_utils.py with functions: reverse_string(s), capitalize_words(s), count_vowels(s). Then create tests/test_string_utils.py with at least 3 test cases for each function. Run the tests to verify they pass.",
    taskType: "code",
    priority: 6,
    maxIterations: 10
  },

  // Task 4: Data Processing Pipeline (Complexity ~5.5)
  {
    title: TEST_PREFIX + "Build CSV data processor with validation",
    description: "Step 1: Create tasks/data_processor.py with a function process_csv(input_path, output_path) that reads a CSV file, validates data types, removes duplicates, and writes clean data to output.\nStep 2: Add error handling for missing files and invalid data.\nStep 3: Create a sample test CSV file in workspace.\nStep 4: Create tests/test_data_processor.py with tests for validation and error handling.",
    taskType: "code",
    priority: 7,
    maxIterations: 10
  },

  // Task 5: REST API Client with Mocking (Complexity ~6.5)
  {
    title: TEST_PREFIX + "Create HTTP client with request mocking",
    description: "Step 1: Create tasks/api_client.py with a class APIClient that can make GET and POST requests.\nStep 2: Add methods: get_user(id), create_user(data), with error handling for network failures.\nStep 3: Create tests/test_api_client.py using unittest.mock to mock HTTP responses.\nStep 4: Test successful requests and error scenarios.\nStep 5: Run all tests and verify they pass.",
    taskType: "code",
    priority: 7,
    maxIterations: 10
  },

  // Task 6: Database ORM Layer (Complexity ~7.0)
  {
    title: TEST_PREFIX + "Build SQLite ORM wrapper with CRUD operations",
    description: "Step 1: Create tasks/database.py with a Database class using sqlite3.\nStep 2: Implement methods: connect(), create_table(schema), insert(table, data), query(table, filters), update(table, id, data), delete(table, id).\nStep 3: Add transaction support and connection pooling.\nStep 4: Create tests/test_database.py with tests for all CRUD operations.\nStep 5: Test rollback functionality.\nStep 6: Run tests and verify all pass.",
    taskType: "code",
    priority: 8,
    maxIterations: 10
  },

  // Task 7: Multi-File Web Scraper Architecture (Complexity ~8.5)
  {
    title: TEST_PREFIX + "Design and implement multi-file web scraper architecture",
    description: "Step 1: Create tasks/scraper/__init__.py as a package.\nStep 2: Create tasks/scraper/fetcher.py with HTTPFetcher class for making requests with retry logic.\nStep 3: Create tasks/scraper/parser.py with HTMLParser class using BeautifulSoup to extract data.\nStep 4: Create tasks/scraper/storage.py with DataStorage class to save scraped data to JSON.\nStep 5: Create tasks/scraper/main.py that orchestrates fetcher, parser, and storage.\nStep 6: Create tests/test_scraper.py with mocked HTTP responses.\nStep 7: Verify all imports work and tests pass.",
    taskType: "code",
    priority: 9,
    maxIterations: 10
  },

  // Task 8: Async Task Queue System (Complexity ~9.0)
  {
    title: TEST_PREFIX + "Build asynchronous task queue with worker pool",
    description: "Step 1: Create tasks/task_queue.py with TaskQueue class using asyncio.\nStep 2: Implement task submission: submit_task(func, args), with priority queue support.\nStep 3: Create WorkerPool class that processes tasks concurrently with configurable worker count.\nStep 4: Add task status tracking: pending, running, completed, failed.\nStep 5: Implement graceful shutdown and task cancellation.\nStep 6: Create tests/test_task_queue.py testing concurrent task execution.\nStep 7: Test edge cases: worker failure, task timeout, queue overflow.\nStep 8: Verify all tests pass.",
    taskType: "code",
    priority: 9,
    maxIterations: 10
  },

  // Task 9: Refactor Existing Codebase Architecture (Complexity ~9.5)
  {
    title: TEST_PREFIX + "Refactor multi-file project to use dependency injection pattern",
    description: "Step 1: Read all existing files in tasks/ folder.\nStep 2: Analyze the current architecture and identify tightly coupled components.\nStep 3: Design a dependency injection container pattern.\nStep 4: Refactor existing code to use constructor injection.\nStep 5: Create tasks/di_container.py with dependency registry.\nStep 6: Update all existing modules to accept dependencies.\nStep 7: Create integration tests that verify refactored code works.\nStep 8: Document the new architecture in tasks/ARCHITECTURE.md.",
    taskType: "refactor",
    priority: 10,
    maxIterations: 10
  },

  // Task 10: Code Review and Optimization (Complexity ~10.0)
  {
    title: TEST_PREFIX + "Review all generated code for performance and best practices",
    description: "Step 1: Read all Python files in tasks/ directory.\nStep 2: Analyze code for performance issues, memory leaks, inefficient algorithms.\nStep 3: Check for security vulnerabilities (SQL injection, XSS, etc.).\nStep 4: Verify proper error handling and edge case coverage.\nStep 5: Review test coverage and suggest additional tests.\nStep 6: Generate a detailed report in tasks/CODE_REVIEW.md with findings and recommendations.\nStep 7: Prioritize issues by severity: critical, high, medium, low.\nStep 8: Provide code examples for top 3 issues.",
    taskType: "review",
    priority: 10,
    maxIterations: 10
  }
];

async function createTasks() {
  console.log('🚀 Creating 10 test tasks...\n');

  const createdTasks = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskNum = i + 1;

    try {
      const response = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const created = await response.json();
      createdTasks.push(created);

      console.log(`✅ Task ${taskNum}: ${task.title}`);
      console.log(`   ID: ${created.id.substring(0, 8)}...`);
      console.log(`   Type: ${task.taskType}, Priority: ${task.priority}`);
      console.log('');

    } catch (error) {
      console.error(`❌ Failed to create Task ${taskNum}: ${error.message}`);
    }
  }

  console.log(`\n📊 Summary: Created ${createdTasks.length}/${tasks.length} tasks`);

  // Save task IDs for later phases
  const fs = require('fs');
  fs.writeFileSync(
    'scripts/test-task-ids.json',
    JSON.stringify(createdTasks.map(t => ({ id: t.id, title: t.title })), null, 2)
  );
  console.log('💾 Task IDs saved to scripts/test-task-ids.json');

  return createdTasks;
}

// Run if called directly
if (require.main === module) {
  createTasks()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { createTasks, tasks };
