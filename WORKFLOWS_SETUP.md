# Claude Code Workflows - Setup Complete ✅

## What's Been Installed

Your fleet management project now has **three professional-grade AI workflows** for automated code quality, security, and design review.

### 1️⃣ Code Review Workflow (`/review`)
**Purpose:** Automated code quality and best practices review
**Location:** `.claude/commands/review.md`
**Framework:** Pragmatic Quality (balance speed with rigor)

### 2️⃣ Security Review Workflow (`/security`)
**Purpose:** OWASP Top 10 security vulnerability scanning
**Location:** `.claude/commands/security.md`
**Standards:** High-confidence findings only (>80% certainty)

### 3️⃣ Design Review Workflow (`/design`)
**Purpose:** UI/UX and accessibility compliance review
**Location:** `.claude/commands/design.md`
**Standards:** Stripe/Airbnb/Linear level quality

## File Structure

```
my-awesome-project/
├── .claude/
│   └── commands/
│       ├── review.md        ✅ Code review workflow
│       ├── security.md      ✅ Security scan workflow
│       └── design.md        ✅ Design review workflow
├── context/
│   └── design-principles.md ✅ Design system standards
├── CLAUDE.md                ✅ Complete workflow documentation
└── WORKFLOWS_SETUP.md       ✅ This file
```

## How to Use

### Code Review

**When to use:**
- Before committing code
- Before creating pull requests
- After implementing features
- When refactoring code

**Command:**
```bash
/review
```

**What it checks:**
- ✅ Syntax errors and completeness
- ✅ Code style consistency
- ✅ Potential bugs and logic errors
- ✅ Best practices adherence
- ✅ Architecture patterns
- ✅ TypeScript usage
- ✅ NestJS/React specific patterns

**Example output:**
```markdown
# Code Review Report

## Summary
Reviewed 5 files with 234 lines changed

## Issues Found

### HIGH Priority
1. **Missing error handling** (src/drivers/drivers.service.ts:45)
   - No try/catch around database operation
   - Recommendation: Add error handling and proper exception filters

### MEDIUM Priority
2. **Inconsistent naming** (frontend/src/pages/DriversPage.tsx:12)
   - Variable name doesn't follow camelCase convention
   - Should be: `driversList` not `drivers_list`

### LOW Priority
3. **Missing TypeScript type** (backend/src/routes/routes.service.ts:78)
   - Return type not explicitly defined
   - Add: `: Promise<Route[]>`

## Recommendations
- Add unit tests for new service methods
- Consider extracting complex logic into separate functions
```

### Security Review

**When to use:**
- Before every pull request
- After handling user input
- After adding authentication/authorization
- After database query changes
- Before deploying to production

**Command:**
```bash
/security
```

**What it checks:**
- 🔒 SQL/NoSQL injection vulnerabilities
- 🔒 XSS (Cross-site scripting)
- 🔒 Command injection
- 🔒 Authentication bypasses
- 🔒 Authorization flaws
- 🔒 Hardcoded secrets
- 🔒 Weak cryptography
- 🔒 Data exposure
- 🔒 Unsafe deserialization

**Example output:**
```markdown
# Security Review Report

## HIGH Severity Issues

### Vuln 1: SQL Injection: `drivers.service.ts:67`
* **Severity:** HIGH
* **Description:** User input from `name` parameter directly interpolated into raw SQL query
* **Exploit Scenario:** Attacker sends `name=' OR '1'='1` to bypass WHERE clause and access all driver records
* **Recommendation:** Use TypeORM query builder or parameterized queries:
  ```typescript
  await this.driverRepository.find({
    where: { name: input.name }
  });
  ```

### Vuln 2: XSS: `DriversPage.tsx:89`
* **Severity:** MEDIUM
* **Description:** Rendering user-provided `driver.notes` with dangerouslySetInnerHTML
* **Exploit Scenario:** Malicious driver note with `<script>` tag executes in admin's browser
* **Recommendation:** Use React's default escaping or DOMPurify library

## Summary
- HIGH: 1 finding
- MEDIUM: 1 finding
- Total: 2 vulnerabilities

**Action Required:** Fix HIGH severity issues before merge
```

### Design Review

**When to use:**
- After UI component changes
- Before design handoff
- After adding new pages
- When updating styles/themes
- For accessibility compliance

**Command:**
```bash
/design
```

**Requires:** Running development server (frontend)

**What it checks:**
- 🎨 Visual design consistency
- 🎨 Color palette adherence
- 🎨 Typography scale
- 🎨 Spacing and layout
- ♿ WCAG AA+ accessibility
- ♿ Keyboard navigation
- ♿ Screen reader compatibility
- 📱 Responsive design
- ⚡ Performance implications
- 🧩 Component patterns

**Example output:**
```markdown
# Design Review Report

## Visual Design

### ✅ Strengths
- Consistent use of Material-UI components
- Proper spacing with 8px grid system
- Good color contrast ratios

### ⚠️ Issues Found

#### Typography
- **Issue:** H1 size (48px) too large for dashboard context
- **Location:** Dashboard.tsx:15
- **Recommendation:** Use H4 (32px) for page titles per design system

#### Spacing
- **Issue:** Inconsistent padding on cards
- **Location:** VehiclesPage.tsx:42
- **Current:** 16px
- **Should be:** 24px per design tokens

#### Accessibility
- **Issue:** Button missing aria-label
- **Location:** DriversPage.tsx:67
- **Impact:** Screen readers can't identify button purpose
- **Fix:** Add `aria-label="Add new driver"`

## Accessibility Score: 85/100

### Failures
- 3 buttons without accessible labels
- 1 form missing fieldset/legend
- Color-only status indicators (need icons)

### Recommendations
1. Add aria-labels to all icon buttons
2. Ensure form inputs have associated labels
3. Add icon indicators alongside color chips
```

## Playwright MCP Setup

The design review workflow can use Playwright MCP for visual testing.

### Installation

**Option 1: Claude Desktop Settings**

Add to your MCP servers configuration:

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

**Option 2: Project-specific**

Install Playwright:
```bash
cd my-awesome-project
npm install -D @playwright/test
npx playwright install
```

### Usage with `/design`

When you run `/design`, the workflow can:

1. **Visual Screenshots**
   - Capture current UI state
   - Compare with design mockups
   - Verify responsive layouts

2. **Interactive Testing**
   - Test form interactions
   - Verify button states
   - Check hover/focus effects

3. **Accessibility Automation**
   - Run axe-core tests
   - Check keyboard navigation
   - Verify ARIA attributes

**Example:**
```bash
# Start your app first
cd frontend && npm run dev

# Then run design review
/design
```

The workflow will automatically:
- Navigate to changed pages
- Take screenshots
- Test interactions
- Report findings

## GitHub Actions Integration

### Automatic PR Reviews

Create `.github/workflows/code-review.yml`:

```yaml
name: Automated Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Run Code Review
        run: |
          # Run review workflow
          # Post results as PR comment
```

### Security Scanning

Create `.github/workflows/security.yml`:

```yaml
name: Security Scan
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Run Security Review
        run: |
          # Run security workflow
          # Fail PR if HIGH severity found
```

## Customization

### Adjust Review Criteria

**Edit `.claude/commands/review.md`:**
```markdown
# Add project-specific rules:

CUSTOM RULES:
- All services must have unit tests
- GraphQL resolvers must use DTOs
- All database queries must use TypeORM
- Frontend components must be functional (no classes)
```

**Edit `.claude/commands/security.md`:**
```markdown
# Add to SECURITY CATEGORIES:

PROJECT-SPECIFIC CHECKS:
- JWT token expiration validation
- GraphQL query depth limiting
- Rate limiting on mutations
- Input sanitization in resolvers
```

**Edit `CLAUDE.md`:**
```markdown
# Add your brand guidelines:

BRAND COLORS:
- Primary: #1976d2 (Blue)
- Secondary: #dc004e (Pink)
- Success: #2e7d32 (Green)
- Warning: #ed6c02 (Orange)
- Error: #d32f2f (Red)

TYPOGRAPHY:
- Font Family: Inter, system-ui
- Base Size: 16px
- Line Height: 1.5
```

## Best Practices

### 1. Review Frequency

**Every commit:**
```bash
# Before staging
/review

# Fix issues, then
git add .
git commit -m "feat: add driver filtering"
```

**Every PR:**
```bash
# Before creating PR
/review
/security

# Address HIGH findings
# Document MEDIUM findings
# Create PR
```

**Design changes:**
```bash
# Start dev server
npm run dev

# Run design review
/design

# Fix accessibility issues
# Verify responsive design
```

### 2. Issue Prioritization

**Severity Levels:**
- **CRITICAL** (Security HIGH): Block deployment, fix immediately
- **HIGH**: Fix before merge
- **MEDIUM**: Fix in current sprint or document as tech debt
- **LOW**: Address during refactoring or when convenient

### 3. Learning from Reviews

**Track patterns:**
- Common security mistakes
- Frequent style violations
- Accessibility gaps

**Improve over time:**
- Update slash commands with team learnings
- Add project-specific rules
- Refine false positive filters

## Troubleshooting

### `/review` command not found

**Cause:** Commands directory not recognized
**Fix:** Ensure `.claude/commands/` exists and contains `review.md`

### `/security` returns too many false positives

**Cause:** Default filters too permissive
**Fix:** Edit `.claude/commands/security.md` and add to HARD EXCLUSIONS

### `/design` can't access running app

**Cause:** Dev server not running or Playwright MCP not configured
**Fix:**
1. Start dev server: `cd frontend && npm run dev`
2. Configure Playwright MCP in Claude Desktop settings

### Reviews take too long

**Cause:** Large diffs or complex analysis
**Fix:**
- Review smaller changesets
- Use incremental commits
- Run targeted reviews on specific files

## Next Steps

1. **Test the workflows:**
   ```bash
   # Make a small change
   echo "// test comment" >> backend/src/app.module.ts

   # Run review
   /review
   ```

2. **Customize for your needs:**
   - Edit `.claude/commands/*.md` files
   - Add project-specific rules
   - Update `CLAUDE.md` for workflow guidance updates

3. **Integrate with CI/CD:**
   - Add GitHub Actions
   - Configure PR checks
   - Set up notifications

4. **Train your team:**
   - Share CLAUDE.md documentation
   - Demonstrate workflows
   - Establish review standards

## Resources

- **Workflows Source:** https://github.com/OneRedOak/claude-code-workflows
- **Playwright MCP:** https://github.com/modelcontextprotocol/servers/tree/main/src/playwright
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/

---

## Summary

✅ **Code Review** workflow installed at `.claude/commands/review.md`
✅ **Security Review** workflow installed at `.claude/commands/security.md`
✅ **Design Review** workflow installed at `.claude/commands/design.md`
✅ **Design principles** documented in `CLAUDE.md`
✅ **Complete Guide** available in `CLAUDE.md`

**Ready to use!** Type `/review`, `/security`, or `/design` to start.

For Playwright MCP setup, see the Playwright MCP Setup section above.
