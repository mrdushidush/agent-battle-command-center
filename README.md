# 🎮 Agent Battle Command Center

> **Run 88% of coding tasks for FREE on a $300 GPU, with Claude handling the rest at ~$0.002/task average.**

A Command & Conquer Red Alert-inspired control center for orchestrating AI coding agents with intelligent tiered routing. Watch your AI agents work in real-time with a retro RTS-style interface.

[![Beta Ready](https://img.shields.io/badge/status-Beta%20Ready%20(8.1%2F10)-brightgreen)](./MVP_ASSESSMENT.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/tests-27%20test%20files-success)](./packages/api/src/__tests__)
[![Ollama Tested](https://img.shields.io/badge/Ollama%20C1--C8-95%25%20pass-success)](./scripts/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## ✨ What Makes This Special

**💰 Cost Optimization (20x cheaper than cloud-only)**
- FREE local execution via Ollama (qwen2.5-coder:7b) for 88% of tasks
- Smart tiered routing: only use paid Claude API for complex tasks
- **Proven:** 95% success rate on C1-C8 tasks (Feb 2026), 88% on C1-C9 (includes extreme class-based tasks)

**🎯 Academic Complexity Routing**
- Based on Campbell's Task Complexity Theory
- Dual assessment: rule-based + Haiku AI semantic analysis
- Automatic escalation: Ollama (1-6) → Haiku (7-8) → Sonnet (9-10)

**🎵 C&C Red Alert Audio System**
- Voice feedback for every agent action ("Conscript reporting!", "Shake it baby!")
- Nostalgic RTS-style command center experience
- Real-time agent status with sound effects

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
*The main view showing task queue (bounty board), active missions strip, and real-time tool log with C&C Red Alert aesthetic.*

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

### Cost Tracking
![Cost Dashboard](docs/screenshots/cost-dashboard.png)
*Real-time cost monitoring with daily budget limits, model tier breakdown, and token burn rate visualization.*

---

**UI Features:**
- 🎮 Command & Conquer Red Alert-inspired design
- 🎨 Teal/amber HUD colors with terminal-style panels
- 🔊 Voice feedback for agent actions ("Conscript reporting!", "Shake it baby!")
- ⚡ Real-time WebSocket updates (no polling)
- 📊 Live metrics and health indicators

---

## 🚀 Quick Start

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

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Configure secrets** (edit `.env`)
   ```bash
   # Generate 3 secure keys (run this 3 times, use each output below):
   openssl rand -hex 32

   # Then edit .env and replace CHANGE_ME values:
   POSTGRES_PASSWORD=<key1>          # Also update the password in DATABASE_URL!
   API_KEY=<key2>                    # API authentication
   VITE_API_KEY=<key2>              # Must match API_KEY (same value)
   JWT_SECRET=<key3>                 # JWT signing
   ANTHROPIC_API_KEY=sk-ant-api03-...  # From https://console.anthropic.com
   ```

4. **Start all services**
   ```bash
   docker compose up --build
   ```
   > **No NVIDIA GPU?** Comment out the `deploy:` block in `docker-compose.yml` (lines 53-58) to run Ollama in CPU-only mode. It's slower but works.

5. **Open the UI**
   - Navigate to: http://localhost:5173
   - The first startup takes ~5 minutes (downloading Ollama model)

6. **Verify health**
   ```bash
   # Check all services are running
   docker ps

   # Check Ollama model is loaded
   docker exec abcc-ollama ollama list
   # Should show: qwen2.5-coder:7b
   ```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          UI (React + Vite)                          │
│                         localhost:5173                              │
│  • Task queue (bounty board)  • Active missions  • Tool log        │
│  • Dashboard  • Minimap  • C&C audio system                        │
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
                                 │  • qwen2.5-coder:7b (4.7GB) │
                                 │  • RTX 3060 Ti 8GB VRAM     │
                                 │  • FREE execution           │
                                 └─────────────────────────────┘
```

---

## 🎯 Key Features

### Tiered Task Routing
- **Complexity 1-6** → Ollama (FREE, ~30s avg) - 100% success rate proven
- **Complexity 7-8** → Haiku (~$0.003/task) - API integration, error handling
- **Complexity 9-10** → Sonnet (~$0.01/task) - Architectural design, multiple systems
- **Decomposition** → Opus (~$0.02/task) - Breaking down complex tasks only

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
- **Resource pools** - Ollama (1 slot) + Claude (2 slots)
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

# Ollama Model (default: qwen2.5-coder:7b)
OLLAMA_MODEL=qwen2.5-coder:7b
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

**40-task ultimate test (C1-C9, 88% pass rate):**
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
# Check if model is downloaded
docker exec abcc-ollama ollama list

# If missing, pull manually:
docker exec abcc-ollama ollama pull qwen2.5-coder:7b

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
# Backups stored in: C:\dev\abcc-backups\daily\
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
- pnpm 8+
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
| **Ollama C1-C8 Success** | 95% (19/20) | 20-task stress test (Feb 7, 2026) |
| **Ollama C1-C9 Success** | 88% (35/40) | 40-task ultimate test |
| **Cost per task (avg)** | $0.002 | Mixed complexity batch |
| **Ollama avg time** | 30-77s | Varies by complexity (C1-C8) |
| **Haiku avg time** | 27s | With MCP disabled |
| **Parallel speedup** | 40-60% | vs sequential |

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

### Current (Alpha - v0.1.x)
- ✅ Tiered task routing (Ollama/Haiku/Sonnet/Opus)
- ✅ Real-time UI with C&C Red Alert audio
- ✅ API authentication and rate limiting
- ✅ Parallel execution and file locking
- ✅ Cost tracking and budget limits
- ✅ Stuck task auto-recovery

### Beta (v0.2.x) - Target: 4-6 weeks
- [ ] Multi-language workspace (JavaScript/TypeScript support)
- [ ] E2E test suite (Playwright)
- [ ] Onboarding flow / first-run wizard
- [ ] Agent workspace viewer (live code editing view)
- [ ] Plugin system for custom agent tools
- [ ] Docker Hub image publishing

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
- **Command & Conquer Red Alert** - Inspiration for the UI/UX

---

## 📧 Support

- **Issues:** [GitHub Issues](https://github.com/mrdushidush/agent-battle-command-center/issues)
- **Discussions:** [GitHub Discussions](https://github.com/mrdushidush/agent-battle-command-center/discussions)
- **Documentation:** [docs/](docs/)

---

**Built with ❤️ by the ABCC community**

*"One write, one verify, mission complete." - CodeX-7*
