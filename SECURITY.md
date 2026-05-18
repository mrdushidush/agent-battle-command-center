# Security Policy

## Project Status

ABCC is **stable at v0.11.0** (March 2026). Active development has moved to successor projects — most notably [claudette](https://github.com/mrdushidush/claudette). This repo remains online as a reference implementation and receives security fixes to the latest release, but no new feature work.

## Supported Versions

| Version       | Supported          | Status |
| ------------- | ------------------ | ------ |
| 0.11.x        | :white_check_mark: | Stable maintenance — security fixes applied to `main` |
| < 0.11        | :x:                | Not back-ported — upgrade to v0.11.x to receive fixes |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow responsible disclosure practices.

### **DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security issues via one of these methods:

1. **GitHub Security Advisory** (Preferred): Use the ["Report a vulnerability"](https://github.com/mrdushidush/agent-battle-command-center/security/advisories/new) feature in the Security tab
2. **GitHub Issues**: For non-sensitive security improvements, open a [regular issue](https://github.com/mrdushidush/agent-battle-command-center/issues/new)

### What to Include

Please provide:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** (what an attacker could do)
- **Suggested fix** (if you have one)
- **Your contact information** for follow-up

### Response Timeline

- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Fix timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Best effort

### Disclosure Policy

- We will acknowledge your report within 48 hours
- We will provide regular updates on the fix progress
- Once fixed, we will coordinate disclosure timing with you
- We will credit you in the security advisory (unless you prefer anonymity)

## Security Features

### Current Implementation (v0.11.x stable maintenance)

#### ✅ Implemented

- **API Key Authentication** - All endpoints require `X-API-Key` header (except `/health`)
- **CORS Restrictions** - Configurable allowed origins (defaults to localhost only)
- **Rate Limiting** - 100 requests/minute per IP (configurable)
- **SQL Injection Prevention** - Prisma ORM with parameterized queries
- **Path Traversal Protection** - File operations sandboxed to workspace directory
- **Secrets Management** - All secrets externalized to `.env` (not in docker-compose.yml)
- **Input Sanitization** - Zod validation on critical endpoints
- **Error Boundaries** - React error boundaries prevent UI crashes
- **Dependency Scanning** - Trivy + Dependabot for vulnerability detection

#### 🔄 Partial / In Progress

- **Input Validation** - Zod validation being added to all routes (currently partial)
- **CSP Headers** - Not yet implemented
- **HTTPS** - Not configured (requires reverse proxy setup)

#### ❌ Known Limitations

- **Single API Key** - Shared key for all users (no per-user auth)
- **No Session Management** - Stateless API (no logout/invalidation)
- **Shell Command Execution** - `shell_run` tool executes arbitrary commands in Docker container (mitigated by sandboxing)
- **No Audit Logging** - User actions not logged for forensics
- **No Multi-Factor Auth** - API key only (no 2FA)

### Planned for Beta (v0.2.x)

- [ ] Input validation on all API routes
- [ ] CSP headers for UI
- [ ] Audit logging for security events
- [ ] Stricter CORS policies with origin validation
- [ ] Helmet.js for Express security headers

### Planned for v1.0

- [ ] Multi-user authentication (OAuth2/OIDC)
- [ ] Role-based access control (RBAC)
- [ ] Per-user API keys with scoped permissions
- [ ] Session management with expiration
- [ ] Two-factor authentication (2FA)
- [ ] Rate limiting per user (not just per IP)
- [ ] Encrypted secrets at rest

## Security Best Practices

### For Deployment

If you're deploying Agent Battle Command Center, **follow these practices:**

#### 🔴 Critical - Do Immediately

1. **Change Default API Key**
   ```bash
   # Generate a secure random key
   openssl rand -hex 32

   # Add to .env
   API_KEY=your_generated_key_here
   ```

2. **Set Strong Database Password**
   ```bash
   # Generate secure password
   openssl rand -base64 32

   # Add to .env
   POSTGRES_PASSWORD=your_generated_password
   ```

3. **Set JWT Secret**
   ```bash
   # Generate secret
   openssl rand -hex 32

   # Add to .env
   JWT_SECRET=your_generated_secret
   ```

4. **Configure CORS Origins**
   ```bash
   # In .env - only allow your domain
   CORS_ORIGINS=https://your-domain.com,https://app.your-domain.com
   ```

#### 🟡 High Priority - Do Before Public Access

5. **Enable HTTPS with Reverse Proxy**
   - Use nginx, Caddy, or Traefik
   - Get free SSL certificate from Let's Encrypt
   - Never expose HTTP in production

6. **Set Budget Limits**
   ```bash
   # Prevent API cost overruns
   DAILY_BUDGET_LIMIT_CENTS=500  # $5/day
   ```

7. **Close Unnecessary Ports**
   - Only expose port 443 (HTTPS) publicly
   - Keep ports 3001, 8000, 5432, 6379, 11434 internal
   - Use firewall rules or Docker network isolation

8. **Run Security Scan**
   ```bash
   pnpm run security:scan
   # Fix any HIGH or CRITICAL vulnerabilities
   ```

#### 🟢 Recommended - Do Soon

9. **Enable Dependabot Alerts**
   - Already configured in `.github/dependabot.yml`
   - Monitor GitHub Security tab for alerts

10. **Regular Backups**
    - Backups run every 30 minutes automatically
    - Verify backup location: `./backups/` (or set `BACKUP_MIRROR_PATH` in `.env`)
    - Test restore process monthly

11. **Monitor Logs**
    ```bash
    # Check for suspicious activity
    docker logs abcc-api | grep "401\|403\|429"
    ```

12. **Limit Docker Resource Usage**
    ```yaml
    # In docker-compose.yml
    services:
      api:
        deploy:
          resources:
            limits:
              cpus: '1.0'
              memory: 512M
    ```

### For Development

**Developers should:**

1. **Never Commit Secrets**
   - `.env` is in `.gitignore` - verify before committing
   - Use `.env.example` for templates only
   - Rotate any accidentally committed keys immediately

2. **Use Least Privilege**
   - Don't run Docker as root if avoidable
   - Use separate API keys for dev/staging/prod

3. **Validate All Inputs**
   - Use Zod schemas for request validation
   - Never trust user input
   - Sanitize before database insertion

4. **Review Dependencies**
   ```bash
   # Check for known vulnerabilities
   pnpm audit

   # Auto-fix where possible
   pnpm audit fix
   ```

5. **Test Security Features**
   - Verify CORS blocks unknown origins
   - Test rate limiting triggers correctly
   - Ensure auth rejects invalid API keys

## Dependency Scanner Advisories

GitHub's Dependabot flags advisories in both runtime and build-time dependencies, including transitives of dev tooling (Jest, Vitest, ESLint, Storybook, etc.). Triage policy for this repo:

- **Runtime CRITICAL / HIGH** — fixed promptly via direct bumps or pnpm overrides in `pnpm-workspace.yaml`.
- **Runtime MEDIUM / LOW** — fixed when a dependency naturally bumps; addressed in periodic sweeps when accumulated.
- **Build-time / dev-only transitives** — also fixed via overrides where Dependabot doesn't have a direct path. The May 2026 sweep cleared the entire transitive backlog this way; the bar going forward is **zero open alerts** at the end of each sweep cycle.

> **Override location.** Overrides live in `pnpm-workspace.yaml` (the v10+ home for that setting). The `pnpm.overrides` block in `package.json` is **silently ignored** by pnpm 10+ — earlier maintenance docs that referenced that location were inaccurate by the time the repo upgraded.

If you believe a flagged alert reaches runtime code, please report it as a vulnerability via the private advisory flow above — that reframes it as a supported-scope issue and gets fixed.

For the active successor project with a fresher, continuously-maintained dep tree, see [claudette](https://github.com/mrdushidush/claudette).

## Known Vulnerabilities

### Current (v0.11.x, as of May 2026)

**Open alerts: 0** (verified post-sweep 2026-05-18). The full Dependabot and code-scanning alert lists are empty for both runtime and dev/transitive dependencies.

Resolved via overrides in `pnpm-workspace.yaml`:

- **handlebars** (CRITICAL GHSA — JS injection via AST type confusion) — forced to `>=4.7.9`.
- **esbuild** `>=0.27.2`, **minimatch** `>=10.2.3` (prior polish passes).
- **lodash** `^4.18.0` — closes prototype-pollution (`_.unset`/`_.omit`) and `_.template` code-injection advisories. *(May 2026 sweep.)*
- **path-to-regexp** `^0.1.13` — closes ReDoS via malformed URL parameters (CVE-2026-4867). *(May 2026 sweep.)*
- **socket.io-parser** `^4.2.6` — closes excessive-buffering DoS (CVE-2026-33151). *(May 2026 sweep.)*
- **undici** `^7.24.0` — closes WebSocket `server_max_window_bits` validation crash. *(May 2026 sweep.)*
- **brace-expansion** `^5.0.6` — closes `max`-protection bypass DoS, disclosed and patched same day. *(May 2026 sweep.)*

Resolved via direct dependency bumps:

- **@anthropic-ai/sdk** — bumped `^0.90.0` → `^0.91.1` (security floor) → `^0.96.0` (latest) in `packages/api/package.json`. Closes the "Insecure Default File Permissions in Local Filesystem Memory Tool" advisory. *(May 2026 sweep.)*

### Past resolutions

- `uuid` — removed entirely from `packages/api/package.json` in the **April 2026 maintenance pass**; was declared as a direct dep but never imported (the only "uuid" references were Zod's `z.string().uuid()` validator, which has no uuid-package dependency). Closed 2 Dependabot alerts.

### Historical

No security advisories published yet.

## Security Scanning

### Automated Scanning

The project uses:
- **Trivy** - Container and dependency vulnerability scanning
- **Dependabot** - GitHub dependency alerts and auto-updates
- **npm audit** - JavaScript dependency vulnerabilities
- **Ruff** - Python code quality and security patterns

### Run Scans Locally

```bash
# Full security scan (requires Trivy installed)
pnpm run security:scan

# Generate HTML report for auditors
pnpm run security:report

# Check npm dependencies
pnpm audit

# Check Python dependencies
cd packages/agents
pip-audit
```

### CI/CD Integration

Security scans run automatically on:
- Every pull request
- Every push to main branch
- Weekly schedule (Mondays at 00:00 UTC)

Results appear in:
- GitHub Security tab
- Pull request checks
- GitHub Actions logs

## Security Contact

- **GitHub Security Advisories**: [Report a vulnerability](https://github.com/mrdushidush/agent-battle-command-center/security/advisories/new)
- **Response Time**: 48 hours for initial acknowledgment

## Acknowledgments

We thank the following security researchers who have responsibly disclosed vulnerabilities:

*(None yet - be the first!)*

---

## Legal

This security policy is subject to change without notice. By using Agent Battle Command Center, you agree to follow responsible disclosure practices.

**Last Updated**: 2026-05-18
**Policy Version**: 1.2 (transitive overrides actively maintained; overrides home corrected to `pnpm-workspace.yaml`; zero-alert bar codified)
