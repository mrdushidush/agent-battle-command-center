#!/usr/bin/env node

/**
 * Landing Page Full 5-Tier Pipeline Test
 *
 * Phase 1: Sonnet decomposes landing page into 11 atomic subtasks (via CTO agent)
 * Phase 2: Haiku validates all subtasks are complete and ready for Ollama
 * Phase 3: Ollama executes all subtasks sequentially
 * Phase 4: Sonnet reviews the result
 * Phase 5: Haiku fixes any issues found by Sonnet
 *
 * Run: node scripts/landing-page-decomposition-test.js
 * Est. cost: ~$0.10-0.20 (Sonnet decomp ~$0.04 + Haiku validation ~$0.01 + Sonnet review ~$0.04 + Haiku fixes ~$0.02)
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34';

const REST_DELAY_MS = 3000;
const RESET_EVERY_N = 3;

// Model identifiers
const DECOMP_MODEL = 'claude-sonnet-4-5-20250929';
const SONNET_MODEL = 'claude-sonnet-4-5-20250929';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// Rate limit safety: 30K input TPM shared across all Claude models
// Pause between Claude API phases to avoid hitting limits
const INTER_PHASE_PAUSE_MS = 65000; // 65s > 1 minute window

const LANDING_PAGE_DESCRIPTION = `Decompose this task into EXACTLY 11 atomic subtasks using the create_subtask tool.
Use the PARENT_TASK_ID provided above as the parent_task_id argument for each create_subtask call.

Build a promotional landing page for "Agent Battle Command Center" (ABCC) as static files in tasks/landing/.

═══════════════════════════════════════════════════════════════════
IMPORTANT: Each subtask description must be VERY DETAILED — include the FULL specification
of what the file should contain. The coder agent CANNOT see other files, so each subtask
description must be SELF-CONTAINED with ALL needed information (exact CSS values, class names,
HTML structure, JS function signatures, etc.). Write 20-40 lines of description per subtask.
═══════════════════════════════════════════════════════════════════

ABCC BRAND GUIDE (include in EVERY subtask that needs it):
- Background: #0a0a1a (near-black with blue tint)
- Surface/card bg: #111127
- Border: #1e1e3a
- Primary accent: #6366f1 (indigo)
- Secondary accent: #00ff88 (neon green — used for success states, glows, highlights)
- Text primary: #e2e8f0
- Text secondary: #94a3b8
- Danger/error: #ef4444
- Font: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace
- Border radius: 8px for cards, 4px for buttons
- Box shadow glow: 0 0 20px rgba(99, 102, 241, 0.3)

CREATE EXACTLY THESE 11 SUBTASKS IN THIS ORDER:

SUBTASK 1: Create directory structure
- Run: mkdir -p tasks/landing/css tasks/landing/js
- This is a shell command task, not a file write

SUBTASK 2: css/reset.css
- Modern CSS reset (box-sizing border-box on *, margin/padding 0)
- html { scroll-behavior: smooth; font-size: 16px }
- body { font-family: 'JetBrains Mono', monospace; background: #0a0a1a; color: #e2e8f0; line-height: 1.6; overflow-x: hidden }
- a { color: #6366f1; text-decoration: none } a:hover { color: #00ff88 }
- img { max-width: 100%; display: block }
- ul { list-style: none }
- button { cursor: pointer; border: none; font-family: inherit }

SUBTASK 3: css/variables.css
- :root with ALL brand colors as CSS custom properties: --bg-dark: #0a0a1a; --bg-surface: #111127; --bg-card: #1a1a3e; --border: #1e1e3a; --primary: #6366f1; --accent: #00ff88; --text: #e2e8f0; --text-muted: #94a3b8; --danger: #ef4444; --font-mono: 'JetBrains Mono', 'Fira Code', monospace
- Spacing: --space-xs: 0.5rem through --space-3xl: 6rem
- --radius: 8px; --radius-sm: 4px
- --shadow-glow: 0 0 20px rgba(99, 102, 241, 0.3)
- --shadow-green: 0 0 20px rgba(0, 255, 136, 0.3)
- --transition: all 0.3s ease
- --max-width: 1200px

SUBTASK 4: css/layout.css
- .container { max-width: var(--max-width); margin: 0 auto; padding: 0 2rem }
- nav.navbar { position: fixed; top: 0; width: 100%; background: rgba(10,10,26,0.95); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); z-index: 1000; padding: 1rem 0 }
- .nav-brand { font-size: 1.5rem; font-weight: 700; color: var(--accent) } .nav-brand span { color: var(--primary) }
- .nav-links { display: flex; gap: 2rem; align-items: center } .nav-links a { color: var(--text-muted) } .nav-links a:hover { color: var(--accent) }
- .hamburger { display: none; flex-direction: column; gap: 5px; background: none } .hamburger span { width: 25px; height: 2px; background: var(--text) }
- section { padding: 6rem 0 } section:nth-child(even) { background: var(--bg-surface) }
- .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem }
- .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem }
- .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem }
- .section-title { text-align: center; font-size: 2.5rem; margin-bottom: 1rem; color: var(--text) }
- .section-subtitle { text-align: center; color: var(--text-muted); margin-bottom: 3rem; max-width: 600px; margin-left: auto; margin-right: auto }
- @media (max-width: 768px): grids become 1 column, .nav-links hide, .hamburger shows, .nav-links.active shows as column
- footer { background: var(--bg-surface); border-top: 1px solid var(--border); padding: 3rem 0; text-align: center; color: var(--text-muted) }

SUBTASK 5: css/components.css
- .btn { padding: 0.75rem 2rem; border-radius: var(--radius-sm); font-weight: 600; transition: var(--transition); display: inline-block }
- .btn-primary { background: var(--primary); color: white } .btn-primary:hover { background: #818cf8; box-shadow: var(--shadow-glow) }
- .btn-accent { background: var(--accent); color: #0a0a1a } .btn-accent:hover { box-shadow: var(--shadow-green) }
- .btn-outline { border: 1px solid var(--primary); color: var(--primary) } .btn-outline:hover { background: var(--primary); color: white }
- .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; transition: var(--transition) } .card:hover { transform: translateY(-4px); box-shadow: var(--shadow-glow); border-color: var(--primary) }
- .card-icon { font-size: 2.5rem; margin-bottom: 1rem }
- .card h3 { font-size: 1.25rem; margin-bottom: 0.75rem; color: var(--text) }
- .card p { color: var(--text-muted); font-size: 0.9rem }
- .stat-item { text-align: center; padding: 2rem }
- .stat-number { font-size: 3rem; font-weight: 700; color: var(--accent); display: block }
- .stat-label { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem }
- .pricing-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2.5rem; text-align: center; transition: var(--transition) }
- .pricing-card.featured { border-color: var(--accent); transform: scale(1.05); box-shadow: var(--shadow-green) }
- .pricing-card .price { font-size: 3rem; color: var(--accent); font-weight: 700 } .price span { font-size: 1rem; color: var(--text-muted) }
- .pricing-card .plan-name { font-size: 1.25rem; color: var(--text); margin-bottom: 1rem }
- .pricing-card ul { margin: 1.5rem 0; text-align: left } .pricing-card li { padding: 0.5rem 0; color: var(--text-muted); border-bottom: 1px solid var(--border) } .pricing-card li::before { content: "\\2713 "; color: var(--accent) }
- .testimonial { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; position: relative }
- .testimonial::before { content: "\\201C"; font-size: 4rem; color: var(--primary); position: absolute; top: -10px; left: 15px; opacity: 0.3 }
- .testimonial p { font-style: italic; color: var(--text-muted); margin-bottom: 1rem }
- .testimonial .author { color: var(--accent); font-weight: 600 }
- .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600 }
- .badge-green { background: rgba(0,255,136,0.1); color: var(--accent); border: 1px solid rgba(0,255,136,0.3) }
- .architecture-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent); white-space: pre; overflow-x: auto; line-height: 1.4 }
- .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; position: relative; padding-top: 80px }
- .hero h1 { font-size: 3.5rem; font-weight: 800; margin-bottom: 1.5rem } .hero h1 .accent { color: var(--accent) } .hero h1 .primary { color: var(--primary) }
- .hero p { font-size: 1.25rem; color: var(--text-muted); max-width: 600px; margin: 0 auto 2rem }
- .hero-buttons { display: flex; gap: 1rem; justify-content: center }
- #particles { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0 }
- .hero-content { position: relative; z-index: 1 }
- .cta-section { text-align: center; padding: 6rem 0; background: linear-gradient(135deg, #111127 0%, #1a1a3e 100%) }

SUBTASK 6: css/animations.css
- @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px) } to { opacity: 1; transform: translateY(0) } }
- @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
- @keyframes pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.05) } }
- @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.3) } 50% { box-shadow: 0 0 40px rgba(99,102,241,0.6) } }
- @keyframes float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
- .animate-on-scroll { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease }
- .animate-on-scroll.visible { opacity: 1; transform: translateY(0) }
- .pulse { animation: pulse 2s ease-in-out infinite }
- .glow { animation: glow 3s ease-in-out infinite }
- .float { animation: float 3s ease-in-out infinite }

SUBTASK 7: js/nav.js
- querySelector('.hamburger') click toggles 'active' class on querySelector('.nav-links')
- Close menu when a nav link is clicked (querySelectorAll('.nav-links a') forEach addEventListener)
- Close menu on window resize if width > 768px
- Wrap in DOMContentLoaded event listener

SUBTASK 8: js/scroll.js
- Use IntersectionObserver with threshold 0.1 and rootMargin '0px 0px -50px 0px'
- Query all '.animate-on-scroll' elements
- When entry.isIntersecting, add 'visible' class and optionally unobserve
- Add staggered delays: each element gets style.transitionDelay = index * 0.1 + 's'
- Wrap in DOMContentLoaded event listener

SUBTASK 9: js/counters.js
- On DOMContentLoaded, use IntersectionObserver on elements with class '.stat-number'
- Each .stat-number element has a data-target attribute with the final number
- When visible, animate from 0 to data-target value over 2 seconds using requestAnimationFrame
- Use easeOutQuad easing: t * (2 - t)
- Format numbers: if target >= 1000, show with comma separators
- If data-suffix attribute exists (like '%' or '$'), append it
- Only animate once (unobserve after animation)

SUBTASK 10: js/particles.js
- Get canvas#particles element, set width/height to window.innerWidth/innerHeight
- Create array of 80 particle objects: { x, y, vx, vy, radius (1-3), color (randomly #6366f1 or #00ff88 with alpha 0.3-0.7) }
- Animation loop with requestAnimationFrame: clear canvas, draw each particle as filled circle, update positions
- Particles wrap around edges (if x > width, x = 0, etc.)
- Draw lines between particles within 120px distance, line color rgba(99,102,241,0.1)
- Handle window resize: update canvas width/height
- Wrap in DOMContentLoaded

SUBTASK 11: index.html (MUST BE LAST — depends on all CSS/JS)
- DOCTYPE html, lang="en", meta charset UTF-8, meta viewport
- Title: "Agent Battle Command Center — AI-Powered Code Orchestration"
- Link all 5 CSS files: css/reset.css, css/variables.css, css/layout.css, css/components.css, css/animations.css
- Google Fonts link for JetBrains Mono (weights 400,600,700,800)
- NAV: .navbar > .container > .nav-brand "ABCC" (with span coloring: A=accent, BCC=primary) + .nav-links (Features, Architecture, Pricing, Testimonials) + .hamburger (3 spans)
- HERO section: canvas#particles + .hero-content > h1 "Agent Battle <span class=accent>Command</span> <span class=primary>Center</span>" + p "AI-powered code orchestration with cost-optimized tiered routing. 4 AI tiers working in harmony." + .hero-buttons (2 buttons: "Get Started" btn-accent, "View Demo" btn-outline)
- FEATURES section#features: .section-title "How It Works" + .section-subtitle "Four AI tiers..." + .grid-4 with 4 .card.animate-on-scroll: (1) icon robot, "Ollama (Free)", "Local GPU execution...qwen2.5-coder:7b...88% success rate"; (2) icon zap, "Haiku ($0.007)", "Complex task execution..."; (3) icon brain, "Sonnet ($0.04)", "Extreme complexity..."; (4) icon crown, "Opus ($0.075)", "Decomposition & code review only..."
- ARCHITECTURE section#architecture: .section-title + .architecture-box containing ASCII art: UI(React:5173) -> API(Express:3001) -> Agents(FastAPI:8000) -> Ollama/Claude, with PostgreSQL below
- STATS section#stats: .section-title "Battle-Tested Results" + .grid-4 with .stat-item.animate-on-scroll: (1) .stat-number data-target="40" "0" + .stat-label "Tasks Completed"; (2) .stat-number data-target="88" data-suffix="%" "0" + .stat-label "Success Rate"; (3) .stat-number data-target="0.06" data-prefix="$" "0" + .stat-label "Avg Cost/Run"; (4) .stat-number data-target="4" "0" + .stat-label "AI Tiers"
- PRICING section#pricing: .section-title + .grid-3 with 3 .pricing-card.animate-on-scroll: (1) Free tier — $0/mo, Ollama local GPU, 100 tasks/day, Community support; (2) Pro tier .featured — $29/mo, Ollama + Haiku + Sonnet, Unlimited tasks, Priority support, Code reviews; (3) Enterprise — $99/mo, All tiers + Opus, Custom models, Dedicated support, SLA guarantee
- TESTIMONIALS section#testimonials: .section-title + .grid-3 with 3 .testimonial.animate-on-scroll: (1) "Completed 40 tasks in under an hour. One write, one verify, mission complete." — .author "CodeX-7 'Swift'" .badge.badge-green "Coder Agent"; (2) "Quality gate holding at 100%. No bad code gets past my review." — .author "QA-Sentinel" .badge.badge-green "QA Agent"; (3) "Decomposed a landing page into 11 atomic subtasks in 80 seconds." — .author "CTO-Sentinel" .badge.badge-green "CTO Agent"
- CTA section .cta-section: h2 "Ready to Deploy Your AI Army?" + p "Start orchestrating..." + .btn.btn-accent "Deploy Now"
- FOOTER: p "2026 Agent Battle Command Center. Built with AI, for AI." + p small "Powered by Ollama, Claude, and pure determination."
- Load 4 JS files before </body>: js/nav.js, js/scroll.js, js/counters.js, js/particles.js

RULES:
- Each subtask = ONE file (except subtask 1 which creates directories).
- suggested_agent must be "coder" for all subtasks.
- validation_command should ONLY check file existence, nothing else. Format:
  import os; assert os.path.exists('tasks/landing/css/reset.css'), 'File missing'; print('OK')
  Do NOT check file contents in validation — content review is handled separately by Sonnet.
- acceptance_criteria: what the file must contain (brief summary).
- After creating ALL 11 subtasks, call complete_decomposition.`;

// Expected files for validation
const EXPECTED_FILES = [
  'tasks/landing/css/reset.css',
  'tasks/landing/css/variables.css',
  'tasks/landing/css/layout.css',
  'tasks/landing/css/components.css',
  'tasks/landing/css/animations.css',
  'tasks/landing/js/nav.js',
  'tasks/landing/js/scroll.js',
  'tasks/landing/js/counters.js',
  'tasks/landing/js/particles.js',
  'tasks/landing/index.html'
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

async function resetSystem() {
  console.log('  Resetting system...');
  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await fetch(`${API_BASE}/queue/resources/clear`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await fetch(`${API_BASE}/agents/ollama-reset-counter`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    console.log('   > Agents, resources, and Ollama counter reset');
  } catch (e) {
    console.log('   ! Could not reset: ' + e.message);
  }

  try {
    const { execSync } = require('child_process');
    execSync('docker exec abcc-agents sh -c "rm -rf /app/workspace/tasks/landing 2>/dev/null; mkdir -p /app/workspace/tasks/landing"', { stdio: 'pipe' });
    console.log('   > Workspace tasks/landing/ cleaned');
  } catch (e) {
    console.log('   ! Could not clean workspace');
  }
  await sleep(2000);
}

async function waitForAgent(agentId, maxWaitMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`, { headers: { 'X-API-Key': API_KEY } });
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(2000);
  }
  return false;
}

async function runValidation(validationCode) {
  if (!validationCode) return null;
  try {
    const { execSync } = require('child_process');
    // Strip "python -c" or "python3 -c" prefix if present — we wrap with our own
    let code = validationCode.trim();
    const prefixMatch = code.match(/^python3?\s+-c\s+["'](.*)["']$/s);
    if (prefixMatch) {
      code = prefixMatch[1];
    } else if (code.startsWith('python3 -c ') || code.startsWith('python -c ')) {
      code = code.replace(/^python3?\s+-c\s+/, '');
      if ((code.startsWith('"') && code.endsWith('"')) || (code.startsWith("'") && code.endsWith("'"))) {
        code = code.slice(1, -1);
      }
    }
    const b64 = Buffer.from(code).toString('base64');
    const cmd = `docker exec -w /app/workspace abcc-agents python3 -c "import base64; exec(base64.b64decode('${b64}').decode())"`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    return result.includes('OK') || result.includes('PASS');
  } catch (e) {
    console.log(`    validation error: ${e.stderr?.substring(0, 150) || e.message?.substring(0, 150)}`);
    return false;
  }
}

async function assignToAgent(taskId, agentId) {
  await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ assignedAgentId: agentId, status: 'assigned' })
  });
}

async function completeTask(taskId, success, result) {
  await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ success, result })
  });
}

/** Rate limit pause between Claude API phases */
async function rateLimitPause(label) {
  console.log(`\n  Rate limit pause (${INTER_PHASE_PAUSE_MS / 1000}s) before ${label}...`);
  const start = Date.now();
  while (Date.now() - start < INTER_PHASE_PAUSE_MS) {
    const remaining = Math.ceil((INTER_PHASE_PAUSE_MS - (Date.now() - start)) / 1000);
    process.stdout.write(`\r  Waiting... ${remaining}s remaining   `);
    await sleep(1000);
  }
  process.stdout.write('\r  Ready.                              \n');
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: SONNET DECOMPOSITION (via CTO agent)
// ═══════════════════════════════════════════════════════════════════════════

async function phase1_decompose() {
  console.log('\n' + '='.repeat(70));
  console.log('  PHASE 1: SONNET DECOMPOSITION');
  console.log('='.repeat(70));
  console.log(`  Model: ${DECOMP_MODEL}`);
  console.log('  Agent: CTO-Sentinel (cto-01)');

  // Rate limit safety: wait before API call to ensure fresh token budget
  await rateLimitPause('Sonnet decomposition');

  // Create parent task
  const parentResp = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      title: '[LANDING] Build ABCC Landing Page',
      description: LANDING_PAGE_DESCRIPTION,
      taskType: 'code',
      priority: 10,
      maxIterations: 10
    })
  });
  const parentTask = await parentResp.json();
  console.log(`  Parent task: ${parentTask.id}`);

  // Assign to CTO
  await assignToAgent(parentTask.id, 'cto-01');
  console.log('  Assigned to: cto-01');

  // Execute with Sonnet via CTO agent
  console.log('  Executing Sonnet decomposition...');
  const decompStart = Date.now();

  const execResp = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: parentTask.id,
      agent_id: 'cto-01',
      task_description: `PARENT_TASK_ID: ${parentTask.id}\n\n${LANDING_PAGE_DESCRIPTION}`,
      expected_output: 'All subtasks created and decomposition marked complete.',
      use_claude: true,
      model: DECOMP_MODEL
    })
  });

  const decompTime = Math.floor((Date.now() - decompStart) / 1000);
  const execResult = await execResp.json();

  if (!execResult.success) {
    console.log(`   > Sonnet execution FAILED: ${execResult.error?.substring(0, 100)}`);
    console.log('   > Attempting to continue - checking if subtasks were created...');
  } else {
    console.log(`   > Sonnet execution completed (${decompTime}s)`);
  }

  // Complete the parent task to release CTO
  await completeTask(parentTask.id, true, { decomposed: true });
  await waitForAgent('cto-01', 30000);

  // Fetch subtasks
  console.log('  Fetching subtasks...');
  const subtasksResp = await fetch(`${API_BASE}/task-planning/${parentTask.id}/subtasks`, {
    headers: { 'X-API-Key': API_KEY }
  });
  const subtasksData = await subtasksResp.json();
  const subtasks = subtasksData.subtasks || [];

  console.log(`\n  DECOMPOSITION RESULT:`);
  console.log(`   > Subtasks created: ${subtasks.length}`);
  console.log(`   > Time: ${decompTime}s`);
  if (execResult.metrics) {
    const cost = execResult.metrics.api_credits_used || 0;
    console.log(`   > Est. cost: $${typeof cost === 'number' ? cost.toFixed(4) : cost}`);
  }

  if (subtasks.length === 0) {
    console.error('\n  ERROR: No subtasks created. Sonnet may have failed to call create_subtask.');
    console.error('  Check docker logs: docker logs abcc-agents --tail 100');
    process.exit(1);
  }

  // Print subtask list
  console.log('\n  Subtasks:');
  subtasks.forEach((st, i) => {
    console.log(`   ${i + 1}. ${st.title?.replace('[LANDING] ', '') || 'Untitled'}`);
  });

  return { parentTaskId: parentTask.id, subtasks, decompTime, decompCost: execResult.metrics?.api_credits_used || 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: HAIKU SUBTASK VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

async function phase2_validate(subtasks) {
  console.log('\n' + '='.repeat(70));
  console.log('  PHASE 2: HAIKU SUBTASK VALIDATION');
  console.log('='.repeat(70));
  console.log(`  Model: ${HAIKU_MODEL}`);
  console.log('  Agent: qa-01');
  console.log(`  Checking ${subtasks.length} subtasks are Ollama-ready`);

  await rateLimitPause('Haiku validation');

  // Reset agents
  await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
  await sleep(2000);

  // Build subtask summary for Haiku to review
  const subtaskSummary = subtasks.map((st, i) =>
    `${i + 1}. "${st.title}"\n   Description (first 200 chars): ${(st.description || '').substring(0, 200)}...\n   Validation: ${st.validationCommand || 'none'}`
  ).join('\n\n');

  const validateDesc = `You are reviewing ${subtasks.length} subtasks that will be sent to a local Ollama model (qwen2.5-coder:7b) for execution.

The landing page needs EXACTLY these 10 files plus 1 directory setup:
1. Directory structure (mkdir -p tasks/landing/css tasks/landing/js)
2. tasks/landing/css/reset.css
3. tasks/landing/css/variables.css
4. tasks/landing/css/layout.css
5. tasks/landing/css/components.css
6. tasks/landing/css/animations.css
7. tasks/landing/js/nav.js
8. tasks/landing/js/scroll.js
9. tasks/landing/js/counters.js
10. tasks/landing/js/particles.js
11. tasks/landing/index.html (must be LAST)

HERE ARE THE SUBTASKS TO VALIDATE:

${subtaskSummary}

CHECK:
1. Are all 10 files + 1 directory task covered? List any MISSING files.
2. Are there DUPLICATE subtasks (same file twice)?
3. Does each subtask description contain enough detail for a coder to write the file WITHOUT seeing other files?
4. Is index.html the LAST subtask? (It depends on all CSS/JS files)
5. Do validation commands only check file existence (not content)?

Report your findings as a structured list. If any files are missing, say MISSING: filename. If duplicates exist, say DUPLICATE: filename.`;

  const validateResp = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      title: '[LANDING] Haiku subtask validation',
      description: validateDesc,
      taskType: 'review',
      priority: 5,
      maxIterations: 5
    })
  });
  const validateTask = await validateResp.json();
  console.log(`\n  Validation task: ${validateTask.id}`);

  await assignToAgent(validateTask.id, 'qa-01');
  console.log('  Assigned to: qa-01');

  console.log('  Executing Haiku validation...');
  const valStart = Date.now();

  const execResp = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: validateTask.id,
      agent_id: 'qa-01',
      task_description: validateDesc,
      expected_output: 'Validation complete. List of issues or confirmation all subtasks are ready.',
      use_claude: true,
      model: HAIKU_MODEL
    })
  });

  const valTime = Math.floor((Date.now() - valStart) / 1000);
  const execResult = await execResp.json();

  await completeTask(validateTask.id, true, execResult);
  await waitForAgent('qa-01', 30000);

  const output = execResult.output || execResult.error || '';
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  console.log(`   > Validation completed (${valTime}s)`);
  if (execResult.metrics) {
    const cost = execResult.metrics.api_credits_used || 0;
    console.log(`   > Est. cost: $${typeof cost === 'number' ? cost.toFixed(4) : cost}`);
  }

  // Check for missing/duplicate issues ourselves too
  const issues = [];
  const subtaskTitlesLower = subtasks.map(st => (st.title || '').toLowerCase() + ' ' + (st.description || '').toLowerCase());
  const expectedKeywords = [
    { file: 'reset.css', keywords: ['reset.css', 'css reset'] },
    { file: 'variables.css', keywords: ['variables.css', 'css variables', 'custom properties'] },
    { file: 'layout.css', keywords: ['layout.css', 'css layout'] },
    { file: 'components.css', keywords: ['components.css', 'css components'] },
    { file: 'animations.css', keywords: ['animations.css', 'css animations'] },
    { file: 'nav.js', keywords: ['nav.js', 'navigation'] },
    { file: 'scroll.js', keywords: ['scroll.js', 'scroll animation'] },
    { file: 'counters.js', keywords: ['counters.js', 'counter', 'stat counter'] },
    { file: 'particles.js', keywords: ['particles.js', 'particle'] },
    { file: 'index.html', keywords: ['index.html', 'html page', 'main page'] }
  ];

  for (const expected of expectedKeywords) {
    const found = subtaskTitlesLower.some(t => expected.keywords.some(kw => t.includes(kw)));
    if (!found) {
      issues.push({ type: 'missing', file: expected.file });
    }
  }

  // Check for duplicates (same keyword appearing in multiple subtasks)
  for (const expected of expectedKeywords) {
    const matches = subtaskTitlesLower.filter(t => expected.keywords.some(kw => t.includes(kw)));
    if (matches.length > 1) {
      issues.push({ type: 'duplicate', file: expected.file, count: matches.length });
    }
  }

  console.log(`\n  VALIDATION RESULT:`);
  if (issues.length === 0) {
    console.log('   > All 10 files + directory task accounted for');
    console.log('   > No duplicates detected');
    console.log('   > Subtasks ready for Ollama');
  } else {
    console.log(`   > Issues found: ${issues.length}`);
    issues.forEach((issue, i) => {
      if (issue.type === 'missing') {
        console.log(`   ${i + 1}. MISSING: ${issue.file}`);
      } else {
        console.log(`   ${i + 1}. DUPLICATE: ${issue.file} (${issue.count}x)`);
      }
    });
  }

  // Print Haiku's analysis (truncated)
  const cleanOutput = outputStr.replace(/\\u001b\[[^m]*m/g, '').replace(/\\n/g, '\n');
  const summaryMatch = cleanOutput.match(/Final Answer[:\s]*([\s\S]*?)(?:\n\n|$)/i);
  if (summaryMatch) {
    console.log(`\n  Haiku says:`);
    const lines = summaryMatch[1].trim().split('\n').slice(0, 8);
    lines.forEach(l => console.log(`   > ${l.trim().substring(0, 80)}`));
    if (summaryMatch[1].trim().split('\n').length > 8) console.log('   > ...(truncated)');
  }

  return {
    issues,
    validationTime: valTime,
    validationCost: execResult.metrics?.api_credits_used || 0,
    rawOutput: outputStr
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: OLLAMA EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

async function phase3_execute(subtasks) {
  console.log('\n' + '='.repeat(70));
  console.log('  PHASE 3: OLLAMA EXECUTION');
  console.log('='.repeat(70));
  console.log(`  ${subtasks.length} subtasks | Agent: coder-01 | Model: qwen2.5-coder:7b`);
  console.log(`  Rest: ${REST_DELAY_MS / 1000}s between tasks | Reset every ${RESET_EVERY_N} tasks\n`);

  // Reset coder agent before starting
  await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
  await sleep(2000);

  const results = [];
  let tasksSinceReset = 0;

  for (let i = 0; i < subtasks.length; i++) {
    const subtask = subtasks[i];
    const title = (subtask.title || 'Untitled').replace('[LANDING] ', '').substring(0, 50);
    console.log(`  [${i + 1}/${subtasks.length}] ${title}`);

    const taskStart = Date.now();
    let passed = false;
    let error = null;

    try {
      // Assign to coder
      await assignToAgent(subtask.id, 'coder-01');

      // Execute with Ollama
      const execResp = await fetch(`${AGENTS_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: subtask.id,
          agent_id: 'coder-01',
          task_description: subtask.description,
          expected_output: 'File created successfully.',
          use_claude: false,
          model: null
        })
      });

      if (!execResp.ok) throw new Error(`HTTP ${execResp.status}`);
      const execResult = await execResp.json();

      // Complete task
      await completeTask(subtask.id, execResult.success, execResult);
      await waitForAgent('coder-01', 120000);

      // Validate if validation command exists
      if (subtask.validationCommand) {
        passed = await runValidation(subtask.validationCommand);
      } else {
        passed = execResult.success;
      }
      tasksSinceReset++;

    } catch (e) {
      error = e.message;
      await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } }).catch(() => {});
      await sleep(3000);
      tasksSinceReset = 0;
    }

    const elapsed = Math.floor((Date.now() - taskStart) / 1000);
    const status = error ? 'ERROR' : (passed ? 'PASS' : 'FAIL');
    const icon = error ? '!!' : (passed ? 'OK' : 'XX');

    console.log(`   ${icon} ${status} (${elapsed}s)${error ? ' - ' + error.substring(0, 40) : ''}`);

    results.push({ index: i + 1, title: subtask.title, elapsed, status, error, taskId: subtask.id });

    // Rest & reset
    if (i < subtasks.length - 1) {
      await sleep(REST_DELAY_MS);

      if (tasksSinceReset >= RESET_EVERY_N) {
        console.log(`   ~~ Agent reset (${RESET_EVERY_N} tasks done)`);
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } }).catch(() => {});
        await sleep(1000);
        tasksSinceReset = 0;
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: SONNET CODE REVIEW
// ═══════════════════════════════════════════════════════════════════════════

async function phase4_review(executionResults) {
  console.log('\n' + '='.repeat(70));
  console.log('  PHASE 4: SONNET CODE REVIEW');
  console.log('='.repeat(70));
  console.log(`  Model: ${SONNET_MODEL}`);
  console.log('  Agent: qa-01');

  const passed = executionResults.filter(r => r.status === 'PASS').length;
  const failed = executionResults.filter(r => r.status !== 'PASS');

  await rateLimitPause('Sonnet review');

  // Reset agents
  await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
  await sleep(2000);

  // Create review task
  const failedList = failed.map(f => `  - ${f.title}: ${f.status}`).join('\n');
  const reviewDesc = `Review the landing page at tasks/landing/. Use file_list and file_read to inspect all files.

Execution results: ${passed}/${executionResults.length} passed.
${failed.length > 0 ? `Failed tasks:\n${failedList}` : 'All tasks passed.'}

Check:
1. Do all expected files exist? (css/reset.css, css/variables.css, css/layout.css, css/components.css, css/animations.css, js/nav.js, js/scroll.js, js/counters.js, js/particles.js, index.html)
2. Does index.html reference all CSS and JS files correctly?
3. Are there any obvious issues with the generated code?

Report what files are missing or broken. List specific fixes needed.`;

  const reviewResp = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      title: '[LANDING] Sonnet code review',
      description: reviewDesc,
      taskType: 'review',
      priority: 5,
      maxIterations: 10
    })
  });
  const reviewTask = await reviewResp.json();
  console.log(`\n  Review task: ${reviewTask.id}`);

  await assignToAgent(reviewTask.id, 'qa-01');
  console.log('  Assigned to: qa-01');

  console.log('  Executing Sonnet review...');
  const reviewStart = Date.now();

  const execResp = await fetch(`${AGENTS_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: reviewTask.id,
      agent_id: 'qa-01',
      task_description: reviewDesc,
      expected_output: 'Review complete with list of issues found and fixes needed.',
      use_claude: true,
      model: SONNET_MODEL
    })
  });

  const reviewTime = Math.floor((Date.now() - reviewStart) / 1000);
  const execResult = await execResp.json();

  await completeTask(reviewTask.id, true, execResult);
  await waitForAgent('qa-01', 30000);

  const output = execResult.output || execResult.error || '';
  console.log(`   > Review completed (${reviewTime}s)`);
  if (execResult.metrics) {
    const cost = execResult.metrics.api_credits_used || 0;
    console.log(`   > Est. cost: $${typeof cost === 'number' ? cost.toFixed(4) : cost}`);
  }

  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

  // Run our own file check
  const issues = [];
  try {
    const { execSync } = require('child_process');
    const files = execSync("docker exec abcc-agents sh -c 'find /app/workspace/tasks/landing -type f -not -name .gitkeep 2>/dev/null'", {
      encoding: 'utf8', timeout: 10000
    }).trim().split('\n').filter(f => f);

    const missingFiles = ['index.html', 'reset.css', 'variables.css', 'layout.css', 'components.css', 'animations.css',
      'nav.js', 'scroll.js', 'counters.js', 'particles.js'];

    for (const expected of missingFiles) {
      if (!files.some(f => f.includes(expected))) {
        issues.push({ type: 'missing_file', file: expected, fix: `Create tasks/landing/${expected.includes('.css') ? 'css/' : expected.includes('.js') ? 'js/' : ''}${expected}` });
      }
    }

    // Check if index.html has correct CSS/JS paths
    if (files.some(f => f.includes('index.html'))) {
      const html = execSync("docker exec abcc-agents sh -c 'cat /app/workspace/tasks/landing/index.html'", { encoding: 'utf8', timeout: 5000 });
      if (html.includes('../../css/') || html.includes('../../js/')) {
        issues.push({ type: 'bad_paths', file: 'index.html', fix: 'Fix CSS/JS paths: use css/ and js/ not ../../css/ and ../../js/' });
      }
      if (!html.includes('particles.js')) {
        issues.push({ type: 'missing_reference', file: 'index.html', fix: 'Add <script src="js/particles.js"></script> before </body>' });
      }
    }
  } catch (e) {
    console.log(`   > File check error: ${e.message}`);
  }

  console.log(`\n  REVIEW RESULT:`);
  console.log(`   > Issues found: ${issues.length}`);
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. [${issue.type}] ${issue.file}: ${issue.fix}`);
  });

  // Print truncated Sonnet review output
  const cleanOutput = outputStr.replace(/\\u001b\[[^m]*m/g, '').replace(/\\n/g, '\n');
  const summaryMatch = cleanOutput.match(/Final Answer[:\s]*([\s\S]*?)(?:\n\n|$)/i);
  if (summaryMatch) {
    console.log(`\n  Sonnet says:`);
    const lines = summaryMatch[1].trim().split('\n').slice(0, 10);
    lines.forEach(l => console.log(`   > ${l.trim().substring(0, 80)}`));
    if (summaryMatch[1].trim().split('\n').length > 10) console.log('   > ...(truncated)');
  }

  return { issues, reviewTime, reviewCost: execResult.metrics?.api_credits_used || 0, rawOutput: outputStr };
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: HAIKU FIXES (if needed)
// ═══════════════════════════════════════════════════════════════════════════

async function phase5_fix(issues) {
  if (issues.length === 0) {
    console.log('\n' + '='.repeat(70));
    console.log('  PHASE 5: HAIKU FIXES — SKIPPED (no issues found)');
    console.log('='.repeat(70));
    return [];
  }

  console.log('\n' + '='.repeat(70));
  console.log('  PHASE 5: HAIKU FIXES');
  console.log('='.repeat(70));
  console.log(`  Model: ${HAIKU_MODEL}`);
  console.log(`  Agent: qa-01`);
  console.log(`  Issues to fix: ${issues.length}`);

  await rateLimitPause('Haiku fixes');

  // Reset agents
  await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
  await sleep(2000);

  const fixResults = [];

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    console.log(`\n  [${i + 1}/${issues.length}] Fixing: ${issue.file} (${issue.type})`);

    let fixDesc;
    if (issue.type === 'missing_file') {
      fixDesc = `Use file_write to create the file ${issue.fix.replace('Create ', '')}.
This is for a dark-themed landing page for "Agent Battle Command Center".
Brand colors: background #0a0a1a, surface #111127, border #1e1e3a, primary #6366f1, accent #00ff88, text #e2e8f0, muted #94a3b8.
Font: 'JetBrains Mono', monospace.
${issue.file === 'index.html'
  ? 'Create a complete HTML page linking css/reset.css, css/variables.css, css/layout.css, css/components.css, css/animations.css. Include sections: Hero with canvas#particles, Features (4 .card in .grid-4), Stats (.stat-item with .stat-number[data-target]), Pricing (3 .pricing-card, middle has .featured), Testimonials (.testimonial with .author), CTA, Footer. Load js/nav.js, js/scroll.js, js/counters.js, js/particles.js before </body>.'
  : `Create appropriate ${issue.file.endsWith('.css') ? 'CSS' : 'JavaScript'} content for a dark-themed landing page.`}`;
    } else if (issue.type === 'bad_paths') {
      fixDesc = `Use file_read to read tasks/landing/index.html, then use file_write to rewrite it with corrected paths. Change all "../../css/" to "css/" and "../../js/" to "js/".`;
    } else {
      fixDesc = `Fix issue in tasks/landing/${issue.file}: ${issue.fix}. Use file_read to read the file, then file_write to fix it.`;
    }

    const fixResp = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({
        title: `[LANDING] Fix: ${issue.file}`,
        description: fixDesc,
        taskType: 'code',
        priority: 3,
        maxIterations: 10
      })
    });
    const fixTask = await fixResp.json();
    await assignToAgent(fixTask.id, 'qa-01');

    const fixStart = Date.now();
    const execResp = await fetch(`${AGENTS_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: fixTask.id,
        agent_id: 'qa-01',
        task_description: fixDesc,
        expected_output: 'File fixed/created successfully.',
        use_claude: true,
        model: HAIKU_MODEL
      })
    });

    const fixTime = Math.floor((Date.now() - fixStart) / 1000);
    const execResult = await execResp.json();

    await completeTask(fixTask.id, execResult.success, execResult);
    await waitForAgent('qa-01', 30000);

    const icon = execResult.success ? 'OK' : 'XX';
    const status = execResult.success ? 'FIXED' : 'FAILED';
    console.log(`   ${icon} ${status} (${fixTime}s)`);

    fixResults.push({
      issue: issue.file,
      type: issue.type,
      status,
      time: fixTime,
      cost: execResult.metrics?.api_credits_used || 0
    });

    // Brief pause between fixes
    if (i < issues.length - 1) await sleep(2000);
  }

  return fixResults;
}

// ═══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════════════════

function printFinalReport(decompResult, validationResult, execResults, reviewResult, fixResults, totalDuration) {
  const execPassed = execResults.filter(r => r.status === 'PASS').length;
  const execFailed = execResults.filter(r => r.status !== 'PASS').length;
  const fixesApplied = fixResults.filter(r => r.status === 'FIXED').length;
  const valIssues = validationResult.issues.length;

  console.log('\n' + '='.repeat(70));
  console.log('  FINAL REPORT');
  console.log('='.repeat(70));

  // Phase 1
  console.log('\n  PHASE 1 — Sonnet Decomposition');
  console.log(`   Subtasks: ${decompResult.subtasks.length} | Time: ${decompResult.decompTime}s | Cost: $${(decompResult.decompCost || 0).toFixed ? (decompResult.decompCost || 0).toFixed(4) : decompResult.decompCost}`);

  // Phase 2
  console.log('\n  PHASE 2 — Haiku Validation');
  console.log(`   Issues: ${valIssues} | Time: ${validationResult.validationTime}s | Cost: $${(validationResult.validationCost || 0).toFixed ? (validationResult.validationCost || 0).toFixed(4) : validationResult.validationCost}`);

  // Phase 3
  console.log('\n  PHASE 3 — Ollama Execution');
  console.log(`  ${'#'.padEnd(4)} ${'Task'.padEnd(45)} ${'Time'.padEnd(6)} Status`);
  console.log('  ' + '-'.repeat(65));
  execResults.forEach(r => {
    const title = (r.title || '').replace('[LANDING] ', '').substring(0, 43);
    console.log(`  ${String(r.index).padEnd(4)} ${title.padEnd(45)} ${(r.elapsed + 's').padEnd(6)} ${r.status}`);
  });
  console.log('  ' + '-'.repeat(65));
  console.log(`  Passed: ${execPassed}/${execResults.length} | Cost: $0.00`);

  // Phase 4
  console.log('\n  PHASE 4 — Sonnet Review');
  console.log(`   Issues: ${reviewResult.issues.length} | Time: ${reviewResult.reviewTime}s | Cost: $${(reviewResult.reviewCost || 0).toFixed ? (reviewResult.reviewCost || 0).toFixed(4) : reviewResult.reviewCost}`);

  // Phase 5
  if (fixResults.length > 0) {
    const fixCost = fixResults.reduce((sum, f) => sum + (f.cost || 0), 0);
    console.log('\n  PHASE 5 — Haiku Fixes');
    fixResults.forEach(f => {
      console.log(`   ${f.status === 'FIXED' ? 'OK' : 'XX'} ${f.issue} (${f.type}) — ${f.time}s`);
    });
    console.log(`  Fixed: ${fixesApplied}/${fixResults.length} | Cost: $${fixCost.toFixed(4)}`);
  }

  // Summary
  const totalCost = (decompResult.decompCost || 0) + (validationResult.validationCost || 0) +
    (reviewResult.reviewCost || 0) + fixResults.reduce((sum, f) => sum + (f.cost || 0), 0);

  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('  ' + '-'.repeat(40));
  console.log(`  Sonnet decomposition: ${decompResult.subtasks.length} subtasks`);
  console.log(`  Haiku validation:     ${valIssues} issues`);
  console.log(`  Ollama execution:     ${execPassed}/${execResults.length} passed`);
  console.log(`  Sonnet review:        ${reviewResult.issues.length} issues found`);
  console.log(`  Haiku fixes:          ${fixesApplied}/${fixResults.length || 0}`);
  console.log(`  Total time:           ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);
  console.log(`  Total cost:           $${totalCost.toFixed(4)}`);
  console.log('  ' + '-'.repeat(40));

  // Model breakdown
  console.log(`\n  Cost by tier:`);
  console.log(`   Sonnet (decomposition): $${(decompResult.decompCost || 0).toFixed(4)}`);
  console.log(`   Haiku (validation):     $${(validationResult.validationCost || 0).toFixed(4)}`);
  console.log(`   Ollama (execution):     $0.0000 (free)`);
  console.log(`   Sonnet (review):        $${(reviewResult.reviewCost || 0).toFixed(4)}`);
  const haikuFixCost = fixResults.reduce((sum, f) => sum + (f.cost || 0), 0);
  console.log(`   Haiku (fixes):          $${haikuFixCost.toFixed(4)}`);

  console.log('\n' + '='.repeat(70));

  // Final file listing
  console.log('\n  Generated files:');
  try {
    const { execSync } = require('child_process');
    const rawFiles = execSync("docker exec abcc-agents sh -c 'find /app/workspace/tasks/landing -type f -not -name .gitkeep'", {
      encoding: 'utf8', timeout: 10000
    });
    if (rawFiles.trim()) {
      rawFiles.trim().split('\n').sort().forEach(f => console.log(`   > ${f.replace('/app/workspace/', '')}`));
    }
  } catch (e) {
    console.log('   Could not list files');
  }

  return {
    timestamp: new Date().toISOString(),
    phases: {
      decomposition: { model: 'sonnet', subtasks: decompResult.subtasks.length, time: decompResult.decompTime, cost: decompResult.decompCost },
      validation: { model: 'haiku', issues: valIssues, time: validationResult.validationTime, cost: validationResult.validationCost },
      execution: { model: 'ollama', passed: execPassed, failed: execFailed, total: execResults.length, results: execResults },
      review: { model: 'sonnet', issues: reviewResult.issues.length, time: reviewResult.reviewTime, cost: reviewResult.reviewCost },
      fixes: { model: 'haiku', applied: fixesApplied, total: fixResults.length, results: fixResults }
    },
    totalDuration,
    totalCost
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('='.repeat(70));
  console.log('  LANDING PAGE 5-TIER PIPELINE TEST');
  console.log('  Sonnet decomposes → Haiku validates → Ollama executes');
  console.log('  → Sonnet reviews → Haiku fixes');
  console.log('='.repeat(70));
  console.log('  Phase 1: Sonnet (CTO) decomposes landing page into 11 subtasks');
  console.log('  Phase 2: Haiku (QA) validates subtasks are complete & ready');
  console.log('  Phase 3: Ollama (Coder) executes each subtask');
  console.log('  Phase 4: Sonnet (QA) reviews the result');
  console.log('  Phase 5: Haiku (QA) fixes any issues');
  console.log('='.repeat(70) + '\n');

  // Pre-flight
  console.log('  Pre-flight checks...');
  try {
    const resp = await fetch(`${API_BASE}/agents`, { headers: { 'X-API-Key': API_KEY } });
    const agents = await resp.json();
    const coder = agents.find(a => a.id === 'coder-01');
    const qa = agents.find(a => a.id === 'qa-01');
    const cto = agents.find(a => a.id === 'cto-01');
    if (!coder) throw new Error('coder-01 not found');
    if (!qa) throw new Error('qa-01 not found');
    if (!cto) throw new Error('cto-01 not found');
    console.log(`   > coder-01: ${coder.status}, qa-01: ${qa.status}, cto-01: ${cto.status}`);

    // Check Claude API availability
    const healthResp = await fetch(`${AGENTS_BASE}/health`);
    const health = await healthResp.json();
    if (!health.claude) throw new Error('Claude API not available');
    console.log('   > Claude API: available');
    console.log('   > Ready');
  } catch (e) {
    console.error(`  Pre-flight FAILED: ${e.message}`);
    process.exit(1);
  }

  await resetSystem();
  const globalStart = Date.now();

  // Phase 1: Sonnet decomposition
  const decompResult = await phase1_decompose();

  // Phase 2: Haiku subtask validation
  const validationResult = await phase2_validate(decompResult.subtasks);

  // Phase 3: Ollama execution
  const execResults = await phase3_execute(decompResult.subtasks);

  // Phase 4: Sonnet code review
  const reviewResult = await phase4_review(execResults);

  // Phase 5: Haiku fixes (if needed)
  const fixResults = await phase5_fix(reviewResult.issues);

  const totalDuration = Math.floor((Date.now() - globalStart) / 1000);

  // Final report
  const report = printFinalReport(decompResult, validationResult, execResults, reviewResult, fixResults, totalDuration);

  // Save results
  const fs = require('fs');
  fs.writeFileSync('scripts/landing-page-results.json', JSON.stringify(report, null, 2));
  console.log('\n  Results saved to scripts/landing-page-results.json');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
