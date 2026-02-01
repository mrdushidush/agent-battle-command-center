#!/usr/bin/env node

/**
 * Collect all execution data after task completion
 * Exports tasks, execution logs, training data, and agent stats
 */

const fs = require('fs');

async function fetchJSON(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ ${filename}`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch ${filename}: ${error.message}`);
    return null;
  }
}

async function collectData() {
  console.log('📦 Collecting execution data...\n');

  // Create data directory
  const dataDir = 'scripts/diagnostic-data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 1. Export all tasks with results
  console.log('1️⃣  Exporting tasks...');
  const tasks = await fetchJSON(
    'http://localhost:3001/api/tasks',
    `${dataDir}/post-execution-tasks.json`
  );

  // 2. Export execution logs for each task
  console.log('\n2️⃣  Exporting execution logs...');
  const taskIds = JSON.parse(fs.readFileSync('scripts/test-task-ids.json', 'utf8'));

  for (const task of taskIds) {
    const logs = await fetchJSON(
      `http://localhost:3001/api/execution-logs/task/${task.id}`,
      `${dataDir}/logs-${task.id.substring(0, 8)}.json`
    );
  }

  // 3. Export training data
  console.log('\n3️⃣  Exporting training data...');
  await fetchJSON(
    'http://localhost:3001/api/training-data',
    `${dataDir}/training-data.json`
  );

  await fetchJSON(
    'http://localhost:3001/api/training-data/stats',
    `${dataDir}/training-data-stats.json`
  );

  // 4. Export agent stats
  console.log('\n4️⃣  Exporting agent stats...');
  await fetchJSON(
    'http://localhost:3001/api/agents',
    `${dataDir}/post-execution-agents.json`
  );

  // 5. Copy execution results
  console.log('\n5️⃣  Copying execution results...');
  if (fs.existsSync('scripts/execution-results.json')) {
    fs.copyFileSync(
      'scripts/execution-results.json',
      `${dataDir}/execution-results.json`
    );
    console.log(`✅ ${dataDir}/execution-results.json`);
  }

  if (fs.existsSync('scripts/pre-execution-routing.json')) {
    fs.copyFileSync(
      'scripts/pre-execution-routing.json',
      `${dataDir}/pre-execution-routing.json`
    );
    console.log(`✅ ${dataDir}/pre-execution-routing.json`);
  }

  // 6. Summary
  console.log('\n📊 Data Collection Summary:');
  const files = fs.readdirSync(dataDir);
  console.log(`   Files collected: ${files.length}`);
  console.log(`   Location: ${dataDir}/`);

  // Calculate total size
  const totalSize = files.reduce((sum, file) => {
    const stats = fs.statSync(`${dataDir}/${file}`);
    return sum + stats.size;
  }, 0);
  console.log(`   Total size: ${(totalSize / 1024).toFixed(2)} KB`);

  console.log('\n✅ Data collection complete!');

  return { dataDir, files, totalSize };
}

// Run if called directly
if (require.main === module) {
  collectData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { collectData };
