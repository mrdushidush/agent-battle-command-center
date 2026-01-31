#!/usr/bin/env node

/**
 * Full System Health Check
 *
 * Comprehensive health verification for Agent Battle Command Center:
 * 1. Docker container health checks
 * 2. Service endpoint connectivity
 * 3. Database connectivity
 * 4. Redis connectivity
 * 5. Ollama model availability
 * 6. Trivy vulnerability scan
 * 7. Disk space check
 * 8. Backup status check
 * 9. Agent and resource pool status
 *
 * If all checks pass, runs the load test (load-test-20-tasks-queue.js)
 *
 * Usage: node scripts/full-system-health-check.js [options]
 *
 * Options:
 *   --skip-load-test  Skip the load test after health checks
 *   --skip-trivy      Skip Trivy vulnerability scan
 *   --clear-tasks     Clear pending tasks before load test
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

// ANSI color codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Configuration
const CONFIG = {
  containers: ['abcc-postgres', 'abcc-redis', 'abcc-ollama', 'abcc-api', 'abcc-agents', 'abcc-mcp-gateway', 'abcc-ui', 'abcc-backup'],
  endpoints: {
    api: 'http://localhost:3001/api/agents',
    agents: 'http://localhost:8000/health',
    mcpGateway: 'http://localhost:8001/health',
  },
  minDiskSpaceGB: 5,
  trivySeverity: 'HIGH,CRITICAL',
};

// Parse command line args
const args = process.argv.slice(2);
const skipLoadTest = args.includes('--skip-load-test');
const skipTrivy = args.includes('--skip-trivy');
const clearTasks = args.includes('--clear-tasks');

// Track results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

// Utility functions
function log(msg, color = '') {
  console.log(`${color}${msg}${c.reset}`);
}

function header(msg) {
  console.log();
  log(`${'='.repeat(60)}`, c.cyan);
  log(`  ${msg}`, c.bold + c.cyan);
  log(`${'='.repeat(60)}`, c.cyan);
}

function checkResult(name, passed, message = '') {
  if (passed) {
    results.passed.push(name);
    log(`  [PASS] ${name}${message ? ': ' + message : ''}`, c.green);
  } else {
    results.failed.push(name);
    log(`  [FAIL] ${name}${message ? ': ' + message : ''}`, c.red);
  }
  return passed;
}

function warning(name, message) {
  results.warnings.push({ name, message });
  log(`  [WARN] ${name}: ${message}`, c.yellow);
}

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim();
  } catch (e) {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await globalThis.fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    return null;
  }
}

// Health Check Functions
async function checkDockerContainers() {
  header('Docker Container Health');

  let allHealthy = true;

  for (const container of CONFIG.containers) {
    const status = exec(`docker inspect --format="{{.State.Status}}" ${container}`);
    const health = exec(`docker inspect --format="{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}" ${container}`);

    if (!status) {
      checkResult(container, false, 'not found');
      allHealthy = false;
    } else if (status !== 'running') {
      checkResult(container, false, `status: ${status}`);
      allHealthy = false;
    } else if (health === 'unhealthy') {
      checkResult(container, false, 'unhealthy');
      allHealthy = false;
    } else {
      const uptime = exec(`docker inspect --format="{{.State.StartedAt}}" ${container}`);
      const startTime = new Date(uptime);
      const uptimeMin = Math.floor((Date.now() - startTime) / 60000);
      checkResult(container, true, `running (${uptimeMin}m uptime, health: ${health})`);
    }
  }

  return allHealthy;
}

async function checkServiceEndpoints() {
  header('Service Endpoint Connectivity');

  let allReachable = true;

  for (const [name, url] of Object.entries(CONFIG.endpoints)) {
    const response = await fetchWithTimeout(url);
    if (response && response.ok) {
      checkResult(name, true, `${url} (${response.status})`);
    } else {
      checkResult(name, false, `${url} (${response ? response.status : 'unreachable'})`);
      allReachable = false;
    }
  }

  return allReachable;
}

async function checkDatabase() {
  header('Database Connectivity');

  const result = exec('docker exec abcc-postgres psql -U postgres -d abcc -c "SELECT COUNT(*) FROM agents;" -t');
  if (result !== null) {
    const agentCount = parseInt(result.trim(), 10);
    checkResult('PostgreSQL', true, `connected (${agentCount} agents)`);

    // Check for pending tasks
    const pendingTasks = exec('docker exec abcc-postgres psql -U postgres -d abcc -c "SELECT COUNT(*) FROM tasks WHERE status = \'pending\';" -t');
    if (pendingTasks) {
      const count = parseInt(pendingTasks.trim(), 10);
      if (count > 0) {
        warning('Pending Tasks', `${count} tasks in queue`);
      }
    }

    return true;
  } else {
    checkResult('PostgreSQL', false, 'connection failed');
    return false;
  }
}

async function checkRedis() {
  header('Redis Connectivity');

  const ping = exec('docker exec abcc-redis redis-cli ping');
  if (ping === 'PONG') {
    const info = exec('docker exec abcc-redis redis-cli info memory | grep used_memory_human');
    const memUsed = info ? info.split(':')[1] : 'unknown';
    checkResult('Redis', true, `connected (memory: ${memUsed})`);
    return true;
  } else {
    checkResult('Redis', false, 'ping failed');
    return false;
  }
}

async function checkOllama() {
  header('Ollama Model Availability');

  const models = exec('docker exec abcc-ollama ollama list');
  if (models && models.includes('qwen2.5-coder')) {
    // Check if model is responsive
    const testResponse = await fetchWithTimeout('http://localhost:11434/api/tags');
    if (testResponse && testResponse.ok) {
      checkResult('Ollama', true, 'qwen2.5-coder:7b loaded and responsive');
      return true;
    }
  }

  checkResult('Ollama', false, 'model not available');
  return false;
}

async function checkAgentStatus() {
  header('Agent Status');

  const response = await fetch('http://localhost:3001/api/agents');
  if (!response || !response.ok) {
    checkResult('Agent API', false, 'cannot fetch agents');
    return false;
  }

  const agents = await response.json();
  let allIdle = true;

  for (const agent of agents) {
    const status = agent.status || 'unknown';
    const isIdle = status === 'idle';
    if (!isIdle) allIdle = false;

    checkResult(`Agent ${agent.name}`, isIdle, `status: ${status}, type: ${agent.type}`);
  }

  if (!allIdle) {
    warning('Agent Status', 'Some agents are busy - load test may need to wait');
  }

  return true;
}

async function checkDiskSpace() {
  header('Disk Space');

  // Use PowerShell for more reliable disk space check on Windows
  const diskInfo = exec('powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N=\'FreeGB\';E={[math]::Round($_.Free/1GB,1)}},@{N=\'UsedGB\';E={[math]::Round($_.Used/1GB,1)}} | ConvertTo-Json"');

  if (diskInfo) {
    try {
      const drives = JSON.parse(diskInfo);
      const driveList = Array.isArray(drives) ? drives : [drives];

      for (const drive of driveList) {
        if (drive.Name === 'C' || drive.Name === 'D') {
          const freeGB = drive.FreeGB || 0;
          const passed = freeGB >= CONFIG.minDiskSpaceGB;
          checkResult(`${drive.Name}: Drive`, passed, `${freeGB} GB free`);
          if (!passed) return false;
        }
      }
    } catch (e) {
      warning('Disk Space', 'could not parse disk info');
    }
  } else {
    warning('Disk Space', 'could not check disk space');
  }

  // Check Docker disk usage
  const dockerDf = exec('docker system df --format "{{.Type}}: {{.Size}} ({{.Reclaimable}} reclaimable)"');
  if (dockerDf) {
    log(`  Docker disk usage:`, c.dim);
    dockerDf.split('\n').forEach(line => log(`    ${line}`, c.dim));
  }

  return true;
}

async function checkBackupStatus() {
  header('Backup Status');

  // Check backup container logs
  const logs = exec('docker logs abcc-backup --tail 5 2>&1');
  if (logs) {
    const hasError = logs.toLowerCase().includes('error') || logs.toLowerCase().includes('failed');
    const lastBackup = logs.match(/Backup completed|backup successful/i);

    if (hasError && !lastBackup) {
      checkResult('Backup Service', false, 'errors in recent logs');
      return false;
    }

    checkResult('Backup Service', true, 'running');
  }

  // Check backup mirror directory - find most recent backup
  const backupBaseDir = 'C:\\dev\\abcc-backups\\daily';
  const backupDirs = exec(`dir "${backupBaseDir}" /b /ad /od 2>nul`);
  if (backupDirs) {
    const dirs = backupDirs.split('\n').filter(d => d.trim() && /^\d{8}_\d{6}$/.test(d.trim()));
    if (dirs.length > 0) {
      const latestDir = dirs[dirs.length - 1].trim();
      const latestPath = `${backupBaseDir}\\${latestDir}`;
      const files = exec(`dir "${latestPath}" /b 2>nul`);
      const fileCount = files ? files.split('\n').filter(f => f.trim()).length : 0;

      // Check backup age
      const match = latestDir.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
      if (match) {
        const backupDate = new Date(match[1], match[2] - 1, match[3], match[4], match[5], match[6]);
        const ageHours = (Date.now() - backupDate) / (1000 * 60 * 60);
        if (ageHours > 1) {
          warning('Backup Age', `latest backup is ${ageHours.toFixed(1)} hours old`);
        }
        checkResult('Backup Mirror', true, `${fileCount} files in ${latestDir}`);
      } else {
        checkResult('Backup Mirror', true, `${fileCount} files`);
      }
    } else {
      warning('Backup Mirror', 'no backup folders found');
    }
  } else {
    warning('Backup Mirror', 'backup directory not accessible');
  }

  return true;
}

async function runTrivyScan() {
  header('Trivy Vulnerability Scan');

  if (skipTrivy) {
    log('  [SKIP] Trivy scan skipped (--skip-trivy flag)', c.yellow);
    return true;
  }

  // Check if Trivy is installed
  const trivyVersion = exec('trivy --version');
  if (!trivyVersion) {
    warning('Trivy', 'not installed (install with: winget install AquaSecurity.Trivy)');
    return true; // Don't fail for missing Trivy
  }

  log(`  Trivy version: ${trivyVersion.split('\n')[0]}`, c.dim);
  log(`  Scanning for ${CONFIG.trivySeverity} vulnerabilities...`, c.dim);

  // Scan the project for filesystem vulnerabilities
  const projectPath = path.resolve(__dirname, '..');
  const scanResult = exec(`trivy fs --severity ${CONFIG.trivySeverity} --exit-code 0 --format json "${projectPath}" 2>nul`);

  if (scanResult) {
    try {
      const results = JSON.parse(scanResult);
      let vulnCount = 0;
      let criticalCount = 0;
      let highCount = 0;

      if (results.Results) {
        for (const result of results.Results) {
          if (result.Vulnerabilities) {
            for (const vuln of result.Vulnerabilities) {
              vulnCount++;
              if (vuln.Severity === 'CRITICAL') criticalCount++;
              if (vuln.Severity === 'HIGH') highCount++;
            }
          }
        }
      }

      if (criticalCount > 0) {
        checkResult('Trivy Scan', false, `${criticalCount} CRITICAL, ${highCount} HIGH vulnerabilities`);
        return false;
      } else if (highCount > 0) {
        warning('Trivy Scan', `${highCount} HIGH vulnerabilities found`);
        checkResult('Trivy Scan', true, `no CRITICAL, ${highCount} HIGH vulnerabilities`);
      } else {
        checkResult('Trivy Scan', true, 'no HIGH/CRITICAL vulnerabilities');
      }
    } catch (e) {
      warning('Trivy Scan', 'could not parse results');
    }
  } else {
    warning('Trivy Scan', 'scan returned no results');
  }

  // Scan Docker images
  log(`  Scanning Docker images...`, c.dim);
  const images = ['abcc-api', 'abcc-agents', 'abcc-ui', 'abcc-mcp-gateway'];
  let imageVulns = 0;

  for (const image of images) {
    const imageScan = exec(`trivy image --severity CRITICAL --exit-code 0 --quiet ${image}:latest 2>nul`);
    if (imageScan && imageScan.includes('CRITICAL')) {
      imageVulns++;
      warning(`Image ${image}`, 'has CRITICAL vulnerabilities');
    }
  }

  if (imageVulns === 0) {
    checkResult('Docker Images', true, 'no CRITICAL vulnerabilities in custom images');
  }

  return true;
}

async function checkResourcePool() {
  header('Resource Pool Status');

  const response = await fetch('http://localhost:3001/api/queue/resources');
  if (!response || !response.ok) {
    warning('Resource Pool', 'cannot fetch status');
    return true;
  }

  const data = await response.json();
  const ollama = data.summary?.ollama || {};
  const claude = data.summary?.claude || {};

  const ollamaAvailable = (ollama.maxSlots || 0) - (ollama.activeSlots || 0);
  const claudeAvailable = (claude.maxSlots || 0) - (claude.activeSlots || 0);

  log(`  Ollama slots: ${ollamaAvailable}/${ollama.maxSlots || 0} available`, c.dim);
  log(`  Claude slots: ${claudeAvailable}/${claude.maxSlots || 0} available`, c.dim);

  const allAvailable = ollamaAvailable > 0 && claudeAvailable > 0;
  checkResult('Resource Pool', allAvailable, allAvailable ? 'resources available' : 'some resources busy');

  return allAvailable;
}

async function clearPendingTasks() {
  header('Clear Pending Tasks');

  if (!clearTasks) {
    log('  [SKIP] Task clearing skipped (use --clear-tasks to enable)', c.dim);
    return true;
  }

  // Get pending task count
  const pendingCount = exec('docker exec abcc-postgres psql -U postgres -d abcc -c "SELECT COUNT(*) FROM tasks WHERE status = \'pending\';" -t');
  const count = pendingCount ? parseInt(pendingCount.trim(), 10) : 0;

  if (count === 0) {
    log('  No pending tasks to clear', c.dim);
    return true;
  }

  log(`  Clearing ${count} pending tasks...`, c.yellow);

  // Delete pending tasks
  const deleteResult = exec('docker exec abcc-postgres psql -U postgres -d abcc -c "DELETE FROM tasks WHERE status = \'pending\';"');
  if (deleteResult && deleteResult.includes('DELETE')) {
    checkResult('Clear Tasks', true, `removed ${count} pending tasks`);
  } else {
    checkResult('Clear Tasks', false, 'failed to clear tasks');
    return false;
  }

  // Reset agent status to idle
  exec('docker exec abcc-postgres psql -U postgres -d abcc -c "UPDATE agents SET status = \'idle\', current_task_id = NULL;"');

  // Clear resource pool
  const clearPool = await fetchWithTimeout('http://localhost:3001/api/queue/resources/clear', { method: 'POST' });
  if (clearPool && clearPool.ok) {
    log('  Resource pool cleared', c.dim);
  }

  return true;
}

async function runLoadTest() {
  header('Load Test Execution');

  if (skipLoadTest) {
    log('  [SKIP] Load test skipped (--skip-load-test flag)', c.yellow);
    return true;
  }

  log('  Starting load-test-20-tasks-queue.js...', c.cyan);
  console.log();

  return new Promise((resolve) => {
    const loadTestPath = path.join(__dirname, 'load-test-20-tasks-queue.js');
    const child = spawn('node', [loadTestPath], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });

    child.on('close', (code) => {
      console.log();
      if (code === 0) {
        checkResult('Load Test', true, 'completed successfully');
        resolve(true);
      } else {
        checkResult('Load Test', false, `exited with code ${code}`);
        resolve(false);
      }
    });

    child.on('error', (err) => {
      checkResult('Load Test', false, err.message);
      resolve(false);
    });
  });
}

function printSummary() {
  header('Health Check Summary');

  console.log();
  log(`  Passed: ${results.passed.length}`, c.green);
  log(`  Failed: ${results.failed.length}`, c.red);
  log(`  Warnings: ${results.warnings.length}`, c.yellow);

  if (results.failed.length > 0) {
    console.log();
    log('  Failed checks:', c.red);
    results.failed.forEach(f => log(`    - ${f}`, c.red));
  }

  if (results.warnings.length > 0) {
    console.log();
    log('  Warnings:', c.yellow);
    results.warnings.forEach(w => log(`    - ${w.name}: ${w.message}`, c.yellow));
  }

  console.log();

  return results.failed.length === 0;
}

// Main execution
async function main() {
  console.log();
  log('╔════════════════════════════════════════════════════════════╗', c.bold + c.cyan);
  log('║     Agent Battle Command Center - Full System Health Check  ║', c.bold + c.cyan);
  log('╚════════════════════════════════════════════════════════════╝', c.bold + c.cyan);
  log(`  Started: ${new Date().toISOString()}`, c.dim);

  // Run all health checks
  const containerHealth = await checkDockerContainers();
  const endpointHealth = await checkServiceEndpoints();
  const dbHealth = await checkDatabase();
  const redisHealth = await checkRedis();
  const ollamaHealth = await checkOllama();
  const agentHealth = await checkAgentStatus();
  const diskHealth = await checkDiskSpace();
  const backupHealth = await checkBackupStatus();
  const trivyHealth = await runTrivyScan();
  const resourceHealth = await checkResourcePool();

  // Print summary before load test
  const allHealthy = printSummary();

  if (!allHealthy) {
    log('  System health checks failed. Fix issues before running load test.', c.red);
    process.exit(1);
  }

  if (results.warnings.length > 0) {
    log('  Warnings present but proceeding...', c.yellow);
  }

  // Clear pending tasks if requested
  const clearSuccess = await clearPendingTasks();
  if (!clearSuccess) {
    log('  Failed to clear tasks. Aborting.', c.red);
    process.exit(1);
  }

  // Run load test if all checks passed
  const loadTestSuccess = await runLoadTest();

  // Final result
  console.log();
  if (loadTestSuccess || skipLoadTest) {
    log('╔════════════════════════════════════════════════════════════╗', c.bold + c.green);
    log('║              ALL SYSTEMS OPERATIONAL                        ║', c.bold + c.green);
    log('╚════════════════════════════════════════════════════════════╝', c.bold + c.green);
    process.exit(0);
  } else {
    log('╔════════════════════════════════════════════════════════════╗', c.bold + c.red);
    log('║              LOAD TEST FAILED                               ║', c.bold + c.red);
    log('╚════════════════════════════════════════════════════════════╝', c.bold + c.red);
    process.exit(1);
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, c.red);
  process.exit(1);
});
