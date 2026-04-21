# Claude Code Workflows - Quick Reference Card

## 🚀 Quick Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/review` | Code quality review | Before commits, PRs |
| `/security` | Security vulnerability scan | Before PRs, deployments |
| `/design` | UI/UX & accessibility review | After UI changes |

## 📋 Code Review (`/review`)

**Checks:**
- ✅ Syntax & completeness
- ✅ Code style & conventions
- ✅ Potential bugs
- ✅ Best practices
- ✅ Architecture alignment

**Output:** Markdown report with prioritized issues

**Time:** ~30-60 seconds

## 🔒 Security Review (`/security`)

**Checks:**
- 🔐 Injection vulnerabilities (SQL, XSS, Command)
- 🔐 Auth/authorization issues
- 🔐 Hardcoded secrets
- 🔐 Weak crypto
- 🔐 Data exposure

**Severity Levels:**
- **HIGH**: Fix immediately (blocks deployment)
- **MEDIUM**: Fix before merge
- **LOW**: Document as tech debt

**Time:** ~60-90 seconds

## 🎨 Design Review (`/design`)

**Requires:** Running dev server (`npm run dev`)

**Checks:**
- 🎨 Visual consistency
- ♿ Accessibility (WCAG AA+)
- 📱 Responsive design
- ⚡ Performance
- 🧩 Component patterns

**Optional:** Playwright MCP for visual testing

**Time:** ~90-120 seconds

## ⚡ Typical Workflow

### 1. Feature Development
```bash
# Write code...

# Before commit
/review

# Fix issues
git add .
git commit -m "feat: add feature"
```

### 2. Pre-Pull Request
```bash
# Review code quality
/review

# Check security
/security

# If UI changes
cd frontend && npm run dev
/design

# Fix any HIGH/MEDIUM issues
```

### 3. Deployment
```bash
# Final security check
/security

# Ensure no HIGH severity
# Deploy
```

## 🎯 Priority Matrix

| Severity | Security | Code | Design | Action |
|----------|----------|------|--------|--------|
| **CRITICAL** | HIGH | - | - | Block merge/deploy |
| **HIGH** | MEDIUM | HIGH | HIGH | Fix before merge |
| **MEDIUM** | LOW | MEDIUM | MEDIUM | Fix in sprint |
| **LOW** | - | LOW | LOW | Tech debt |

## 🔧 Setup Requirements

### Code Review
- ✅ No setup needed
- ✅ Works immediately

### Security Review
- ✅ No setup needed
- ✅ Works immediately

### Design Review
- ⚙️ Requires running app
- 🎭 Optional: Playwright MCP

## 🎭 Playwright MCP Setup

**Claude Desktop Config:**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }
}
```

**Capabilities with Playwright:**
- 📸 Visual screenshots
- 🖱️ Interactive testing
- ♿ Automated accessibility checks
- 📱 Responsive testing

## 📊 Example Output Snippets

### Code Review
```markdown
### HIGH Priority
1. **Missing error handling** (drivers.service.ts:45)
   Recommendation: Add try/catch with proper exception filter
```

### Security Review
```markdown
### Vuln 1: SQL Injection: `drivers.service.ts:67`
* Severity: HIGH
* Fix: Use TypeORM query builder instead of raw SQL
```

### Design Review
```markdown
### Accessibility Issue
- Button missing aria-label (DriversPage.tsx:67)
- Fix: Add aria-label="Add new driver"
```

## 🚨 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `/review` not found | Check `.claude/commands/review.md` exists |
| Too many false positives | Edit security exclusions |
| `/design` can't access app | Start dev server first |
| Reviews too slow | Review smaller changesets |

## 📚 Full Documentation

- **Complete Guide:** `CLAUDE.md`
- **Setup Instructions:** `WORKFLOWS_SETUP.md`
- **Design guidelines:** documented in `CLAUDE.md`

## 🔗 Resources

- [Workflows Repo](https://github.com/OneRedOak/claude-code-workflows)
- [Playwright MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/playwright)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Pro Tip:** Run `/review` before every commit, `/security` before every PR, and `/design` after any UI changes.
