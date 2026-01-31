#!/usr/bin/env node

async function testCTO() {
  // Create simple task
  console.log('Creating simple task for CTO...');
  const createResponse = await fetch('http://localhost:3001/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: "CTO Test: Add two numbers",
      description: "Create a file tasks/add.py with a function add(a, b) that returns a + b. That's it, just one simple function.",
      taskType: "code",
      priority: 10,
      maxIterations: 5,
      humanTimeoutMinutes: 5
    })
  });

  const task = await createResponse.json();
  console.log(`✅ Task created: ${task.id.substring(0, 8)}...`);

  // Assign to CTO
  console.log('\nAssigning to CTO...');
  const assignResponse = await fetch('http://localhost:3001/api/queue/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: task.id,
      agentId: 'cto-01'
    })
  });

  const assigned = await assignResponse.json();
  console.log(`✅ Assigned to: ${assigned.assignedAgent?.name}`);

  // Execute
  console.log('\nExecuting with Claude...');
  const startTime = Date.now();
  const executeResponse = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: task.id,
      agent_id: 'cto-01',
      task_description: task.description,
      expected_output: 'Task completed successfully',
      use_claude: true
    })
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const result = await executeResponse.json();

  console.log(`\n📊 Result (${elapsed}s):`);
  console.log(`   Success: ${result.success}`);

  const output = result.output ? JSON.parse(result.output) : {};
  console.log(`   Status: ${output.status || 'UNKNOWN'}`);
  console.log(`   Confidence: ${output.confidence || 0}`);
  console.log(`   Files created: ${(output.files_created || []).length}`);
  if (output.files_created && output.files_created.length > 0) {
    console.log(`   Files: ${output.files_created.join(', ')}`);
  }

  return result.success;
}

testCTO().then(success => {
  console.log(`\n${success ? '✅' : '❌'} CTO agent test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
