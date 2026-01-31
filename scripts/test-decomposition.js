#!/usr/bin/env node

/**
 * Test Task Decomposition Flow
 *
 * 1. Create a complex task
 * 2. Trigger CTO to decompose it
 * 3. Execute CTO agent
 * 4. Check subtasks created
 */

async function testDecomposition() {
  console.log('🎯 Testing Task Decomposition Flow\n');
  console.log('=' .repeat(50));

  // Step 1: Create a complex task
  console.log('\n📝 Step 1: Creating complex task...');
  const createResponse = await fetch('http://localhost:3001/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Build a complete user authentication module',
      description: `Create a user authentication system with the following features:
1. User registration with email validation
2. Login with password hashing
3. Session management with tokens
4. Password reset functionality
5. Unit tests for all functions

The implementation should follow security best practices.`,
      taskType: 'code',
      priority: 8,
      maxIterations: 10,
      humanTimeoutMinutes: 30
    })
  });

  const parentTask = await createResponse.json();
  console.log(`   ✅ Created parent task: ${parentTask.id.substring(0, 8)}...`);
  console.log(`   Title: ${parentTask.title}`);

  // Step 2: Trigger decomposition
  console.log('\n📋 Step 2: Triggering CTO decomposition...');
  const decomposeResponse = await fetch(
    `http://localhost:3001/api/task-planning/${parentTask.id}/decompose`,
    { method: 'POST' }
  );

  const decomposeResult = await decomposeResponse.json();

  if (!decomposeResult.success) {
    console.log(`   ❌ Failed: ${decomposeResult.error}`);
    return false;
  }

  console.log(`   ✅ Decomposition started`);
  console.log(`   Assigned to: ${decomposeResult.assignedTo}`);

  // Step 3: Execute CTO agent
  console.log('\n🚀 Step 3: Executing CTO agent (Opus)...');
  const startTime = Date.now();

  const executeResponse = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decomposeResult.decompositionRequest)
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const executeResult = await executeResponse.json();

  console.log(`   ⏱️  Execution time: ${elapsed}s`);
  console.log(`   Success: ${executeResult.success}`);

  if (executeResult.output) {
    const output = JSON.parse(executeResult.output);
    console.log(`   Status: ${output.status}`);
    console.log(`   Confidence: ${output.confidence}`);
  }

  // Step 4: Check subtasks
  console.log('\n📊 Step 4: Checking created subtasks...');
  const subtasksResponse = await fetch(
    `http://localhost:3001/api/task-planning/${parentTask.id}/subtasks`
  );

  const subtasksResult = await subtasksResponse.json();

  console.log(`   Subtasks created: ${subtasksResult.subtaskCount}`);

  if (subtasksResult.subtasks && subtasksResult.subtasks.length > 0) {
    console.log('\n   📋 Subtasks:');
    subtasksResult.subtasks.forEach((st, i) => {
      console.log(`\n   ${i + 1}. ${st.title}`);
      console.log(`      Type: ${st.taskType}, Priority: ${st.priority}`);
      console.log(`      Agent: ${st.requiredAgent || 'any'}`);
      if (st.acceptanceCriteria) {
        console.log(`      Criteria: ${st.acceptanceCriteria.substring(0, 60)}...`);
      }
    });
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 SUMMARY\n');
  console.log(`   Parent Task: ${parentTask.id.substring(0, 8)}...`);
  console.log(`   CTO Execution: ${elapsed}s`);
  console.log(`   Subtasks Created: ${subtasksResult.subtaskCount}`);

  const success = subtasksResult.subtaskCount > 0;
  console.log(`\n${success ? '✅' : '❌'} Task decomposition ${success ? 'SUCCEEDED' : 'FAILED'}`);

  // Save IDs for later
  require('fs').writeFileSync('decomposition-test-result.json', JSON.stringify({
    parentTaskId: parentTask.id,
    subtaskCount: subtasksResult.subtaskCount,
    subtaskIds: subtasksResult.subtasks?.map(s => s.id) || [],
    executionTime: elapsed
  }, null, 2));

  return success;
}

testDecomposition()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
