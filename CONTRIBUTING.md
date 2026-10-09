# Contributing to Agent Battle Command Center

Thank you for your interest in contributing to ABCC! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Project Structure](#project-structure)
- [Useful Commands](#useful-commands)

## 🤝 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code.

**In short:**
- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Accept responsibility and apologize for mistakes
- Prioritize what's best for the community

## 🚀 Getting Started

### Good First Issues

Look for issues labeled:
- `good first issue` - Simple tasks for newcomers
- `help wanted` - We need community help on these
- `documentation` - Improve docs without touching code

### Ways to Contribute

1. **Report bugs** - Use GitHub Issues with the bug report template
2. **Suggest features** - Use GitHub Issues with the feature request template
3. **Improve documentation** - Fix typos, add examples, clarify concepts
4. **Write tests** - Increase test coverage (currently at 25%)
5. **Fix bugs** - Check open issues and submit PRs
6. **Add features** - Discuss in an issue first before implementing

## 🎯 Your First Contribution (5 minutes)

Not sure where to start? Here's a concrete 5-minute walkthrough:

1. **Fork & clone** the repo (see [Development Setup](#development-setup))
2. **Run** `bash scripts/setup.sh` to get everything running
3. **Pick a `good first issue`** from [Issues](https://github.com/mrdushidush/agent-battle-command-center/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
4. **Make your change** on a new branch: `git checkout -b fix/my-fix`
5. **Test locally**: `docker compose up` and verify in browser at `http://localhost:5173`
6. **Open a PR** — outside PRs are reviewed on Fridays, up to three a week, oldest first

**Even smaller contributions help:**
- Fix a typo in docs
- Add a missing JSDoc comment
- Improve an error message
- Add a test for an untested function

## 💻 Development Setup

### Prerequisites

- **Node.js** 20+ (check with `node --version`)
- **Python** 3.11+ (check with `python --version`)
- **pnpm** 8+ (install with `npm install -g pnpm`)
- **Docker Desktop** with GPU support
- **Git** for version control

### Fork and Clone

```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/agent-battle-command-center.git
cd agent-battle-command-center

# Add upstream remote
git remote add upstream https://github.com/mrdushidush/agent-battle-command-center.git
```

### Quick Setup (Recommended)

```bash
# Run the automated setup script — creates .env, installs deps, pulls Docker images
bash scripts/setup.sh
```

### Manual Setup

<details>
<summary>Click to expand manual steps</summary>

#### Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Install Python dependencies
cd packages/agents
pip install -r requirements.txt
```

#### Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or your preferred editor
```

**Required:**
- `ANTHROPIC_API_KEY` - Get from https://console.anthropic.com/
- `API_KEY` - Generate with `openssl rand -hex 32`
- `POSTGRES_PASSWORD` - Any secure password
- `JWT_SECRET` - Generate with `openssl rand -hex 32`

</details>

### Start Development Environment

**Option 1: Full Docker (Recommended for testing)**
```bash
docker compose up --build
```

**Option 2: Hybrid (Faster for development)**
```bash
# Start infrastructure only
docker compose up postgres redis ollama -d

# Run API in dev mode (terminal 1)
cd packages/api
pnpm dev

# Run UI in dev mode (terminal 2)
cd packages/ui
pnpm dev

# Run agents in dev mode (terminal 3)
cd packages/agents
uvicorn src.main:app --reload --port 8000
```

**Option 3: Docker Hub (Quick test, no build)**
```bash
# Pull pre-built images and start — no local build required
docker compose -f docker-compose.hub.yml up
# UI at http://localhost:5173, API at http://localhost:3001
```

### Verify Setup

```bash
# Check all services
docker ps

# Check Ollama model
docker exec abcc-ollama ollama list
# Should show: qwen2.5-coder:7b

# Access UI
# Open http://localhost:5173 in browser
```

## 🔄 Pull Request Process

### 1. Create a Feature Branch

```bash
# Update your fork's main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes:
git checkout -b fix/bug-description
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the [Code Style Guidelines](#code-style-guidelines)
- Add tests for new functionality
- Update documentation as needed
- Keep commits atomic and focused

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Run linting
pnpm lint

# Run type checking
pnpm run type-check

# Run security scan (optional but recommended)
pnpm run security:scan
```

### 4. Commit Your Changes

Follow the [Commit Message Guidelines](#commit-message-guidelines):

```bash
git add .
git commit -m "feat: add new feature description"
```

### 5. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Go to GitHub and create a Pull Request
```

### 6. PR Checklist

Before submitting, ensure:

- [ ] Code follows style guidelines
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated (README, API docs, comments)
- [ ] Commit messages follow conventions
- [ ] No merge conflicts with main branch
- [ ] PR description explains what and why
- [ ] Linked to related issue (if applicable)

### 7. Review Process

- v1 is in maintenance with one maintainer: outside PRs are reviewed on Fridays, up to three a week, oldest first
- Over 200 changed lines, or outside the linked issue's scope: closed with a note rather than reviewed — split it, or open an issue first
- Address any requested changes
- **You keep the merge:** if your PR needs a fix, the maintainer asks you for it or pushes it to your branch, and never re-opens your change as their own PR
- Once approved, maintainers will merge your PR
- Your contribution will be credited in release notes

## 📝 Code Style Guidelines

### TypeScript/JavaScript

**Follow existing patterns in the codebase:**

```typescript
// ✅ Good - Clear naming, proper types
async function calculateTaskComplexity(task: Task): Promise<number> {
  const routerScore = complexityRouter.calculate(task);
  const haikuScore = await haikuAssessor.assess(task);
  return weightedAverage(routerScore, haikuScore);
}

// ❌ Bad - Vague naming, any types
async function calc(t: any): Promise<any> {
  const r = router.calc(t);
  const h = await assessor.assess(t);
  return avg(r, h);
}
```

**Key principles:**
- Use TypeScript strict mode (no `any` types)
- Prefer `const` over `let`, never use `var`
- Use async/await over callbacks
- Use descriptive variable names
- Add JSDoc comments for public APIs
- Keep functions small and focused (<50 lines)
- Use early returns to reduce nesting

**Formatting:**
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas in multiline objects/arrays
- Semicolons required
- Run `pnpm lint` to auto-format

### Python

**Follow PEP 8 with project conventions:**

```python
# ✅ Good - Type hints, docstrings, clear logic
def calculate_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    """Calculate API cost in cents for given token usage.

    Args:
        input_tokens: Number of input tokens consumed
        output_tokens: Number of output tokens generated
        model: Model tier (haiku, sonnet, opus)

    Returns:
        Cost in cents (e.g., 0.35 = $0.0035)
    """
    rates = COST_RATES.get(model, COST_RATES["haiku"])
    input_cost = (input_tokens * rates["input"]) / 1_000_000
    output_cost = (output_tokens * rates["output"]) / 1_000_000
    return input_cost + output_cost

# ❌ Bad - No types, no docstring, magic numbers
def calc_cost(inp, out, m):
    r = rates[m]
    return (inp * r[0] + out * r[1]) / 1000000
```

**Key principles:**
- Use type hints for all function signatures
- Add docstrings for all public functions/classes
- Follow PEP 8 naming (snake_case, not camelCase)
- Use f-strings for formatting
- Keep functions under 50 lines
- Run `ruff check` before committing

### File Naming

- **TypeScript/React**: `camelCase.ts` or `PascalCase.tsx` (components)
- **Python**: `snake_case.py`
- **Tests**: `*.test.ts` or `test_*.py`
- **Config**: `lowercase.json`, `lowercase.yml`

## ✅ Testing Requirements

### Minimum Requirements

**All PRs must include tests for new code:**

- **API changes**: Unit tests in `packages/api/src/**/__tests__/`
- **UI changes**: Component tests in `packages/ui/src/**/*.test.tsx` (when available)
- **Agent changes**: Python tests in `packages/agents/tests/`
- **Bug fixes**: Regression test to prevent reoccurrence

### Writing Good Tests

```typescript
// ✅ Good - Clear test name, focused test, proper assertions
describe('BudgetService', () => {
  it('should block Claude when over daily limit', async () => {
    await budgetService.recordCost(600, 'opus', 'expensive-task');

    const result = budgetService.checkBudget();

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('budget exceeded');
  });
});

// ❌ Bad - Vague name, tests multiple things, weak assertions
it('works', async () => {
  await budgetService.recordCost(600, 'opus', 'task');
  const r = budgetService.checkBudget();
  expect(r.allowed).toBeDefined();
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific package
pnpm test -w packages/api

# Run specific file
pnpm test packages/api/src/services/__tests__/budgetService.test.ts

# Run with coverage
pnpm test -- --coverage

# Watch mode for development
pnpm test -- --watch
```

### Test Coverage Goals

- **Current**: 25% overall, 5/10 score
- **Beta target**: 50% overall, 7/10 score
- **Production target**: 70% overall, 8/10 score

**Focus areas needing coverage:**
- UI components (currently 0%)
- Agent Python code (15% → 50%)
- API services (25% → 60%)

## 📜 Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change or bug fix)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, configs)
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

```bash
# Simple feature
git commit -m "feat: add budget warning at 80% threshold"

# Bug fix with scope
git commit -m "fix(api): prevent duplicate agent IDs in seed"

# Breaking change
git commit -m "feat(agents): change complexity scale to 1-10

BREAKING CHANGE: Complexity scores now range 1-10 instead of 1-5.
Update any scripts that reference complexity thresholds."

# Multiple changes (use separate commits instead!)
# ❌ Bad
git commit -m "fix bugs and add features and update docs"

# ✅ Good - separate commits
git commit -m "fix: resolve CORS error for localhost:8080"
git commit -m "feat: add support for custom CORS origins"
git commit -m "docs: update CORS configuration guide"
```

## 📁 Project Structure

```
agent-battle-command-center/
├── packages/
│   ├── api/              # Express API + Socket.IO
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   ├── middleware/ # Auth, rate limiting
│   │   │   └── __tests__/ # Integration tests
│   │   └── prisma/       # Database schema & migrations
│   ├── agents/           # FastAPI agent service
│   │   ├── src/
│   │   │   ├── agents/   # Agent definitions (coder, qa, cto)
│   │   │   ├── tools/    # Agent tools (file ops, shell)
│   │   │   └── monitoring/ # Execution logging
│   │   └── tests/        # Python unit tests
│   ├── ui/               # React dashboard
│   │   └── src/
│   │       ├── components/ # React components
│   │       ├── hooks/    # Custom React hooks
│   │       └── store/    # Zustand state management
│   └── shared/           # Shared TypeScript types
├── scripts/              # Test runners, utilities
├── docs/                 # Documentation
├── .github/              # GitHub Actions CI/CD
└── docker-compose.yml    # Docker orchestration
```

### Adding New Files

**API endpoint:**
```
packages/api/src/routes/newFeature.ts
packages/api/src/services/newFeatureService.ts
packages/api/src/services/__tests__/newFeatureService.test.ts
```

**UI component:**
```
packages/ui/src/components/feature/NewComponent.tsx
packages/ui/src/components/feature/NewComponent.test.tsx (when testing ready)
```

**Agent tool:**
```
packages/agents/src/tools/new_tool.py
packages/agents/tests/test_new_tool.py
```

## 🛠️ Useful Commands

### Development

```bash
# Start full system
docker compose up

# Rebuild after changes
docker compose up --build

# View logs
docker logs abcc-api --tail 50 -f
docker logs abcc-agents --tail 50 -f

# Restart single service
docker compose restart api
```

### Database

```bash
# Apply migrations
cd packages/api
pnpm prisma migrate dev

# Generate Prisma client
pnpm prisma generate

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset

# Open Prisma Studio (database GUI)
pnpm prisma studio
```

### Testing

```bash
# Run stress tests (requires running system)
node scripts/ollama-stress-test.js       # 20 tasks, 100% pass
node scripts/ollama-stress-test-40.js    # 40 tasks, 88% pass
node scripts/test-parallel.js            # Parallel execution

# Security scanning
pnpm run security:scan      # Quick terminal check
pnpm run security:report    # HTML report
```

### Debugging

```bash
# Check agent status
curl -H "X-API-Key: your_key" http://localhost:3001/api/agents

# Check resource pool
curl -H "X-API-Key: your_key" http://localhost:3001/api/queue/resources

# Reset stuck agents
curl -X POST -H "X-API-Key: your_key" http://localhost:3001/api/agents/reset-all

# Trigger stuck task recovery
curl -X POST -H "X-API-Key: your_key" http://localhost:3001/api/agents/stuck-recovery/check
```

## ❓ Questions?

- **General questions**: [GitHub Discussions](https://github.com/mrdushidush/agent-battle-command-center/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/mrdushidush/agent-battle-command-center/issues)
- **Security issues**: See [SECURITY.md](SECURITY.md)

## 🙏 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!

---

**Happy coding!** 🎮

*"One write, one verify, mission complete." - CodeX-7*
