# 🎮 Agent Battle Command Center

> **Status: stable at v0.11.0 (March 2026).** ABCC is the godfather of a family of AI coding-agent experiments I've been building since January 2026. Active development has since moved to newer projects — most notably **[claudette](https://github.com/mrdushidush/claudette)**, a local-first personal-assistant descendant of the same lineage (messaging-app access + voice + persistent scheduler, also on [crates.io](https://crates.io/crates/claudette)). This repo remains online as a reference implementation of the architecture (Campbell complexity routing, tiered Ollama → Claude fallback, RTS-style TUI, Bark military voice lines). Issues and PRs still welcome; don't expect rapid feature work here — that's happening in the successor projects.

> **Run 88-98% of C1-C9 coding tasks for FREE on a $300 GPU — including LRU caches and RPN calculators — with Claude handling C10 decomposition at ~$0.002/task average.** Both figures are single-pass runs of the 40-task C1-C9 benchmark: 88% (35/40) on 2026-02-05, 98% (39/40) on 2026-02-20 after context-routing changes. The auto-retry pipeline's contribution is unmeasured.

An RTS-inspired control center for orchestrating AI coding agents with intelligent tiered routing. Watch your AI agents work in real-time with a retro strategy game-style interface.

[![Stable](https://img.shields.io/badge/status-stable%20v0.11.0-brightgreen)](./CHANGELOG.md)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-dushidush-blue?logo=docker)](https://hub.docker.com/u/dushidush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/tests-23%20test%20files-success)](./packages/api/src/__tests__)
[![Ollama Tested](https://img.shields.io/badge/Ollama%20C1--C9-88--98%25%20single--pass-success)](./scripts/QWEN25_CODER_7B_ULTIMATE_REPORT.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**If you find this useful, [give it a star](https://github.com/mrdushidush/agent-battle-command-center/stargazers)** — it helps others discover this project and motivates development.

### Quick Links

[What Makes This Special](#-what-makes-this-special) · [Screenshots](#-screenshots) · [Quick Start (Docker Hub)](#-quick-start-docker-hub--recommended) · [Quick Start (Source)](#️-quick-start-build-from-source) · [Architecture](#️-architecture) · [Key Features](#-key-features) · [Configuration](#️-configuration) · [Usage](#-usage) · [Testing](#-testing) · [Troubleshooting](#-troubleshooting) · [Documentation](#-documentation) · [Development](#️-development) · [Contributing](#-contributing) · [Performance](#-performance--benchmarks) · [Roadmap](#️-roadmap)

---

## ✨ What Makes This Special

**💰 Cost Optimization (20x cheaper than cloud-only)**
- FREE local execution via Ollama (base `qwen2.5-coder:7b` + routed `:16k` / `:32k` context variants) for C1-C9 tasks
- Smart tiered routing: only use paid Claude API for C10 multi-class architectural tasks
- **Measured:** 88% (35/40) and 98% (39/40) on two single-pass runs of the 40-task C1-C9 stress benchmark — see [QWEN25_CODER_7B_ULTIMATE_REPORT.md](./scripts/QWEN25_CODER_7B_ULTIMATE_REPORT.md)
- Passes LRU Cache, RPN Calculator, Sorted Linked List, Stack — all FREE on local GPU

**🎯 Academic Complexity Routing + Per-Agent Model Override**
- Based on Campbell's Task Complexity Theory
- Dual assessment: rule-based + Haiku AI semantic analysis
- Automatic escalation: Ollama (1-8) → Sonnet (9-10) — Haiku eliminated from routing
- **NEW: Per-agent model dropdown** — override Auto routing with Ollama/Grok/Haiku/Sonnet/Opus per agent

**🎵 Bark TTS Military Radio Voice Lines**
- 96 GPU-generated voice lines with military radio post-processing (static, squelch, crackle)
- 3 voice packs: Tactical Ops, Mission Control, Field Command (32 lines each)
- Generated locally with [Bark TTS](https://github.com/suno-ai/bark) (MIT) — $0 cost
- Voice feedback for every agent action ("Mission complete!", "Engaging target!")

**📊 Full Observability**
- Every tool call logged with timing, tokens, and cost
- Loop detection prevents infinite retries
- Training data export for model fine-tuning

---

## 📸 Screenshots

### Live Demo
![Command Center in Action](docs/screenshots/CommandCenter1.gif)
*The full command center running live — agent minimap, task queue, and real-time tool execution log.*

### Main Command Center (Overseer Mode)
![Command Center Overview](docs/screenshots/command-center-overview.png)
*The main view showing task queue (bounty board), active missions strip, and real-time tool log with RTS-inspired aesthetic.*

### Task Queue (Bounty Board)
![Task Queue](docs/screenshots/task-queue.png)
*Large task cards with complexity indicators, priority colors, and status badges. Click any task to view details and execution logs.*

### Active Missions & Agent Health
![Active Missions](docs/screenshots/active-missions.png)
*Real-time agent status strip with health indicators (green=idle, amber=working, red=stuck). Shows current task and progress for each agent.*

### Tool Log (Terminal Feed)
![Tool Log](docs/screenshots/tool-log.png)
*Live feed of every tool call with syntax highlighting. Expand entries to see full input/output, timing, and token usage.*

### Dashboard & Analytics
![Dashboard](docs/screenshots/dashboard.png)
*Success rates by complexity, cost breakdown by model tier, agent comparison charts, and budget tracking.*

---

**UI Features:**
- 🎮 RTS nostalgia-inspired design
- 🎨 Teal/amber HUD colors with terminal-style panels
- 🔊 Military voice feedback for agent actions ("Acknowledged!", "Mission complete!")
- ⚡ Real-time WebSocket updates (no polling)
- 📊 Live metrics and health indicators

---

## 🚀 Quick Start (Docker Hub — Recommended)

Pre-built images on Docker Hub. No cloning the full repo, no build step — just pull and run.

### Prerequisites

- **Docker Desktop** (with GPU support for Ollama)
- **NVIDIA GPU** (recommended: 8GB+ VRAM for local models)
  - *Or CPU-only mode (comment out the `deploy:` GPU block in the compose file)*
- **Anthropic API key** (for Claude models — [get one here](https://console.anthropic.com))
- **8GB+ RAM** (for Docker containers)

### Installation

1. **Download the files**
   ```bash
   mkdir agent-battle-command-center && cd agent-battle-command-center
   mkdir -p scripts
   curl -O https://raw.githubusercontent.com/mrdushidush/agent-battle-command-center/main/docker-compose.hub.yml
   curl -O https://raw.githubusercontent.com/mrdushidush/agent-battle-command-center/main/.env.example
   curl -o scripts/setup.sh https://raw.githubusercontent.com/mrdushidush/agent-battle-command-center/main/scripts/setup.sh
   curl -o scripts/ollama-entrypoint.sh https://raw.githubusercontent.com/mrdushidush/agent-battle-command-center/main/scripts/ollama-entrypoint.sh
   curl -o scripts/nginx-hub.conf https://raw.githubusercontent.com/mrdushidush/agent-battle-command-center/main/scripts/nginx-hub.conf
   ```

2. **Run setup** (auto-generates all keys, prompts for Anthropic key)
   ```bash
   bash scripts/setup.sh
   ```
   Or manually: `cp .env.example .env` and edit the `CHANGE_ME` values.

3. **Start all services** (~30 seconds to pull images)
   ```bash
   docker compose -f docker-compose.hub.yml up
   ```

4. **Open the UI** → http://localhost:5173
   - First startup downloads the Ollama model (~5 min one-time)

5. **Verify health**
   ```bash
   docker ps                                    # All 6 containers running
   docker exec abcc-ollama ollama list           # Should show qwen2.5-coder:7b + :16k + :32k
   curl http://localhost:3001/health             # API healthy
   ```

---

## 🛠️ Quick Start (Build from Source)

For contributors and developers who want to modify the code.

### Prerequisites

- **Docker Desktop** (with GPU support for Ollama)
- **NVIDIA GPU** (recommended: 8GB+ VRAM for local models)
  - *Or CPU-only mode (see [Configuration](#configuration))*
- **Anthropic API key** (for Claude models)
- **8GB+ RAM** (for Docker containers)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mrdushidush/agent-battle-command-center.git
   cd agent-battle-command-center
   ```

2. **Run setup** (auto-generates all keys, prompts for Anthropic key)
   ```bash
   bash scripts/setup.sh
   ```
   Or manually: `cp .env.example .env` and edit the `CHANGE_ME` values.

3. **Start all services** (first build takes ~5 minutes)
   ```bash
   docker compose up --build
   ```
   > **No NVIDIA GPU?** Comment out the `deploy:` block in `docker-compose.yml` (lines 53-58) to run Ollama in CPU-only mode. It's slower but works.

4. **Open the UI** → http://localhost:5173
   - Ollama model download adds ~5 min on first startup

5. **Verify health**
   ```bash
   # Check all services are running
   docker ps

   # Check Ollama model is loaded
   docker exec abcc-ollama ollama list
   # Should show: qwen2.5-coder:7b (base) + :16k (C1-C6 routing) + :32k (C7-C9 routing)
   ```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          UI (React + Vite)                          │
│                         localhost:5173                              │
│  • Task queue (bounty board)  • Active missions  • Tool log        │
│  • Dashboard  • Minimap  • Voice pack audio                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP/WebSocket (authenticated)
┌────────────────────────────▼─────────────────────────────────────────┐
│                    API (Express + Socket.IO)                         │
│                         localhost:3001                               │
│  • Task routing  • Cost tracking  • Budget service                  │
│  • Rate limiting  • CORS protection  • File locking                 │
└──────┬──────────────┬──────────────────────┬─────────────────────────┘
       │              │                      │
┌──────▼─────┐  ┌─────▼──────┐  ┌──────────▼────────────────────┐
│ PostgreSQL │  │   Redis    │  │  Agents (FastAPI + CrewAI)    │
│    :5432   │  │   :6379    │  │        localhost:8000         │
│            │  │            │  │  • Coder (CodeX-7)            │
│  • Tasks   │  │  • Cache   │  │  • QA (Haiku/Sonnet)          │
│  • Logs    │  │  • MCP     │  │  • CTO (Opus - review only)   │
│  • Reviews │  │            │  └───────────┬───────────────────┘
└────────────┘  └────────────┘              │
                                 ┌──────────▼──────────────────┐
                                 │   Ollama (Local LLM)        │
                                 │      localhost:11434        │
                                 │  • qwen2.5-coder:7b base    │
                                 │    + :16k (C1-C6 routing)   │
                                 │    + :32k (C7-C9 routing)   │
                                 │  • RTX 3060 Ti 8GB VRAM     │
                                 │  • 93% GPU / 7% CPU         │
                                 │  • FREE execution           │
                                 └─────────────────────────────┘
```

---

## 🎯 Key Features

### Tiered Task Routing + Per-Agent Model Selection (v0.7.0)
- **Complexity 1-6** → Ollama with `:16k` context variant (FREE)
- **Complexity 7-9** → Ollama with `:32k` context variant (FREE) — or Remote Ollama if `REMOTE_OLLAMA_URL` is set
- **Complexity 10** → Sonnet decomposition (~$0.005/task) — multi-class architectural tasks only
- **Combined pass rate:** 88% (35/40) and 98% (39/40) on two single-pass runs of the 40-task C1-C9 stress benchmark
- **Haiku eliminated** from execution routing — Ollama handles C7-C9; Haiku only escalates failed validations
- **Per-agent model override** — sidebar dropdown to force any agent to use a specific model
- **Grok (xAI) support** — set `XAI_API_KEY` to enable Grok as a model option

### Real-Time Monitoring
- **Active Missions** - Live agent status with health indicators
- **Tool Log** - Terminal-style feed of every tool call
- **Token Burn Rate** - Real-time cost tracking with budget warnings
- **WebSocket Updates** - Instant UI updates for all events

### Cost Controls
- **Daily budget limits** with warnings at 80%
- **Cost tracking** per task, agent, and model tier
- **Tiered code reviews** (Haiku every 5th Ollama, Opus every 10th complex)
- **Training data export** for future model fine-tuning

### Parallel Execution
- **Resource pools** - Ollama (1 slot) + Grok (2 slots) + Claude (2 slots)
- **40-60% faster** for mixed-complexity batches
- **File locking** prevents conflicts between parallel tasks

### Error Recovery
- **Stuck task detection** - Auto-recovery after 10 min timeout
- **Loop detection** - Prevents agents from repeating failed actions
- **Escalation system** - Ollama fails → Haiku retries with context → Human escalation

### Security (MVP Hardened - Feb 2026)
- ✅ API key authentication on all endpoints (except /health)
- ✅ CORS restricted to configured origins with test coverage
- ✅ HTTP rate limiting (100 req/min default, configurable)
- ✅ All secrets externalized to .env (not in docker-compose.yml)
- ✅ Trivy security scanning in CI/CD
- ✅ Error boundaries prevent UI crashes
- ✅ Input sanitization and SQL injection prevention via Prisma

---

## ⚙️ Configuration

### Environment Variables

All configuration is in `.env`. See [.env.example](.env.example) for full list.

**Essential:**
```bash
# API Authentication (REQUIRED)
API_KEY=your_secure_api_key_here

# Claude API (REQUIRED for complex tasks)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Database (REQUIRED)
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/abcc?schema=public

# Ollama base model (router auto-picks :16k for C1-C6 and :32k for C7-C9 variants)
OLLAMA_MODEL=qwen2.5-coder:7b

# Grok / xAI (OPTIONAL — enables Grok as a model option in agent dropdowns)
XAI_API_KEY=xai-your_key_here
```

**Security:**
```bash
# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:5173,https://your-domain.com

# Rate Limiting
RATE_LIMIT_MAX=100              # requests per minute
RATE_LIMIT_WINDOW_MS=60000      # 1 minute window

# JWT Secret
JWT_SECRET=your_secure_jwt_secret_minimum_32_characters
```

**Cost Controls:**
```bash
# Budget Service
BUDGET_DAILY_LIMIT_CENTS=500    # $5.00 daily limit
BUDGET_WARNING_THRESHOLD=0.8    # Warn at 80%

# Review Schedule
OLLAMA_REVIEW_INTERVAL=5        # Haiku review every 5th Ollama task
OPUS_REVIEW_INTERVAL=10         # Opus review every 10th complex task
```

**Ollama Optimization:**
```bash
# Rest delays between tasks (prevents context pollution)
OLLAMA_REST_DELAY_MS=3000       # 3s between tasks
OLLAMA_EXTENDED_REST_MS=8000    # 8s every Nth task
OLLAMA_RESET_EVERY_N_TASKS=3    # Reset interval

# Stuck task recovery
STUCK_TASK_TIMEOUT_MS=600000    # 10 minutes
STUCK_TASK_CHECK_INTERVAL_MS=60000  # Check every 1 minute
```

### GPU Configuration

**Verify GPU access:**
```bash
docker exec abcc-ollama nvidia-smi
```

**CPU-only mode** (slower, but works without GPU):
```yaml
# In docker-compose.yml, comment out GPU section:
# deploy:
#   resources:
#     reservations:
#       devices:
#         - driver: nvidia
#           count: all
#           capabilities: [gpu]
```

---

## 📖 Usage

### Creating Tasks

**Via UI:**
1. Click "New Task" button
2. Enter title and description
3. (Optional) Select required agent type
4. Submit - complexity is auto-calculated

**Via API:**
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Create user authentication",
    "description": "Implement JWT-based auth with login/logout endpoints",
    "type": "code"
  }'
```

### Monitoring Progress

**Active Missions Panel:**
- Shows currently executing tasks
- Agent health (green=idle, amber=working, red=stuck)
- Progress indicators

**Tool Log Panel:**
- Real-time feed of agent actions
- Click to expand full details
- Filter by agent or task

**Dashboard:**
- Success rates by agent and complexity
- Cost breakdown by model tier
- Daily/weekly/monthly metrics

### Managing Agents

**Pause/Resume:**
```bash
curl -X POST http://localhost:3001/api/agents/qa-01/pause \
  -H "X-API-Key: your_api_key"
```

**Reset stuck agents:**
```bash
curl -X POST http://localhost:3001/api/agents/reset-all \
  -H "X-API-Key: your_api_key"
```

**Check Ollama status:**
```bash
curl http://localhost:3001/api/agents/ollama-status \
  -H "X-API-Key: your_api_key"
```

---

## 🧪 Testing

### Stress Tests

**20-task graduated complexity (C1-C8, 100% pass rate):**
```bash
node scripts/ollama-stress-test.js
```

**40-task ultimate test (C1-C9, 88% then 98% single-pass, dynamic context routing):**
```bash
node scripts/ollama-stress-test-40.js
```

**Full tier test (Ollama + Haiku + Sonnet + Opus, ~$1.50 cost):**
```bash
node scripts/run-full-tier-test.js
```

**Parallel execution test:**
```bash
node scripts/test-parallel.js
```

### Unit Tests

```bash
# API tests (18 test suites, 122 tests)
cd packages/api
npm test

# Agent tests (2 Python test suites, 696 lines)
cd packages/agents
pytest
```

**Test Coverage (as of Feb 7, 2026):**
- **27 total test files:** 23 TypeScript + 4 Python
- **API tests (16 files):** budgetService, resourcePool, stuckTaskRecovery, rateLimiter, agentManager, costCalculator, complexityAssessor, taskRouter, taskQueue, fileLock, ollamaOptimizer, schedulerService, taskExecutor, taskAssigner
- **UI component tests (5 files):** ErrorBoundary, AgentCard, TaskCard, AnimatedCounter, StatusBadge
- **Python tests (4 files):** action_history, file_ops, validators, tools
- **Integration tests:** CORS, auth middleware, task lifecycle

### System Health Check

```bash
# Full health check (includes load test)
node scripts/full-system-health-check.js

# Quick check (skip load test)
node scripts/full-system-health-check.js --skip-load-test
```

---

## 🐛 Troubleshooting

### Ollama model not loading

**Symptoms:** Tasks stuck in queue, Ollama health check failing

**Solution:**
```bash
# Check if models are downloaded (should show qwen2.5-coder:7b + :16k + :32k)
docker exec abcc-ollama ollama list

# If missing, the entrypoint auto-creates the routed variants. Restart the container:
docker compose restart ollama

# Or pull base model and create manually:
docker exec abcc-ollama ollama pull qwen2.5-coder:7b
# The :16k (C1-C6 routing) and :32k (C7-C9 routing) variants are auto-built from the base on startup

# Check logs
docker logs abcc-ollama --tail 50
```

### CORS errors in browser

**Symptoms:** `Access to fetch blocked by CORS policy`

**Solution:**
```bash
# Add your origin to .env
CORS_ORIGINS=http://localhost:5173,http://localhost:8080

# Restart API
docker compose restart api
```

### Rate limit exceeded

**Symptoms:** `429 Too Many Requests`

**Solution:**
```bash
# Increase limit in .env
RATE_LIMIT_MAX=300

# Or use WebSockets instead of polling
```

### API authentication fails

**Symptoms:** `401 Unauthorized` or `403 Forbidden`

**Solution:**
```bash
# Check API key matches in .env
API_KEY=...
VITE_API_KEY=...  # Must be same value

# Rebuild UI container
docker compose up --build ui
```

### Tasks stuck in "in_progress"

**Symptoms:** Task running for >10 minutes with no updates

**Automatic recovery:** Stuck task recovery service runs every 60 seconds

**Manual recovery:**
```bash
# Check stuck task recovery status
curl http://localhost:3001/api/agents/stuck-recovery/status \
  -H "X-API-Key: your_api_key"

# Trigger manual recovery
curl -X POST http://localhost:3001/api/agents/stuck-recovery/check \
  -H "X-API-Key: your_api_key"
```

### Database connection issues

**Symptoms:** `Error: P1001: Can't reach database server`

**Solution:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
docker exec abcc-postgres pg_isready -U postgres

# View logs
docker logs abcc-postgres --tail 50
```

### Out of disk space

**Symptoms:** Docker fails to start, "no space left on device"

**Check Docker disk usage:**
```bash
docker system df
```

**Clean up:**
```bash
# Remove old containers and images
docker system prune -a

# Remove old Ollama models
docker exec abcc-ollama ollama list
docker exec abcc-ollama ollama rm <old-model-name>

# Clean backups (keep last 7 days)
# Default backup location: ./backups/ (set BACKUP_MIRROR_PATH in .env)
```

---

## 📚 Documentation

- **[Authentication Guide](docs/AUTHENTICATION.md)** - API key setup and usage
- **[CORS Configuration](docs/CORS.md)** - Origin restrictions and security
- **[Rate Limiting](docs/RATE_LIMITING.md)** - Request limits and bypass
- **[Error Handling](docs/ERROR_HANDLING.md)** - UI error boundaries
- **[Database Migrations](docs/DATABASE_MIGRATIONS.md)** - Schema changes and deployment
- **[API Reference](docs/API.md)** - All endpoints and examples
- **[Development Guide](docs/DEVELOPMENT.md)** - Testing and debugging
- **[AI Assistant Context](CLAUDE.md)** - Project overview for AI tools

---

## 🛠️ Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- pnpm 8+ (install with `npm install -g pnpm`)
- Docker Desktop

### Local Setup

```bash
# Install dependencies
pnpm install

# Start database only
docker compose up postgres redis -d

# Run API in dev mode
cd packages/api
pnpm dev

# Run UI in dev mode
cd packages/ui
pnpm dev

# Run agents in dev mode
cd packages/agents
uvicorn src.main:app --reload --port 8000
```

### Running Tests

```bash
# All tests
pnpm test

# API tests only
cd packages/api && pnpm test

# UI tests (when available)
cd packages/ui && pnpm test

# Agent tests (when available)
cd packages/agents && pytest
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Security scan (requires Trivy)
pnpm run security:scan

# Type check
pnpm run type-check
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Pull request process
- Code style guidelines
- Testing requirements

**Quick start for contributors:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Ensure all tests pass (`pnpm test`)
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📊 Performance & Benchmarks

### Proven Metrics (Feb 2026)

| Metric | Result | Test |
|--------|--------|------|
| **Ollama C1-C9 Success (2026-02-05)** | **88% (35/40)** | 40-task ultimate test, single-pass, no retries |
| **Ollama C1-C9 Success (2026-02-20)** | **98% (39/40)** | Same suite after context-routing changes, also single-pass |
| **Ollama C1-C8 Success** | 100% (20/20) | 20-task baseline stress test |
| **Ollama avg time** | 54.4s/task (23s median) | 2026-02-05 run; the 2026-02-20 run averaged 32.7s |
| **Cost per task (avg)** | $0.002 | Mixed complexity batch |
| **GPU utilization** | 93% GPU / 7% CPU | 7GB VRAM on RTX 3060 Ti 8GB |
| **Parallel speedup** | 40-60% | vs sequential |

Canonical benchmark report: [`scripts/QWEN25_CODER_7B_ULTIMATE_REPORT.md`](./scripts/QWEN25_CODER_7B_ULTIMATE_REPORT.md)

**16K Context Window Upgrade (Feb 17, 2026):**

| Complexity | Success | Avg Time | What's Tested |
|------------|---------|----------|---------------|
| C1-C4 | **100%** | 8-11s | Math, strings, conditionals, loops |
| C5-C6 | **80-100%** | 10-12s | FizzBuzz, palindrome, caesar cipher, primes |
| C7-C8 | **100%** | 14-15s | Fibonacci, word freq, matrix, binary search, power set |
| C9 (Extreme) | **80%** | 19s | LRU Cache, RPN Calculator, Sorted Linked List, Stack |

### Hardware Requirements

**Recommended:**
- RTX 3060 Ti (8GB VRAM) or better
- 16GB system RAM
- 50GB free disk space
- Ubuntu 22.04 / Windows 11 with WSL2

**Minimum:**
- CPU-only (no GPU) - much slower
- 8GB system RAM
- 30GB free disk space

---

## 🗺️ Roadmap

### Current (v0.7.x)
- ✅ **Per-agent model selection** — dropdown to override Auto routing per agent (v0.7.0)
- ✅ **Grok (xAI) support** — new model option for all agents (v0.7.0)
- ✅ **CTO agents in sidebar** — full visibility for all 3 agent types (v0.7.0)
- ✅ **3-tier routing** — Local Ollama / Remote Ollama / Claude API (v0.5.1)
- ✅ **Auto-retry pipeline** — validation + tiered retry on failure (v0.5.0); effect on pass rate not yet benchmarked
- ✅ Tiered task routing (Ollama/Sonnet/Opus)
- ✅ Dynamic 16K/32K context routing for Ollama — 88% then 98% single-pass, C1-C9
- ✅ 3D holographic battlefield view with React Three Fiber
- ✅ Bark TTS military radio voice lines — 96 clips, 3 packs
- ✅ API authentication and rate limiting
- ✅ Parallel execution and file locking
- ✅ Cost tracking and budget limits
- ✅ Stuck task auto-recovery
- ✅ Docker Hub image publishing
- ✅ Multi-language workspace (Python, JavaScript, TypeScript, Go, PHP)

### Next (v0.8.x)
- [ ] E2E test suite (Playwright)
- [ ] Onboarding flow / first-run wizard
- [ ] Agent workspace viewer (live code editing view)
- [ ] Plugin system for custom agent tools

### Community Release (v1.0.x) - Target: 2-3 months
- [ ] Multi-user authentication (OAuth2/OIDC)
- [ ] Workspace isolation per user
- [ ] Cloud deployment guides (Railway, Render, AWS)
- [ ] Demo mode (pre-loaded tasks, no API key)
- [ ] Agent marketplace (community agents)
- [ ] WCAG 2.1 AA accessibility compliance

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Anthropic** - Claude API powering the intelligent agents
- **Ollama** - Local LLM runtime enabling free execution
- **CrewAI** - Agent orchestration framework
- **[Bark TTS](https://github.com/suno-ai/bark)** - GPU-generated military radio voice lines
- **Classic RTS games** - Inspiration for the UI/UX

---

## 📧 Support

- **Issues:** [GitHub Issues](https://github.com/mrdushidush/agent-battle-command-center/issues)
- **Discussions:** [GitHub Discussions](https://github.com/mrdushidush/agent-battle-command-center/discussions)
- **Documentation:** [docs/](docs/)

---

**Built with ❤️ by the ABCC community**

*"One write, one verify, mission complete." - CodeX-7*
