#!/usr/bin/env node

/**
 * Test Atomic Task Decomposition
 *
 * Create a simple calculator module task and have CTO decompose it
 * into atomic subtasks (one function per task) with validation commands.
 */

async function testAtomicDecomposition() {
  console.log('🎯 Testing Atomic Task Decomposition\n');
  console.log('=' .repeat(50));

  // Step 1: Create a simple task
  console.log('\n📝 Step 1: Creating calculator module task...');
  const createResponse = await fetch('http://localhost:3001/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Create calculator module with 4 basic operations',
      description: `Create a calculator module with these functions:
- add(a, b) - returns a + b
- subtract(a, b) - returns a - b
- multiply(a, b) - returns a * b
- divide(a, b) - returns a / b (handle division by zero)

Each function should be simple and testable.`,
      taskType: 'code',
      priority: 7,
      maxIterations: 10,
      humanTimeoutMinutes: 20
    })
  });

  const parentTask = await createResponse.json();
  console.log(`   ✅ Created: ${parentTask.id.substring(0, 8)}...`);

  // Step 2: Trigger decomposition
  console.log('\n📋 Step 2: CTO decomposing into atomic subtasks...');
  const decomposeResponse = await fetch(
    `http://localhost:3001/api/task-planning/${parentTask.id}/decompose`,
    { method: 'POST' }
  );

  const decomposeResult = await decomposeResponse.json();
  if (!decomposeResult.success) {
    console.log(`   ❌ Failed: ${decomposeResult.error}`);
    return false;
  }

  console.log(`   ✅ Assigned to: ${decomposeResult.assignedTo}`);

  // Step 3: Execute CTO
  console.log('\n🚀 Step 3: CTO creating subtasks (Opus)...');
  const startTime = Date.now();

  const execResponse = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decomposeResult.decompositionRequest)
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const execResult = await execResponse.json();

  console.log(`   ⏱️  Time: ${elapsed}s`);

  if (execResult.output) {
    const output = JSON.parse(execResult.output);
    console.log(`   Status: ${output.status}`);
  }

  // Step 4: Check subtasks
  console.log('\n📊 Step 4: Checking subtasks...');
  await new Promise(r => setTimeout(r, 2000)); // Wait for DB

  const subtasksResponse = await fetch(
    `http://localhost:3001/api/task-planning/${parentTask.id}/subtasks`
  );
  const subtasksResult = await subtasksResponse.json();

  console.log(`   Created: ${subtasksResult.subtaskCount} subtasks\n`);

  if (subtasksResult.subtasks && subtasksResult.subtasks.length > 0) {
    subtasksResult.subtasks.forEach((st, i) => {
      console.log(`   ${i + 1}. ${st.title}`);
      console.log(`      Agent: ${st.requiredAgent || 'coder'}`);
      if (st.validationCommand) {
        console.log(`      Validation: ${st.validationCommand.substring(0, 60)}...`);
      }
      console.log();
    });
  }

  // Save for execution
  const subtaskIds = subtasksResult.subtasks?.map(s => s.id) || [];
  require('fs').writeFileSync('atomic-subtask-ids.json', JSON.stringify({
    parentTaskId: parentTask.id,
    subtaskIds,
    count: subtaskIds.length
  }, null, 2));

  console.log('=' .repeat(50));
  console.log(`\n✅ Decomposition complete: ${subtaskIds.length} atomic subtasks`);
  console.log('💾 Saved to atomic-subtask-ids.json');
  console.log('\nRun: node execute-atomic-subtasks.js to execute them');

  return subtaskIds.length > 0;
}

testAtomicDecomposition()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
