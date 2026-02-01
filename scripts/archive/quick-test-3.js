#!/usr/bin/env node

/**
 * Quick test with 3 tasks: 1 simple (local), 2 complex (CTO)
 */

const tasks = [
  // Task 1: Simple (local agent)
  {
    title: "Create simple hello world function",
    description: "Create a file tasks/hello.py with a function called greet() that returns 'Hello, World!'",
    taskType: "code",
    priority: 5,
    maxIterations: 10,
    humanTimeoutMinutes: 30
  },

  // Task 6: Complex database (should route to CTO)
  {
    title: "Build SQLite ORM wrapper with CRUD operations",
    description: `Step 1: Create tasks/database.py with a Database class using sqlite3.
Step 2: Implement methods: connect(), create_table(schema), insert(table, data), query(table, filters), update(table, id, data), delete(table, id).
Step 3: Add transaction support and connection pooling.
Step 4: Create tests/test_database.py with tests for all CRUD operations.
Step 5: Test rollback functionality.
Step 6: Run tests and verify all pass.`,
    taskType: "code",
    priority: 8,
    maxIterations: 10,
    humanTimeoutMinutes: 30
  },

  // Task 9: Refactoring (should route to CTO)
  {
    title: "Refactor multi-file project to use dependency injection pattern",
    description: `Step 1: Read all existing files in tasks/ folder.
Step 2: Analyze the current architecture and identify tightly coupled components.
Step 3: Design a dependency injection container pattern.
Step 4: Refactor existing code to use constructor injection.
Step 5: Create tasks/di_container.py with dependency registry.
Step 6: Update all existing modules to accept dependencies.
Step 7: Create integration tests that verify refactored code works.
Step 8: Document the new architecture in tasks/ARCHITECTURE.md.`,
    taskType: "refactor",
    priority: 10,
    maxIterations: 10,
    humanTimeoutMinutes: 30
  }
];

async function createTasks() {
  console.log('🚀 Creating 3 test tasks...\n');

  const taskIds = [];

  for (const task of tasks) {
    const response = await fetch('http://localhost:3001/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to create task: ${error}`);
      continue;
    }

    const created = await response.json();
    taskIds.push({ id: created.id, title: task.title });

    console.log(`✅ Task ${taskIds.length}: ${task.title}`);
    console.log(`   ID: ${created.id.substring(0, 8)}...`);
    console.log(`   Type: ${task.taskType}, Priority: ${task.priority}\n`);
  }

  // Save task IDs
  require('fs').writeFileSync(
    'scripts/test-task-ids.json',
    JSON.stringify(taskIds, null, 2)
  );

  console.log(`📊 Summary: Created ${taskIds.length}/3 tasks`);
  console.log('💾 Task IDs saved to scripts/test-task-ids.json\n');
}

createTasks()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
