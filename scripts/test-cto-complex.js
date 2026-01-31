#!/usr/bin/env node

async function testCTOComplex() {
  console.log('🎯 Testing CTO with complex architectural task...\n');

  // Step 1: Create task
  console.log('Creating task...');
  const createResponse = await fetch('http://localhost:3001/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Design error handling architecture for agent execution system',
      description: `You are the CTO reviewing our agent execution system. Design a comprehensive error handling architecture:

1. Analyze current error patterns from execution logs (query recent failed tasks)
2. Design error classification system (transient vs permanent, recoverable vs fatal)
3. Propose retry strategies with exponential backoff
4. Design error recovery workflows (when to retry, when to escalate, when to fail fast)
5. Create error notification system (what errors need human attention)
6. Provide implementation recommendations with code examples
7. Document decision rationale and trade-offs

Focus on strategic design, not implementation. Use your query_logs and review_code tools to analyze the system first.`,
      taskType: 'review',
      priority: 10,
      maxIterations: 10,
      humanTimeoutMinutes: 15
    })
  });

  const task = await createResponse.json();
  console.log(`✅ Task created: ${task.id.substring(0, 8)}...`);

  // Step 2: Assign to CTO
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

  // Step 3: Execute with Opus
  console.log('\n🚀 Executing with Claude Opus...');
  const startTime = Date.now();

  const executeResponse = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: task.id,
      agent_id: 'cto-01',
      task_description: task.description,
      expected_output: 'Comprehensive error handling architecture design',
      use_claude: true
    })
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const result = await executeResponse.json();

  console.log(`\n📊 Execution Result (${elapsed}s):`);
  console.log(`   Success: ${result.success}`);

  if (result.output) {
    const output = JSON.parse(result.output);
    console.log(`   Status: ${output.status}`);
    console.log(`   Confidence: ${output.confidence}`);

    console.log(`\n   Summary:`);
    console.log(`   ${output.summary || 'No summary'}`);

    if (output.what_succeeded && output.what_succeeded.length > 0) {
      console.log(`\n   ✅ Actions Succeeded (${output.what_succeeded.length}):`);
      output.what_succeeded.slice(0, 5).forEach(s => console.log(`      - ${s}`));
    }

    if (output.files_created && output.files_created.length > 0) {
      console.log(`\n   📄 Files Created:`);
      output.files_created.forEach(f => console.log(`      - ${f}`));
    }
  }

  // Save task ID for next step
  require('fs').writeFileSync('cto-complex-task-id.txt', task.id);
  console.log(`\n💾 Task ID saved to: cto-complex-task-id.txt`);

  return result.success;
}

testCTOComplex()
  .then(success => {
    console.log(`\n${success ? '✅' : '❌'} CTO complex test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
