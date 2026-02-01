#!/usr/bin/env node

const tasks = [
  // Simple tasks (complexity 1-3)
  {
    title: 'Create fibonacci sequence generator',
    description: 'Create tasks/fibonacci.py with a function fibonacci(n) that returns the first n numbers in the Fibonacci sequence as a list. Handle edge cases for n <= 0.',
    taskType: 'code',
    priority: 3,
    maxIterations: 10
  },
  {
    title: 'Create password strength checker',
    description: 'Create tasks/password_checker.py with a function check_strength(password) that returns "weak", "medium", or "strong" based on length, numbers, and special characters.',
    taskType: 'code',
    priority: 3,
    maxIterations: 10
  },
  {
    title: 'Create list flattener utility',
    description: 'Create tasks/flatten.py with a function flatten(nested_list) that takes a nested list and returns a flat list. Example: [[1,2],[3,[4,5]]] -> [1,2,3,4,5]',
    taskType: 'code',
    priority: 4,
    maxIterations: 10
  },
  {
    title: 'Create prime number checker',
    description: 'Create tasks/primes.py with functions is_prime(n) and get_primes(limit) that check primality and return all primes up to limit.',
    taskType: 'code',
    priority: 4,
    maxIterations: 10
  },
  {
    title: 'Create date formatter utility',
    description: 'Create tasks/date_utils.py with functions format_date(date, pattern) and parse_date(date_string, pattern) using datetime module.',
    taskType: 'code',
    priority: 4,
    maxIterations: 10
  },

  // Medium tasks (complexity 4-6)
  {
    title: 'Create JSON configuration manager',
    description: `Step 1: Create tasks/config_manager.py with ConfigManager class.
Step 2: Implement load(filepath), save(filepath), get(key), set(key, value) methods.
Step 3: Add support for nested keys using dot notation (e.g., "database.host").
Step 4: Create tests/test_config_manager.py with test cases.`,
    taskType: 'code',
    priority: 5,
    maxIterations: 10
  },
  {
    title: 'Create logging wrapper with multiple outputs',
    description: `Step 1: Create tasks/logger.py with Logger class.
Step 2: Support console and file output simultaneously.
Step 3: Implement log levels: DEBUG, INFO, WARNING, ERROR.
Step 4: Add timestamp formatting.
Step 5: Create tests verifying log output.`,
    taskType: 'code',
    priority: 5,
    maxIterations: 10
  },
  {
    title: 'Create retry decorator with exponential backoff',
    description: `Step 1: Create tasks/retry.py with @retry decorator.
Step 2: Support max_attempts, delay, and backoff_factor parameters.
Step 3: Allow specifying which exceptions to catch.
Step 4: Create tests/test_retry.py testing retry behavior.`,
    taskType: 'code',
    priority: 6,
    maxIterations: 10
  },
  {
    title: 'Create simple state machine implementation',
    description: `Step 1: Create tasks/state_machine.py with StateMachine class.
Step 2: Support add_state, add_transition, trigger methods.
Step 3: Add callbacks for state enter/exit.
Step 4: Create tests with a traffic light example.`,
    taskType: 'code',
    priority: 6,
    maxIterations: 10
  },
  {
    title: 'Create caching decorator with TTL',
    description: `Step 1: Create tasks/cache.py with @cached decorator.
Step 2: Support time-to-live (TTL) expiration.
Step 3: Add max_size parameter for LRU eviction.
Step 4: Create tests verifying cache hits, misses, and expiration.`,
    taskType: 'code',
    priority: 6,
    maxIterations: 10
  },
  {
    title: 'Review string_utils module for edge cases',
    description: `Step 1: Read tasks/string_utils.py and tests/test_string_utils.py.
Step 2: Identify missing edge case handling (empty strings, None, unicode).
Step 3: Check for potential performance issues with large strings.
Step 4: Generate CODE_REVIEW_string_utils.md with findings and recommendations.`,
    taskType: 'review',
    priority: 5,
    maxIterations: 10
  },
  {
    title: 'Create unit tests for calculator module',
    description: `Step 1: Read tasks/calculator.py to understand current implementation.
Step 2: Create tests/test_calculator.py with comprehensive tests.
Step 3: Test edge cases: division by zero, large numbers, float precision.
Step 4: Achieve 100% code coverage.`,
    taskType: 'test',
    priority: 5,
    maxIterations: 10
  },
  {
    title: 'Create integration tests for data_processor',
    description: `Step 1: Read tasks/data_processor.py.
Step 2: Create tests/test_data_processor_integration.py.
Step 3: Test with various CSV formats and edge cases.
Step 4: Include performance tests with large files.`,
    taskType: 'test',
    priority: 6,
    maxIterations: 10
  },

  // Complex tasks (complexity 7-8)
  {
    title: 'Create event emitter system with async support',
    description: `Step 1: Create tasks/events/__init__.py as package.
Step 2: Create tasks/events/emitter.py with EventEmitter class.
Step 3: Support on, off, emit, once methods.
Step 4: Add async event handler support with asyncio.
Step 5: Create tasks/events/middleware.py for event preprocessing.
Step 6: Create tests/test_events.py with sync and async tests.`,
    taskType: 'code',
    priority: 7,
    maxIterations: 10
  },
  {
    title: 'Create command pattern implementation with undo/redo',
    description: `Step 1: Create tasks/commands/__init__.py as package.
Step 2: Create tasks/commands/base.py with Command abstract base class.
Step 3: Create tasks/commands/invoker.py with CommandInvoker supporting undo/redo stack.
Step 4: Create tasks/commands/history.py for command history persistence.
Step 5: Create example commands: AddCommand, DeleteCommand, UpdateCommand.
Step 6: Create comprehensive tests.`,
    taskType: 'code',
    priority: 7,
    maxIterations: 10
  },
  {
    title: 'Create plugin architecture system',
    description: `Step 1: Create tasks/plugins/__init__.py as package.
Step 2: Create tasks/plugins/loader.py with PluginLoader class.
Step 3: Support dynamic plugin discovery from directory.
Step 4: Create tasks/plugins/base.py with PluginBase interface.
Step 5: Implement plugin lifecycle: load, enable, disable, unload.
Step 6: Create two example plugins.
Step 7: Create tests verifying plugin lifecycle.`,
    taskType: 'code',
    priority: 8,
    maxIterations: 10
  },
  {
    title: 'Create connection pool manager',
    description: `Step 1: Create tasks/pool/__init__.py as package.
Step 2: Create tasks/pool/connection.py with Connection class.
Step 3: Create tasks/pool/manager.py with ConnectionPool class.
Step 4: Implement acquire, release, health checking.
Step 5: Add max_connections and timeout support.
Step 6: Create tests for concurrent access scenarios.`,
    taskType: 'code',
    priority: 8,
    maxIterations: 10
  },
  {
    title: 'Refactor database.py to use connection pooling',
    description: `Step 1: Read current tasks/database.py implementation.
Step 2: Identify direct connection creation patterns.
Step 3: Integrate with ConnectionPool if available, or create simple pool.
Step 4: Update all methods to acquire/release connections properly.
Step 5: Add connection health checking.
Step 6: Update tests to verify pooling behavior.`,
    taskType: 'refactor',
    priority: 7,
    maxIterations: 10
  },
  {
    title: 'Refactor api_client to use async/await',
    description: `Step 1: Read current tasks/api_client.py implementation.
Step 2: Convert all HTTP methods to async using aiohttp.
Step 3: Add connection session management.
Step 4: Update error handling for async context.
Step 5: Create async tests using pytest-asyncio.
Step 6: Maintain backward compatibility with sync wrapper.`,
    taskType: 'refactor',
    priority: 8,
    maxIterations: 10
  },

  // Very complex tasks (complexity 9-10)
  {
    title: 'Create workflow engine with DAG execution',
    description: `Step 1: Create tasks/workflow/__init__.py as package.
Step 2: Create tasks/workflow/dag.py with DAG class for dependency management.
Step 3: Create tasks/workflow/task.py with WorkflowTask class.
Step 4: Create tasks/workflow/executor.py with parallel execution support.
Step 5: Implement topological sorting for execution order.
Step 6: Add retry and failure handling per task.
Step 7: Create tasks/workflow/visualizer.py for DAG visualization.
Step 8: Create comprehensive tests with complex DAG scenarios.`,
    taskType: 'code',
    priority: 9,
    maxIterations: 10
  },
  {
    title: 'Create metrics collection and reporting system',
    description: `Step 1: Create tasks/metrics/__init__.py as package.
Step 2: Create tasks/metrics/collector.py with MetricsCollector class.
Step 3: Support counter, gauge, histogram metric types.
Step 4: Create tasks/metrics/reporter.py for console and JSON output.
Step 5: Add periodic background collection.
Step 6: Create tasks/metrics/decorators.py with @timed and @counted decorators.
Step 7: Create tests verifying metric accuracy.
Step 8: Document usage in tasks/METRICS.md.`,
    taskType: 'code',
    priority: 9,
    maxIterations: 10
  },
  {
    title: 'Review entire codebase for security vulnerabilities',
    description: `Step 1: Read all Python files in tasks/ directory.
Step 2: Check for SQL injection vulnerabilities in database.py.
Step 3: Check for path traversal in file operations.
Step 4: Verify input validation on all public functions.
Step 5: Check for hardcoded secrets or credentials.
Step 6: Review error messages for information leakage.
Step 7: Generate SECURITY_REVIEW.md with findings by severity.
Step 8: Provide remediation code examples for critical issues.`,
    taskType: 'review',
    priority: 10,
    maxIterations: 10
  },
  {
    title: 'Review codebase for performance optimization opportunities',
    description: `Step 1: Read all Python files in tasks/ directory.
Step 2: Identify O(n²) or worse algorithms.
Step 3: Check for unnecessary memory allocations.
Step 4: Review database query patterns for N+1 issues.
Step 5: Check file I/O for buffering opportunities.
Step 6: Identify candidates for caching.
Step 7: Generate PERFORMANCE_REVIEW.md with recommendations.
Step 8: Prioritize by impact: high, medium, low.`,
    taskType: 'review',
    priority: 9,
    maxIterations: 10
  },
  {
    title: 'Refactor codebase to implement repository pattern',
    description: `Step 1: Read all data access code in tasks/ directory.
Step 2: Design repository interfaces for each data type.
Step 3: Create tasks/repositories/__init__.py as package.
Step 4: Create base repository with CRUD operations.
Step 5: Implement concrete repositories for existing models.
Step 6: Update dependent code to use repositories.
Step 7: Create integration tests for repositories.
Step 8: Document pattern usage in tasks/REPOSITORY_PATTERN.md.`,
    taskType: 'refactor',
    priority: 10,
    maxIterations: 10
  }
];

async function createTasks() {
  console.log('Creating 25 new tasks...\n');
  let created = 0;

  for (const task of tasks) {
    try {
      const res = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      if (res.ok) {
        created++;
        console.log(`✅ [P${task.priority}] ${task.taskType.padEnd(8)} ${task.title.substring(0, 55)}`);
      } else {
        console.log(`❌ Failed: ${task.title.substring(0, 40)} - ${res.status}`);
      }
    } catch (e) {
      console.log(`❌ Error: ${task.title.substring(0, 40)} - ${e.message}`);
    }
  }

  console.log(`\n📊 Created ${created}/25 tasks`);
}

createTasks();
