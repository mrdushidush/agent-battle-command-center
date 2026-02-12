# Local Setup Guide

## Prerequisites Checklist

- [ ] Docker Desktop installed and running
- [ ] NVIDIA GPU drivers (if using GPU) or CPU-only mode
- [ ] Anthropic API key (get from https://console.anthropic.com/settings/keys)
- [ ] 8GB+ RAM available
- [ ] 30GB+ disk space available

## Step 1: Generate Secure Keys

Run these commands to generate secure random keys:

**Windows PowerShell:**
```powershell
# API Key (32 characters)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})

# Postgres Password (32 characters)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})

# JWT Secret (64 characters)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```

**Linux/Mac:**
```bash
# API Key
openssl rand -hex 32

# Postgres Password
openssl rand -hex 32

# JWT Secret
openssl rand -hex 64
```

**Save these values!** You'll need them in the next step.

## Step 2: Create .env File

```bash
# Copy the example
cp .env.example .env

# Edit with your values
notepad .env  # Windows
# or
nano .env     # Linux/Mac
```

## Step 3: Fill in .env Values

```bash
# ============================================================================
# REQUIRED - Database Configuration
# ============================================================================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<YOUR_GENERATED_POSTGRES_PASSWORD>
POSTGRES_DB=abcc
DATABASE_URL=postgresql://postgres:<YOUR_GENERATED_POSTGRES_PASSWORD>@localhost:5432/abcc?schema=public

# ============================================================================
# REQUIRED - API Server
# ============================================================================
API_PORT=3001
API_HOST=0.0.0.0
API_KEY=<YOUR_GENERATED_API_KEY>
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# ============================================================================
# REQUIRED - Anthropic API (for complex tasks)
# ============================================================================
ANTHROPIC_API_KEY=<YOUR_ANTHROPIC_API_KEY>

# ============================================================================
# REQUIRED - Security
# ============================================================================
JWT_SECRET=<YOUR_GENERATED_JWT_SECRET>

# ============================================================================
# REQUIRED - UI
# ============================================================================
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_API_KEY=<SAME_AS_API_KEY_ABOVE>

# ============================================================================
# OPTIONAL - Ollama Model (default is fine)
# ============================================================================
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b

# ============================================================================
# OPTIONAL - Agents Service
# ============================================================================
AGENTS_URL=http://localhost:8000
AGENTS_PORT=8000

# ============================================================================
# OPTIONAL - Human Escalation
# ============================================================================
HUMAN_TIMEOUT_MINUTES=30

# ============================================================================
# OPTIONAL - MCP Gateway (leave disabled)
# ============================================================================
USE_MCP=false
MCP_GATEWAY_URL=http://localhost:8001
REDIS_URL=redis://localhost:6379/0

# ============================================================================
# OPTIONAL - Rate Limiting
# ============================================================================
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_SKIP_SUCCESSFUL=false

# ============================================================================
# OPTIONAL - Ollama Optimization
# ============================================================================
OLLAMA_REST_DELAY_MS=3000
OLLAMA_EXTENDED_REST_MS=8000
OLLAMA_RESET_EVERY_N_TASKS=3

# ============================================================================
# OPTIONAL - Stuck Task Recovery
# ============================================================================
STUCK_TASK_TIMEOUT_MS=600000
STUCK_TASK_CHECK_INTERVAL_MS=60000

# ============================================================================
# OPTIONAL - MCP Sync Configuration
# ============================================================================
SYNC_FROM_POSTGRES_INTERVAL=1.0
SYNC_TO_POSTGRES_INTERVAL=5.0
TASK_CACHE_TTL=3600
FILE_LOCK_TIMEOUT=60
```

## Step 4: Start Services

```bash
# Build and start all services
docker compose up --build

# Or run in background
docker compose up --build -d
```

**First startup takes ~5 minutes** to download Ollama model (4.7GB).

## Step 5: Verify Services

Open a new terminal and check:

```bash
# All services should be running
docker ps

# Expected output (6 containers):
# abcc-ui          - localhost:5173
# abcc-api         - localhost:3001
# abcc-agents      - localhost:8000
# abcc-ollama      - localhost:11434
# abcc-postgres    - localhost:5432
# abcc-redis       - localhost:6379
# abcc-backup      - (backup service)
```

## Step 6: Verify Ollama Model

```bash
# Check model is downloaded
docker exec abcc-ollama ollama list

# Expected output:
# NAME                     ID              SIZE
# qwen2.5-coder:7b        abc123def       4.7GB

# If missing, pull manually:
docker exec abcc-ollama ollama pull qwen2.5-coder:7b
```

## Step 7: Test API Health

```bash
# Test without authentication (health check is public)
curl http://localhost:3001/health

# Expected output:
# {"status":"ok","timestamp":"2026-02-06T..."}
```

## Step 8: Test Authenticated API

```bash
# Replace <YOUR_API_KEY> with your generated API_KEY
curl -H "X-API-Key: <YOUR_API_KEY>" http://localhost:3001/api/agents

# Expected output (list of agents):
# [{"id":"coder-01","type":"coder","status":"idle",...}, ...]
```

## Step 9: Open UI

**Navigate to:** http://localhost:5173

You should see:
- Task queue (bounty board)
- Active missions panel
- Minimap
- Top bar with metrics

## Step 10: Create a Test Task

**Via UI:**
1. Click "New Task" button
2. Title: "Create hello world function"
3. Description: "Write a Python function that prints 'Hello World'"
4. Click "Create"

**Via API:**
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "X-API-Key: <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Create hello world function",
    "description": "Write a Python function that prints Hello World",
    "type": "code"
  }'
```

**Watch the UI:** Task should be assigned, executed, and completed in ~30 seconds!

## Troubleshooting

### Services won't start

**Check Docker Desktop is running:**
```bash
docker ps
```

**Check disk space:**
```bash
docker system df
```

**View logs:**
```bash
docker logs abcc-api --tail 50
docker logs abcc-agents --tail 50
docker logs abcc-ollama --tail 50
```

### "Authentication required" errors

**Check .env has API_KEY set:**
```bash
grep API_KEY .env
```

**Rebuild UI with new env:**
```bash
docker compose up --build ui
```

### Ollama model not loading

**Check model is downloaded:**
```bash
docker exec abcc-ollama ollama list
```

**Force pull:**
```bash
docker exec abcc-ollama ollama pull qwen2.5-coder:7b
```

**Check logs:**
```bash
docker logs abcc-ollama --tail 100
```

### Database connection fails

**Check postgres is running:**
```bash
docker exec abcc-postgres pg_isready -U postgres
```

**Check password matches .env:**
```bash
# In .env, POSTGRES_PASSWORD and DATABASE_URL should match
```

### CORS errors in browser

**Check CORS_ORIGINS includes your frontend:**
```bash
grep CORS_ORIGINS .env
# Should include: http://localhost:5173
```

**Restart API:**
```bash
docker compose restart api
```

## Next Steps

Once everything is working:

1. **Test stress test:** `node scripts/ollama-stress-test.js`
2. **Run tests:** `cd packages/api && pnpm test`
3. **Take screenshots:** Update README with actual UI screenshots
4. **Deploy:** Follow cloud deployment guide (coming soon)

## Configuration Options

See full documentation:
- [Authentication](docs/AUTHENTICATION.md)
- [CORS Configuration](docs/CORS.md)
- [Rate Limiting](docs/RATE_LIMITING.md)
- [Database Migrations](docs/DATABASE_MIGRATIONS.md)
- [Error Handling](docs/ERROR_HANDLING.md)

## Support

- Issues: https://github.com/mrdushidush/agent-battle-command-center/issues
- Docs: docs/
- README: README.md
