#!/usr/bin/env node

/**
 * Overnight Self-Improvement Loop
 *
 * Sends 100 diverse prompts through the CTO Mission Orchestrator pipeline,
 * analyzes results, and writes a comprehensive findings report.
 *
 * Flow per iteration:
 *   1. Pick next prompt from PROMPT_BANK
 *   2. POST /api/missions (autoApprove=true, waitForCompletion=true, 10min timeout)
 *   3. Analyze results (status, subtasks, review, files, timing, cost)
 *   4. Append findings to overnight-findings-YYYY-MM-DD.md
 *   5. Wait 10s cooldown → next iteration
 *
 * Resilience:
 *   - Crash recovery via overnight-progress.json (skips completed on restart)
 *   - 10-minute timeout per mission
 *   - Error isolation per mission (catch + log + continue)
 *   - Cost cap ($10 default)
 *
 * Usage:
 *   node scripts/overnight-improve.js              # Run all 100 prompts
 *   node scripts/overnight-improve.js --max 5      # Run first 5 only
 *   node scripts/overnight-improve.js --resume     # Resume from progress file
 *   node scripts/overnight-improve.js --category 3 # Only category 3 (CLI Tools)
 *   node scripts/overnight-improve.js --shuffle     # Randomize prompt order
 *
 * Requires: ABCC stack running (docker compose up)
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  API_BASE: process.env.API_BASE || 'http://localhost:3001/api',
  API_KEY: process.env.API_KEY || 'ceb3e905f7b1b5e899645c6ec467ca34',
  COOLDOWN_MS: 15_000,           // 15s between missions (GPU rest)
  EXTENDED_COOLDOWN_MS: 60_000,  // 60s extended cooldown every 5th mission (VRAM clearing)
  EXTENDED_COOLDOWN_EVERY_N: 5,  // Trigger extended cooldown interval
  SLOW_MISSION_THRESHOLD_MS: 20 * 60_000,  // 20 min — warn about VRAM pressure
  MISSION_TIMEOUT_MS: 3_600_000,  // 60min per mission (no early timeout — prevents agent deadlocks)
  MAX_COST_USD: 10.00,           // Stop if cumulative cost exceeds this
  FINDINGS_DIR: path.join(__dirname),
  PROGRESS_FILE: path.join(__dirname, 'overnight-progress.json'),
};

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': CONFIG.API_KEY,
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function findingsPath() {
  return path.join(CONFIG.FINDINGS_DIR, `overnight-findings-${today()}.md`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT BANK — 100 prompts across 5 categories (20 each)
// ═══════════════════════════════════════════════════════════════════════════════

const PROMPT_BANK = [
  // ─── Category 1: Landing Pages & Websites (20 prompts, language: python) ────
  { id: 1, category: 'Landing Pages', language: 'python', prompt: "Build me a landing page for my coffee shop called 'Bean There'. Include a hero section, menu with prices, about us section, and contact form." },
  { id: 2, category: 'Landing Pages', language: 'python', prompt: "Create a portfolio website for a freelance photographer. Gallery grid, about section, pricing packages, contact form." },
  { id: 3, category: 'Landing Pages', language: 'python', prompt: "Build a SaaS product landing page for a project management tool called 'TaskFlow'. Hero, features grid, pricing table with 3 tiers, testimonials, CTA." },
  { id: 4, category: 'Landing Pages', language: 'python', prompt: "Create a restaurant website for an Italian place called 'Bella Notte'. Menu categories, reservation form, hours/location, photo gallery." },
  { id: 5, category: 'Landing Pages', language: 'python', prompt: "Build a gym/fitness studio landing page. Class schedule, trainer profiles, membership pricing, signup form." },
  { id: 6, category: 'Landing Pages', language: 'python', prompt: "Create a real estate agency website. Property listings grid, search filters, agent profiles, contact form." },
  { id: 7, category: 'Landing Pages', language: 'python', prompt: "Build a wedding photographer landing page. Portfolio gallery, packages/pricing, testimonials, booking form." },
  { id: 8, category: 'Landing Pages', language: 'python', prompt: "Create a local bakery website called 'Sweet Dreams'. Menu with categories, custom order form, about story, location map placeholder." },
  { id: 9, category: 'Landing Pages', language: 'python', prompt: "Build a tech startup landing page for an AI writing assistant. Hero with demo, feature comparison, pricing, FAQ accordion." },
  { id: 10, category: 'Landing Pages', language: 'python', prompt: "Create a nonprofit/charity website. Mission statement, impact stats, donation CTA, volunteer signup, latest news." },
  { id: 11, category: 'Landing Pages', language: 'python', prompt: "Build a personal blog homepage. Recent posts list, categories sidebar, about author section, newsletter signup." },
  { id: 12, category: 'Landing Pages', language: 'python', prompt: "Create a music band website. Tour dates, discography, band members, media player placeholder, merch section." },
  { id: 13, category: 'Landing Pages', language: 'python', prompt: "Build a dental clinic website. Services list, doctor profiles, appointment booking form, patient testimonials, insurance info." },
  { id: 14, category: 'Landing Pages', language: 'python', prompt: "Create an online course platform landing page. Course catalog grid, instructor bios, student reviews, pricing plans." },
  { id: 15, category: 'Landing Pages', language: 'python', prompt: "Build a pet grooming business website. Services menu, before/after gallery, booking form, pet care tips blog." },
  { id: 16, category: 'Landing Pages', language: 'python', prompt: "Create a law firm website. Practice areas, attorney profiles, case results, consultation request form, FAQ." },
  { id: 17, category: 'Landing Pages', language: 'python', prompt: "Build a food delivery service landing page. How it works steps, restaurant partners, pricing, download app CTA." },
  { id: 18, category: 'Landing Pages', language: 'python', prompt: "Create a coworking space website. Plans/pricing, amenities, virtual tour section, member testimonials, contact." },
  { id: 19, category: 'Landing Pages', language: 'python', prompt: "Build a travel agency landing page. Featured destinations, trip packages, customer reviews, booking inquiry form." },
  { id: 20, category: 'Landing Pages', language: 'python', prompt: "Create an event planning company website. Services offered, past events gallery, client testimonials, quote request form." },

  // ─── Category 2: Web Servers & APIs (20 prompts, language: varies) ──────────
  { id: 21, category: 'Web Servers', language: 'javascript', prompt: "Build me a quick Node.js web server with Express that has CRUD endpoints for a todo list. Include GET all, GET by id, POST create, PUT update, DELETE." },
  { id: 22, category: 'Web Servers', language: 'python', prompt: "Create a Python Flask REST API for a bookstore. Endpoints for books (CRUD), authors, and search by title/author." },
  { id: 23, category: 'Web Servers', language: 'javascript', prompt: "Build a Node.js API for a URL shortener. POST to create short URL, GET to redirect, GET stats for a URL." },
  { id: 24, category: 'Web Servers', language: 'python', prompt: "Create a Python REST API for a simple blog. Posts with title/content/author, comments, tags. Include pagination." },
  { id: 25, category: 'Web Servers', language: 'javascript', prompt: "Build a Node.js Express middleware collection: request logger, rate limiter, API key auth, error handler, CORS config." },
  { id: 26, category: 'Web Servers', language: 'python', prompt: "Create a Python weather API wrapper that fetches from a mock data source. Cache results, format responses, handle errors." },
  { id: 27, category: 'Web Servers', language: 'javascript', prompt: "Build a Node.js file upload API. Accept multiple files, validate types/sizes, return file metadata." },
  { id: 28, category: 'Web Servers', language: 'python', prompt: "Create a Python REST API for a quiz/trivia game. Questions, categories, scoring, leaderboard." },
  { id: 29, category: 'Web Servers', language: 'javascript', prompt: "Build a Node.js JWT authentication system. Register, login, refresh token, protected routes, password hashing." },
  { id: 30, category: 'Web Servers', language: 'python', prompt: "Create a Python inventory management API. Products with SKU, stock levels, reorder alerts, transaction history." },
  { id: 31, category: 'Web Servers', language: 'python', prompt: "Build a Python REST API for a recipe sharing platform. Recipes with ingredients, steps, ratings, user collections." },
  { id: 32, category: 'Web Servers', language: 'javascript', prompt: "Create a Node.js event booking API. Events, tickets, seat selection, booking confirmation, cancellation." },
  { id: 33, category: 'Web Servers', language: 'python', prompt: "Build a Python task queue API. Submit jobs, check status, get results, priority ordering, retry failed jobs." },
  { id: 34, category: 'Web Servers', language: 'javascript', prompt: "Create a Node.js real-time notification service. Subscribe to topics, receive notifications, mark as read, notification history." },
  { id: 35, category: 'Web Servers', language: 'python', prompt: "Build a Python REST API for a fitness tracker. Workouts, exercises, sets/reps, progress charts data, personal records." },
  { id: 36, category: 'Web Servers', language: 'javascript', prompt: "Create a Node.js API for a notes app. CRUD for notes, folders, tags, search, share notes." },
  { id: 37, category: 'Web Servers', language: 'python', prompt: "Build a Python API for a movie review platform. Movies, reviews, ratings, recommendations, watchlist." },
  { id: 38, category: 'Web Servers', language: 'javascript', prompt: "Create a Node.js expense splitting API. Groups, expenses, splits, balances, settlement suggestions." },
  { id: 39, category: 'Web Servers', language: 'python', prompt: "Build a Python API for a flashcard study app. Decks, cards, spaced repetition scheduling, progress tracking." },
  { id: 40, category: 'Web Servers', language: 'javascript', prompt: "Create a Node.js API for a polling/voting system. Create polls, vote, results with percentages, close polls." },

  // ─── Category 3: CLI Tools & Utilities (20 prompts, language: python) ───────
  { id: 41, category: 'CLI Tools', language: 'python', prompt: "Create a Python CLI tool that converts between file formats: JSON to CSV, CSV to JSON, JSON to YAML. Use argparse." },
  { id: 42, category: 'CLI Tools', language: 'python', prompt: "Build a Python text analysis tool. Word count, sentence count, reading level, most common words, character frequency." },
  { id: 43, category: 'CLI Tools', language: 'python', prompt: "Create a Python markdown-to-HTML converter. Handle headings, bold, italic, links, code blocks, lists." },
  { id: 44, category: 'CLI Tools', language: 'python', prompt: "Build a Python password generator CLI. Configurable length, uppercase, digits, special chars, exclude similar chars." },
  { id: 45, category: 'CLI Tools', language: 'python', prompt: "Create a Python log file analyzer. Parse common log format, count status codes, find top IPs, detect error patterns." },
  { id: 46, category: 'CLI Tools', language: 'python', prompt: "Build a Python data validation library. Validate email, phone, URL, date, credit card number formats." },
  { id: 47, category: 'CLI Tools', language: 'python', prompt: "Create a Python color converter utility. Convert between hex, RGB, HSL, and named colors. Include a color palette generator." },
  { id: 48, category: 'CLI Tools', language: 'python', prompt: "Build a Python file organizer script. Sort files by extension, date, or size into categorized folders." },
  { id: 49, category: 'CLI Tools', language: 'python', prompt: "Create a Python calculator that handles complex expressions. Support +, -, *, /, parentheses, and math functions (sin, cos, sqrt)." },
  { id: 50, category: 'CLI Tools', language: 'python', prompt: "Build a Python config file manager. Read/write JSON and INI configs with get/set/delete operations and nested key support." },
  { id: 51, category: 'CLI Tools', language: 'python', prompt: "Create a Python diff tool. Compare two text files, show additions/deletions/modifications, output unified diff format." },
  { id: 52, category: 'CLI Tools', language: 'python', prompt: "Build a Python cron expression parser. Parse cron strings, calculate next N run times, validate expressions." },
  { id: 53, category: 'CLI Tools', language: 'python', prompt: "Create a Python unit converter. Length, weight, temperature, volume, speed. Support chaining conversions." },
  { id: 54, category: 'CLI Tools', language: 'python', prompt: "Build a Python code snippet manager. Store, search, tag, and retrieve code snippets from a local JSON database." },
  { id: 55, category: 'CLI Tools', language: 'python', prompt: "Create a Python dependency graph builder. Parse import statements from Python files, build and display dependency tree." },
  { id: 56, category: 'CLI Tools', language: 'python', prompt: "Build a Python regex tester utility. Test patterns against input strings, show matches, groups, and explain patterns." },
  { id: 57, category: 'CLI Tools', language: 'python', prompt: "Create a Python CSV merger tool. Merge multiple CSVs by common column, handle missing values, deduplicate rows." },
  { id: 58, category: 'CLI Tools', language: 'python', prompt: "Build a Python changelog generator. Parse git-style commit messages, group by type (feat/fix/chore), output markdown." },
  { id: 59, category: 'CLI Tools', language: 'python', prompt: "Create a Python network diagnostic tool. Ping hosts, check port availability, DNS lookup, traceroute simulation." },
  { id: 60, category: 'CLI Tools', language: 'python', prompt: "Build a Python project scaffolder. Generate project structure with templates for Python, Node.js, or Go projects." },

  // ─── Category 4: Data Processing & Algorithms (20 prompts, language: python) ─
  { id: 61, category: 'Data Processing', language: 'python', prompt: "Create a Python CSV data processor. Read CSV, filter rows by conditions, aggregate columns (sum/avg/min/max), output results." },
  { id: 62, category: 'Data Processing', language: 'python', prompt: "Build a Python JSON schema validator. Define schemas, validate data against them, report detailed errors." },
  { id: 63, category: 'Data Processing', language: 'python', prompt: "Create a Python text tokenizer and stemmer. Tokenize text, remove stop words, stem words, build word frequency index." },
  { id: 64, category: 'Data Processing', language: 'python', prompt: "Build a Python data pipeline that reads data, transforms it (clean, normalize, aggregate), and outputs a summary report." },
  { id: 65, category: 'Data Processing', language: 'python', prompt: "Create a Python statistics library. Mean, median, mode, standard deviation, percentiles, correlation, regression." },
  { id: 66, category: 'Data Processing', language: 'python', prompt: "Build a Python HTML table parser. Extract tables from HTML strings, convert to dictionaries, support nested tables." },
  { id: 67, category: 'Data Processing', language: 'python', prompt: "Create a Python date/time utility library. Parse dates, calculate differences, format output, handle timezones, business days." },
  { id: 68, category: 'Data Processing', language: 'python', prompt: "Build a Python string similarity library. Implement Levenshtein distance, Jaccard similarity, fuzzy matching, and best-match finder." },
  { id: 69, category: 'Data Processing', language: 'python', prompt: "Create a Python matrix operations library. Add, multiply, transpose, determinant, inverse for 2D matrices." },
  { id: 70, category: 'Data Processing', language: 'python', prompt: "Build a Python email template engine. Variable substitution, conditionals, loops, HTML escaping, plain text fallback." },
  { id: 71, category: 'Data Processing', language: 'python', prompt: "Create a Python graph data structure. Nodes, edges, BFS, DFS, shortest path, cycle detection." },
  { id: 72, category: 'Data Processing', language: 'python', prompt: "Build a Python binary search tree. Insert, delete, search, in-order traversal, balance check, min/max." },
  { id: 73, category: 'Data Processing', language: 'python', prompt: "Create a Python priority queue with heap implementation. Insert, extract-min, decrease-key, merge queues." },
  { id: 74, category: 'Data Processing', language: 'python', prompt: "Build a Python LRU cache with O(1) operations. Get, put, eviction, cache stats, configurable max size." },
  { id: 75, category: 'Data Processing', language: 'python', prompt: "Create a Python trie (prefix tree). Insert, search, autocomplete, delete, count words with prefix." },
  { id: 76, category: 'Data Processing', language: 'python', prompt: "Build a Python sorting algorithms collection. Bubble, merge, quick, heap sort with comparison counts and timing." },
  { id: 77, category: 'Data Processing', language: 'python', prompt: "Create a Python rate limiter. Token bucket and sliding window algorithms, configurable limits, burst handling." },
  { id: 78, category: 'Data Processing', language: 'python', prompt: "Build a Python event emitter/pub-sub system. Subscribe, unsubscribe, emit, once, wildcard patterns." },
  { id: 79, category: 'Data Processing', language: 'python', prompt: "Create a Python state machine library. Define states, transitions, guards, actions, visualize current state." },
  { id: 80, category: 'Data Processing', language: 'python', prompt: "Build a Python bloom filter. Add, check membership, false positive rate calculation, configurable size." },

  // ─── Category 5: React/Frontend Components (20 prompts, language: javascript) ─
  { id: 81, category: 'React Components', language: 'javascript', prompt: "Build a React todo app with add, delete, toggle complete, filter (all/active/completed), and local storage persistence." },
  { id: 82, category: 'React Components', language: 'javascript', prompt: "Create a React weather dashboard component. Display current weather, 5-day forecast, temperature chart, search by city." },
  { id: 83, category: 'React Components', language: 'javascript', prompt: "Build a React expense tracker. Add expenses with category/amount/date, monthly summary, pie chart breakdown, budget alerts." },
  { id: 84, category: 'React Components', language: 'javascript', prompt: "Create a React quiz/trivia game component. Multiple choice questions, score tracking, timer, results screen." },
  { id: 85, category: 'React Components', language: 'javascript', prompt: "Build a React Kanban board. Drag-and-drop cards between columns (Todo/In Progress/Done), add/edit/delete cards." },
  { id: 86, category: 'React Components', language: 'javascript', prompt: "Create a React recipe finder app. Search recipes, filter by cuisine/diet, save favorites, ingredient list." },
  { id: 87, category: 'React Components', language: 'javascript', prompt: "Build a React chat UI component. Message list, input with send button, typing indicator, message timestamps, auto-scroll." },
  { id: 88, category: 'React Components', language: 'javascript', prompt: "Create a React markdown editor with live preview. Split pane, syntax highlighting, toolbar buttons, export." },
  { id: 89, category: 'React Components', language: 'javascript', prompt: "Build a React data table component. Sortable columns, pagination, search/filter, row selection, export to CSV." },
  { id: 90, category: 'React Components', language: 'javascript', prompt: "Create a React form builder. Drag-and-drop form fields, validation rules, preview mode, generate JSON schema." },
  { id: 91, category: 'React Components', language: 'javascript', prompt: "Build a React shopping cart component. Add/remove items, quantity adjustment, subtotal, discount codes, checkout summary." },
  { id: 92, category: 'React Components', language: 'javascript', prompt: "Create a React calendar/scheduler component. Monthly/weekly/daily views, add events, drag to reschedule, color categories." },
  { id: 93, category: 'React Components', language: 'javascript', prompt: "Build a React music player component. Play/pause, next/prev, progress bar, volume control, playlist management." },
  { id: 94, category: 'React Components', language: 'javascript', prompt: "Create a React image gallery with lightbox. Grid layout, click to enlarge, prev/next navigation, caption support." },
  { id: 95, category: 'React Components', language: 'javascript', prompt: "Build a React notification center. Toast notifications, notification list, mark as read, clear all, filter by type." },
  { id: 96, category: 'React Components', language: 'javascript', prompt: "Create a React search component with autocomplete. Debounced input, suggestion dropdown, keyboard navigation, recent searches." },
  { id: 97, category: 'React Components', language: 'javascript', prompt: "Build a React file explorer component. Tree view, folder expand/collapse, file icons, breadcrumb navigation, context menu." },
  { id: 98, category: 'React Components', language: 'javascript', prompt: "Create a React dashboard with widgets. Draggable/resizable cards, stats counters, mini charts, settings panel." },
  { id: 99, category: 'React Components', language: 'javascript', prompt: "Build a React auth flow. Login form, register form, forgot password, form validation, error states, loading states." },
  { id: 100, category: 'React Components', language: 'javascript', prompt: "Create a React multi-step wizard form. Step indicators, back/next navigation, validation per step, review/confirm, submit." },
];

// ═══════════════════════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function apiRequest(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE}${endpoint}`;
  const response = await fetch(url, { headers, ...options });
  const body = await response.json();
  return { status: response.status, body };
}

async function startMission(prompt, language) {
  // Use non-blocking mode + polling (blocking mode hits HTTP socket timeouts)
  let startBody;
  try {
    const { status, body } = await apiRequest('/missions', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        language,
        autoApprove: true,
        waitForCompletion: false,  // Non-blocking — we'll poll
      }),
    });
    if (status >= 400) {
      return { status, body, error: body?.error || `HTTP ${status}` };
    }
    startBody = body;
  } catch (err) {
    return { status: 0, body: null, error: err.message };
  }

  const missionId = startBody.id;
  if (!missionId) {
    return { status: 0, body: startBody, error: 'No mission ID returned' };
  }

  // Poll until terminal state or timeout
  const terminalStatuses = ['approved', 'failed', 'awaiting_approval'];
  const start = Date.now();
  let lastLog = 0;

  while (Date.now() - start < CONFIG.MISSION_TIMEOUT_MS) {
    try {
      const { body: mission } = await apiRequest(`/missions/${missionId}`);

      // Log progress every 30s (less spam)
      const now = Date.now();
      if (now - lastLog >= 30_000) {
        const secs = Math.round((now - start) / 1000);
        const done = (mission.completedCount || 0) + (mission.failedCount || 0);
        const prog = mission.subtaskCount > 0
          ? `${done}/${mission.subtaskCount} done (${mission.completedCount} pass, ${mission.failedCount} fail)`
          : 'decomposing';
        process.stdout.write(`  [${secs}s] ${mission.status} (${prog})\n`);
        lastLog = now;
      }

      if (terminalStatuses.includes(mission.status)) {
        return { status: 200, body: mission, error: null };
      }
    } catch {
      // Transient network error — keep polling
    }

    await sleep(3000);
  }

  // Timeout — fetch final state
  try {
    const { body: mission } = await apiRequest(`/missions/${missionId}`);
    return { status: 200, body: mission, error: `Timed out after ${CONFIG.MISSION_TIMEOUT_MS / 1000}s (status: ${mission.status})` };
  } catch {
    return { status: 0, body: null, error: `Timed out after ${CONFIG.MISSION_TIMEOUT_MS / 1000}s` };
  }
}

async function getMissionFiles(missionId) {
  try {
    const { body } = await apiRequest(`/missions/${missionId}/files`);
    return body || {};
  } catch {
    return {};
  }
}

async function getMissionDetail(missionId) {
  try {
    const { body } = await apiRequest(`/missions/${missionId}`);
    return body;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function analyzeMission(promptEntry, result, files) {
  const findings = {
    id: promptEntry.id,
    category: promptEntry.category,
    language: promptEntry.language,
    prompt: promptEntry.prompt,
    status: result?.status || 'error',
    missionId: result?.id || null,
    subtasks: {
      total: result?.subtaskCount || 0,
      passed: result?.completedCount || 0,
      failed: result?.failedCount || 0,
    },
    reviewScore: result?.reviewScore ?? null,
    reviewSummary: result?.reviewResult?.summary || null,
    cost: Number(result?.totalCost) || 0,
    timeMs: result?.totalTimeMs || 0,
    fileCount: Object.keys(files || {}).length,
    totalFileSize: Object.values(files || {}).reduce((s, c) => s + c.length, 0),
    issues: [],
    strengths: [],
    error: result?.error || null,
    tasks: (result?.tasks || []).map(t => ({
      title: t.title,
      status: t.status,
      complexity: t.complexity,
    })),
  };

  // Check for failure patterns
  if (findings.status === 'failed') {
    findings.issues.push(`Mission failed: ${findings.error || 'unknown'}`);
  }
  if (findings.subtasks.failed > 0) {
    findings.issues.push(`${findings.subtasks.failed}/${findings.subtasks.total} subtasks failed validation`);
  }
  if (findings.reviewScore !== null && findings.reviewScore < 7) {
    findings.issues.push(`Low review score: ${findings.reviewScore}/10`);
  }
  if (findings.timeMs > 300_000) {
    findings.issues.push(`Slow execution: ${(findings.timeMs / 1000).toFixed(0)}s (>5min)`);
  }
  if (findings.subtasks.total > 8) {
    findings.issues.push(`Over-decomposed: ${findings.subtasks.total} subtasks (prefer 3-5)`);
  }
  if (findings.subtasks.total === 0 && findings.status !== 'error') {
    findings.issues.push('Zero subtasks — decomposition may have failed');
  }

  // Check file quality
  for (const [name, content] of Object.entries(files || {})) {
    if (content.length < 50) {
      findings.issues.push(`${name}: suspiciously short (${content.length} chars)`);
    }
    if (content.includes('TODO') || content.includes('FIXME')) {
      findings.issues.push(`${name}: contains TODO/FIXME`);
    }
    if (content.includes('pass\n') && name.endsWith('.py')) {
      findings.issues.push(`${name}: contains bare 'pass' (stub)`);
    }
    if (content.includes('// TODO') || content.includes('/* TODO')) {
      findings.issues.push(`${name}: contains JS TODO comment`);
    }
  }

  // File count check
  if (findings.fileCount === 0 && findings.status === 'approved') {
    findings.issues.push('No files generated despite approval');
  }

  // Strengths
  if (findings.status === 'approved' && findings.subtasks.failed === 0) {
    findings.strengths.push('All subtasks passed validation');
  }
  if (findings.reviewScore !== null && findings.reviewScore >= 8) {
    findings.strengths.push(`High review score: ${findings.reviewScore}/10`);
  }
  if (findings.timeMs > 0 && findings.timeMs < 120_000 && findings.subtasks.total > 0) {
    findings.strengths.push(`Fast execution: ${(findings.timeMs / 1000).toFixed(0)}s`);
  }
  if (findings.fileCount >= 3) {
    findings.strengths.push(`Multi-file output: ${findings.fileCount} files`);
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateSummaryMd(allFindings) {
  const approved = allFindings.filter(f => f.status === 'approved').length;
  const failed = allFindings.filter(f => f.status === 'failed').length;
  const errored = allFindings.filter(f => f.status === 'error').length;
  const totalSubtasks = allFindings.reduce((s, f) => s + f.subtasks.total, 0);
  const passedSubtasks = allFindings.reduce((s, f) => s + f.subtasks.passed, 0);
  const failedSubtasks = allFindings.reduce((s, f) => s + f.subtasks.failed, 0);
  const totalCost = allFindings.reduce((s, f) => s + f.cost, 0);
  const totalTimeMs = allFindings.reduce((s, f) => s + f.timeMs, 0);
  const scores = allFindings.filter(f => f.reviewScore !== null).map(f => f.reviewScore);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const langCounts = {};
  for (const f of allFindings) {
    langCounts[f.language] = (langCounts[f.language] || 0) + 1;
  }
  const langStr = Object.entries(langCounts).map(([k, v]) => `${k} (${v})`).join(', ');

  // Category breakdown
  const categories = {};
  for (const f of allFindings) {
    if (!categories[f.category]) {
      categories[f.category] = { total: 0, approved: 0, scores: [], times: [] };
    }
    categories[f.category].total++;
    if (f.status === 'approved') categories[f.category].approved++;
    if (f.reviewScore !== null) categories[f.category].scores.push(f.reviewScore);
    if (f.timeMs > 0) categories[f.category].times.push(f.timeMs);
  }

  // Collect all issues across findings for pattern detection
  const issueCounts = {};
  for (const f of allFindings) {
    for (const issue of f.issues) {
      // Normalize similar issues
      const key = issue.replace(/\d+/g, 'N').replace(/'[^']*'/g, "'...'");
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    }
  }

  let md = `# Overnight Self-Improvement Report — ${today()}\n\n`;

  // Summary
  md += `## Summary\n`;
  md += `- **Missions:** ${approved}/${allFindings.length} approved (${allFindings.length > 0 ? Math.round(approved / allFindings.length * 100) : 0}%)`;
  if (failed > 0) md += `, ${failed} failed`;
  if (errored > 0) md += `, ${errored} errored`;
  md += `\n`;
  md += `- **Total subtasks:** ${totalSubtasks} (${passedSubtasks} passed, ${failedSubtasks} failed)\n`;
  md += `- **Avg review score:** ${avgScore.toFixed(1)}/10\n`;
  md += `- **Total cost:** $${totalCost.toFixed(2)}\n`;
  md += `- **Total runtime:** ${formatDuration(totalTimeMs)}\n`;
  md += `- **Languages:** ${langStr}\n\n`;

  // Category results table
  md += `## Category Results\n`;
  md += `| Category | Missions | Pass Rate | Avg Score | Avg Time |\n`;
  md += `|----------|----------|-----------|-----------|----------|\n`;
  for (const [cat, data] of Object.entries(categories)) {
    const rate = data.total > 0 ? Math.round(data.approved / data.total * 100) : 0;
    const catAvgScore = data.scores.length > 0
      ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1)
      : 'N/A';
    const catAvgTime = data.times.length > 0
      ? formatDuration(data.times.reduce((a, b) => a + b, 0) / data.times.length)
      : 'N/A';
    md += `| ${cat} | ${data.approved}/${data.total} | ${rate}% | ${catAvgScore} | ${catAvgTime} |\n`;
  }
  md += `\n`;

  // Common issues (actionable patterns)
  const sortedIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count >= 2);

  if (sortedIssues.length > 0) {
    md += `## Common Issues (Recurring Patterns)\n\n`;
    for (let i = 0; i < sortedIssues.length; i++) {
      const [pattern, count] = sortedIssues[i];
      md += `### Pattern ${i + 1}: ${pattern}\n`;
      md += `- **Occurrences:** ${count}\n`;
      // Find example missions
      const examples = allFindings
        .filter(f => f.issues.some(iss => iss.replace(/\d+/g, 'N').replace(/'[^']*'/g, "'...'") === pattern))
        .slice(0, 3);
      md += `- **Examples:** ${examples.map(e => `#${e.id} (${e.category})`).join(', ')}\n\n`;
    }
  }

  return md;
}

function generateMissionDetailMd(f) {
  const icon = f.status === 'approved' ? '✅' : f.status === 'failed' ? '❌' : '⚠️';
  const timeSec = f.timeMs > 0 ? `${(f.timeMs / 1000).toFixed(0)}s` : 'N/A';

  let md = `### Mission ${f.id}: ${f.prompt.slice(0, 60)}... ${icon}\n`;
  md += `- **Status:** ${f.status}`;
  if (f.reviewScore !== null) md += ` | **Score:** ${f.reviewScore}/10`;
  md += ` | **Time:** ${timeSec}`;
  md += ` | **Cost:** $${f.cost.toFixed(4)}\n`;
  md += `- **Category:** ${f.category} | **Language:** ${f.language}\n`;
  md += `- **Subtasks:** ${f.subtasks.passed}/${f.subtasks.total} passed`;
  if (f.subtasks.failed > 0) md += `, ${f.subtasks.failed} failed`;
  md += `\n`;

  if (f.fileCount > 0) {
    md += `- **Files:** ${f.fileCount} (${(f.totalFileSize / 1024).toFixed(1)}KB total)\n`;
  }

  if (f.error) {
    md += `- **Error:** ${f.error}\n`;
  }

  if (f.tasks.length > 0) {
    md += `- **Tasks:**\n`;
    for (const t of f.tasks) {
      const tIcon = t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
      md += `  - ${tIcon} [C${t.complexity ?? '?'}] ${t.title}\n`;
    }
  }

  if (f.issues.length > 0) {
    md += `- **Issues:** ${f.issues.join('; ')}\n`;
  }
  if (f.strengths.length > 0) {
    md += `- **Strengths:** ${f.strengths.join('; ')}\n`;
  }
  if (f.reviewSummary) {
    md += `- **Review:** ${f.reviewSummary}\n`;
  }

  md += `\n`;
  return md;
}

function formatDuration(ms) {
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS / CRASH RECOVERY
// ═══════════════════════════════════════════════════════════════════════════════

function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
      // Only resume if same date (don't resume stale progress)
      if (data.date === today()) {
        return data;
      }
    }
  } catch {
    // Corrupted file — start fresh
  }
  return { date: today(), completedIds: [], findings: [], totalCost: 0 };
}

function saveProgress(progress) {
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT FILE WRITER
// ═══════════════════════════════════════════════════════════════════════════════

function writeReport(allFindings) {
  const fp = findingsPath();

  let md = generateSummaryMd(allFindings);
  md += `## Mission Details\n\n`;
  for (const f of allFindings) {
    md += generateMissionDetailMd(f);
  }

  fs.writeFileSync(fp, md);
  return fp;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const maxIdx = args.indexOf('--max');
  const maxPrompts = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : Infinity;
  const categoryIdx = args.indexOf('--category');
  const categoryFilter = categoryIdx >= 0 ? parseInt(args[categoryIdx + 1], 10) : null;
  const doShuffle = args.includes('--shuffle');
  const doResume = args.includes('--resume');

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           Overnight Self-Improvement Loop                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`  API:       ${CONFIG.API_BASE}`);
  console.log(`  Date:      ${today()}`);
  console.log(`  Cost cap:  $${CONFIG.MAX_COST_USD}`);
  console.log(`  Cooldown:  ${CONFIG.COOLDOWN_MS / 1000}s`);
  console.log(`  Timeout:   ${CONFIG.MISSION_TIMEOUT_MS / 1000}s per mission`);

  // Health check
  try {
    const { body } = await apiRequest('/missions?limit=0');
    console.log('  Connection: OK');
  } catch (err) {
    console.error(`\n  ❌ Connection failed: ${err.message}`);
    console.error('  Make sure the ABCC stack is running: docker compose up');
    process.exit(1);
  }

  // Build prompt list
  let prompts = [...PROMPT_BANK];

  // Filter by category if requested
  if (categoryFilter !== null) {
    const categories = [...new Set(PROMPT_BANK.map(p => p.category))];
    const targetCat = categories[categoryFilter - 1];
    if (!targetCat) {
      console.error(`\n  ❌ Invalid category ${categoryFilter}. Available: ${categories.map((c, i) => `${i + 1}=${c}`).join(', ')}`);
      process.exit(1);
    }
    prompts = prompts.filter(p => p.category === targetCat);
    console.log(`  Category:  ${targetCat} (${prompts.length} prompts)`);
  }

  // Shuffle if requested
  if (doShuffle) {
    for (let i = prompts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [prompts[i], prompts[j]] = [prompts[j], prompts[i]];
    }
    console.log('  Order:     Shuffled');
  }

  // Limit
  if (maxPrompts < prompts.length) {
    prompts = prompts.slice(0, maxPrompts);
  }

  // Load progress for crash recovery
  let progress = doResume ? loadProgress() : { date: today(), completedIds: [], findings: [], totalCost: 0 };
  const completedSet = new Set(progress.completedIds);
  const remaining = prompts.filter(p => !completedSet.has(p.id));

  if (completedSet.size > 0) {
    console.log(`  Resuming:  ${completedSet.size} completed, ${remaining.length} remaining`);
  }

  console.log(`  Prompts:   ${remaining.length} to run\n`);

  if (remaining.length === 0) {
    console.log('  Nothing to do — all prompts already completed.');
    if (progress.findings.length > 0) {
      const fp = writeReport(progress.findings);
      console.log(`  Report: ${fp}`);
    }
    return;
  }

  const startTime = Date.now();
  let cumulativeCost = progress.totalCost;
  const allFindings = [...progress.findings];

  for (let i = 0; i < remaining.length; i++) {
    const entry = remaining[i];
    const missionNum = completedSet.size + i + 1;
    const totalMissions = completedSet.size + remaining.length;

    // Cost cap check
    if (cumulativeCost >= CONFIG.MAX_COST_USD) {
      console.log(`\n  ⚠️  Cost cap reached: $${cumulativeCost.toFixed(2)} >= $${CONFIG.MAX_COST_USD}. Stopping.`);
      break;
    }

    const elapsed = formatDuration(Date.now() - startTime);
    console.log(`\n═══ [${missionNum}/${totalMissions}] ${entry.category} #${entry.id} (${entry.language}) — ${elapsed} elapsed ═══`);
    console.log(`  Prompt: "${entry.prompt.slice(0, 80)}..."`);

    let missionResult = null;
    let files = {};
    let finding;

    try {
      // Send mission
      const mStart = Date.now();
      console.log('  Sending mission...');
      const { status, body, error } = await startMission(entry.prompt, entry.language);

      if (error) {
        console.log(`  ❌ Error: ${error}`);
        finding = analyzeMission(entry, null, {});
        finding.status = 'error';
        finding.error = error;
      } else {
        missionResult = body;
        const mElapsed = ((Date.now() - mStart) / 1000).toFixed(0);

        console.log(`  Status: ${body.status} (HTTP ${status}) — ${mElapsed}s`);
        console.log(`  Subtasks: ${body.completedCount}/${body.subtaskCount} passed, ${body.failedCount} failed`);
        if (body.reviewScore !== null && body.reviewScore !== undefined) {
          console.log(`  Review: ${body.reviewScore}/10`);
        }
        console.log(`  Cost: $${(Number(body.totalCost) || 0).toFixed(4)}`);

        // Get files
        if (body.id) {
          files = await getMissionFiles(body.id);
          const fileNames = Object.keys(files);
          console.log(`  Files: ${fileNames.length > 0 ? fileNames.join(', ') : 'none'}`);
        }

        // If mission didn't include full detail, fetch it
        if (body.id && (!body.tasks || body.tasks.length === 0)) {
          const detail = await getMissionDetail(body.id);
          if (detail) missionResult = detail;
        }

        finding = analyzeMission(entry, missionResult, files);
      }
    } catch (err) {
      console.log(`  ❌ Unexpected error: ${err.message}`);
      finding = analyzeMission(entry, null, {});
      finding.status = 'error';
      finding.error = err.message;
    }

    // Log result summary
    const icon = finding.status === 'approved' ? '✅' : finding.status === 'failed' ? '❌' : '⚠️';
    console.log(`  Result: ${icon} ${finding.status}`);
    if (finding.issues.length > 0) {
      console.log(`  Issues: ${finding.issues.slice(0, 3).join('; ')}`);
    }
    if (finding.strengths.length > 0) {
      console.log(`  Strengths: ${finding.strengths.join('; ')}`);
    }

    // Update accumulators
    cumulativeCost += finding.cost;
    allFindings.push(finding);

    // Save progress for crash recovery
    progress.completedIds.push(entry.id);
    progress.findings = allFindings;
    progress.totalCost = cumulativeCost;
    saveProgress(progress);

    // Write report after each mission (incremental)
    const fp = writeReport(allFindings);

    // Running stats
    const approvedSoFar = allFindings.filter(f => f.status === 'approved').length;
    console.log(`  Running: ${approvedSoFar}/${allFindings.length} approved (${Math.round(approvedSoFar / allFindings.length * 100)}%) | $${cumulativeCost.toFixed(2)} spent`);

    // Cooldown between missions (GPU rest + VRAM clearing)
    if (i < remaining.length - 1) {
      // Warn if mission was slow (possible VRAM pressure)
      if (finding.timeMs > CONFIG.SLOW_MISSION_THRESHOLD_MS) {
        console.log(`  ⚠️  Slow mission: ${(finding.timeMs / 60_000).toFixed(1)}min — possible VRAM pressure`);
      }

      const missionNum = i + 1;
      const isExtendedCooldown = missionNum % CONFIG.EXTENDED_COOLDOWN_EVERY_N === 0;
      const cooldownMs = isExtendedCooldown ? CONFIG.EXTENDED_COOLDOWN_MS : CONFIG.COOLDOWN_MS;
      console.log(`  Cooling down ${cooldownMs / 1000}s${isExtendedCooldown ? ' (extended — GPU VRAM clearing)' : ''}...`);
      await sleep(cooldownMs);
    }
  }

  // Final report
  const totalElapsed = Date.now() - startTime;
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           Overnight Run Complete                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const approved = allFindings.filter(f => f.status === 'approved').length;
  const failed = allFindings.filter(f => f.status === 'failed').length;
  const errored = allFindings.filter(f => f.status === 'error').length;
  console.log(`  Missions:  ${approved} approved, ${failed} failed, ${errored} errored`);
  console.log(`  Pass rate: ${allFindings.length > 0 ? Math.round(approved / allFindings.length * 100) : 0}%`);
  console.log(`  Cost:      $${cumulativeCost.toFixed(2)}`);
  console.log(`  Runtime:   ${formatDuration(totalElapsed)}`);
  console.log(`  Report:    ${findingsPath()}`);

  // Clean up progress file on successful completion
  if (remaining.length === prompts.filter(p => !new Set(loadProgress().completedIds).has(p.id)).length) {
    // All done — clean up
    try { fs.unlinkSync(CONFIG.PROGRESS_FILE); } catch {}
  }

  const fp = writeReport(allFindings);
  console.log(`\n  Full report: ${fp}`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
