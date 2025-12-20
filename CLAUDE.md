# Fleet Management System - Claude Code Guide

## Project Overview

### Description
A modern fleet management system built with NestJS, GraphQL, React, and PostgreSQL. Provides driver management, vehicle tracking, route optimization, job dispatch, and real-time monitoring capabilities.

### Tech Stack
**Backend:**
- NestJS 10 - Node.js framework
- GraphQL with Apollo Server - API layer
- TypeORM - Database ORM
- PostgreSQL - Primary database
- Redis + Bull - Job queues & caching
- JWT - Authentication
- Passport.js - Auth strategies

**Frontend:**
- React 18 with TypeScript
- Apollo Client 4 - GraphQL client
- Material-UI v5 - Component library
- React Router v6 - Client-side routing
- Leaflet - Map visualization
- Vite - Build tool & dev server

## Project Structure

```
my-awesome-project/
├── backend/                    # NestJS GraphQL API
│   ├── src/
│   │   ├── drivers/           # Driver CRUD & management
│   │   ├── vehicles/          # Vehicle tracking & maintenance
│   │   ├── jobs/              # Task/job management
│   │   ├── routes/            # Route planning & optimization
│   │   ├── dispatches/        # Dispatch assignment system
│   │   ├── tracking/          # Real-time GPS tracking
│   │   ├── auth/              # JWT authentication & guards
│   │   └── common/            # Shared utilities & decorators
│   ├── .env                   # Environment variables
│   └── package.json
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── pages/             # Route pages
│   │   │   ├── Dashboard.tsx         # Stats overview
│   │   │   ├── DriversPage.tsx       # Driver management
│   │   │   ├── VehiclesPage.tsx      # Vehicle management
│   │   │   ├── JobsPage.tsx          # Job overview
│   │   │   ├── RoutesPage.tsx        # Route visualization
│   │   │   └── LoginPage.tsx         # Authentication
│   │   ├── components/        # Shared components
│   │   │   └── Layout.tsx            # Main app layout
│   │   ├── graphql/           # GraphQL operations
│   │   │   ├── queries.ts            # Query definitions
│   │   │   ├── mutations.ts          # Mutation definitions
│   │   │   └── hooks.ts              # Custom React hooks
│   │   ├── apollo/            # Apollo Client config
│   │   ├── theme.ts           # MUI theme
│   │   └── types.ts           # TypeScript interfaces
│   └── package.json
│
└── CLAUDE.md                   # This file
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 13+
- Redis 6+ (optional for queues)
- Git

### Installation
```bash
# Install all dependencies (monorepo)
npm install

# Or install individually
cd backend && npm install
cd frontend && npm install
```

### Environment Setup
1. Create `backend/.env` (see backend/.env for template)
2. Configure database connection
3. Set JWT secret for production

### Running the Project

**Start Backend:**
```bash
cd backend
npm run dev              # Starts on http://localhost:3000
```

**Start Frontend:**
```bash
cd frontend
npm run dev              # Starts on http://localhost:5173
```

**Access Points:**
- Frontend UI: http://localhost:5173
- GraphQL Playground: http://localhost:3000/graphql
- Backend API: http://localhost:3000

## Development Guidelines

### Code Style
- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with Airbnb config
- **Formatting**: Prettier with 2-space indentation
- **Naming**: camelCase for variables/functions, PascalCase for classes/components

### Testing
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests (if implemented)
npm run test:e2e
```

### Git Workflow
- **Branches**: `feature/`, `fix/`, `refactor/` prefixes
- **Commits**: Conventional commits format
- **PRs**: Require code review + all CI checks passing

## Important Notes for Claude Code
- Prioritize brevity over grammar
- Give precise, to-the-point examples
- Shorten all text responses
- Code examples over explanations
- Always read files before editing
- Use proper TypeScript types
- Follow existing patterns in codebase

## Architecture & Patterns

### Backend
- **Repository Pattern**: TypeORM repositories for data access
- **Service Layer**: Business logic separated from controllers
- **GraphQL Resolvers**: Thin layer delegating to services
- **Guards**: JWT authentication + role-based authorization
- **DTOs**: Input validation with class-validator
- **Queues**: Bull for async job processing

### Frontend
- **Component Structure**: Functional components with hooks
- **State Management**: Apollo Client cache + local state
- **Routing**: React Router with nested routes in Layout
- **Forms**: Controlled components with MUI
- **API Layer**: GraphQL with Apollo Client
- **Error Handling**: Error boundaries + toast notifications

## Resources
- [NestJS Docs](https://docs.nestjs.com/)
- [GraphQL Docs](https://graphql.org/learn/)
- [Apollo Client](https://www.apollographql.com/docs/react/)
- [Material-UI](https://mui.com/material-ui/getting-started/)
- [TypeORM](https://typeorm.io/)

---

# Claude Code Workflows

## 1. Code Review Workflow

### Slash Command: `/review`

Use this command to trigger comprehensive code review of current branch changes.

**What it checks:**
- Syntax errors and code completeness
- Code style consistency
- Potential bugs and logic errors
- Best practices adherence
- Architecture alignment

**Usage:**
```bash
/review
```

**Framework: Pragmatic Quality**
- Balance rigorous engineering with development speed
- Focus on actionable, specific feedback
- Explain engineering principles behind suggestions
- Be constructive and concise

### Implementation Files

**Location:** `.claude/commands/review.md`

**Content:**
```markdown
---
allowed-tools: Grep, LS, Read, Edit, MultiEdit, Write, Bash, Glob, Task
description: Conduct comprehensive code review of pending changes based on Pragmatic Quality framework
---

You are acting as Principal Engineer AI Reviewer for a high-velocity startup. Enforce "Pragmatic Quality" framework: balance rigorous standards with speed.

Analyze current branch changes:

GIT STATUS:
!`git status`

FILES MODIFIED:
!`git diff --name-only origin/HEAD...`

COMMITS:
!`git log --no-decorate origin/HEAD...`

DIFF CONTENT:
!`git diff --merge-base origin/HEAD`

OBJECTIVE:
Comprehensively review the complete diff above. Provide specific, actionable feedback in markdown report format.

OUTPUT GUIDELINES:
- Specific, actionable feedback
- Explain engineering principles
- Constructive and concise
- Markdown format
```

## 2. Security Review Workflow

### Slash Command: `/security`

Performs focused security analysis on branch changes.

**What it checks:**
- Input validation vulnerabilities (SQL injection, XSS, command injection)
- Authentication & authorization issues
- Crypto & secrets management
- Code execution vulnerabilities
- Data exposure risks
- OWASP Top 10 compliance

**Usage:**
```bash
/security
```

**Severity Levels:**
- **HIGH**: Direct RCE, data breach, auth bypass
- **MEDIUM**: Conditional exploitation with significant impact
- **LOW**: Defense-in-depth issues

### Implementation Files

**Location:** `.claude/commands/security.md`

**Content:**
```markdown
---
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Read, Glob, Grep, LS, Task
description: Complete security review of pending changes on current branch
---

You are a senior security engineer conducting focused security review.

GIT STATUS:
!`git status`

FILES MODIFIED:
!`git diff --name-only origin/HEAD...`

DIFF CONTENT:
!`git diff --merge-base origin/HEAD`

OBJECTIVE:
Identify HIGH-CONFIDENCE security vulnerabilities with real exploitation potential.

CRITICAL INSTRUCTIONS:
1. MINIMIZE FALSE POSITIVES: >80% confidence required
2. AVOID NOISE: Skip theoretical issues
3. FOCUS ON IMPACT: Unauthorized access, data breaches, system compromise
4. EXCLUSIONS: No DOS, disk secrets, rate limiting

SECURITY CATEGORIES:
- Input Validation (SQL, Command, XXE, Template, NoSQL, Path injection)
- Auth & Authorization (bypass, privilege escalation, session flaws)
- Crypto & Secrets (hardcoded keys, weak crypto, improper storage)
- Injection & Code Execution (RCE, deserialization, eval, XSS)
- Data Exposure (sensitive logging, PII, API leakage)

OUTPUT FORMAT (markdown):
# Vuln 1: [Type]: `file:line`
* Severity: [HIGH/MEDIUM/LOW]
* Description: [detailed description]
* Exploit Scenario: [concrete attack path]
* Recommendation: [specific fix]

CONFIDENCE SCORING:
- 0.9-1.0: Certain exploit path
- 0.8-0.9: Clear vulnerability pattern
- Below 0.8: Don't report

Report HIGH and MEDIUM only. Better to miss theoretical than flood with false positives.
```

### False Positive Filters

**Hard Exclusions:**
1. DOS/resource exhaustion
2. Secured secrets on disk
3. Rate limiting concerns
4. Memory/CPU issues
5. Non-security-critical validation
6. GitHub Action workflow inputs (unless clearly untrusted)
7. Lack of hardening measures
8. Theoretical race conditions
9. Outdated third-party libraries
10. Memory safety in memory-safe languages (Rust, etc.)
11. Unit test files
12. Log spoofing
13. SSRF (path-only control)
14. AI prompt injection
15. Regex injection/DOS
16. Documentation issues
17. Lack of audit logs

**Precedents:**
- Logging high-value secrets = vulnerability
- Logging URLs = safe
- UUIDs = unguessable
- Environment variables/CLI flags = trusted
- React/Angular = XSS-safe (unless dangerouslySetInnerHTML)
- Client-side auth checks = not required
- GitHub Actions = rarely exploitable
- Notebooks (.ipynb) = rarely exploitable
- Shell scripts = rarely exploitable (no untrusted input)

## 3. Design Review Workflow

### Slash Command: `/design`

Conducts world-class UI/UX and front-end design review.

**What it checks:**
- User experience quality
- Visual design consistency
- Accessibility (WCAG AA+)
- Component implementation
- Design system adherence
- Responsive design
- Performance implications

**Usage:**
```bash
/design
```

**Standards:** Stripe, Airbnb, Linear level quality

### Implementation Files

**Location:** `.claude/commands/design.md`

**Content:**
```markdown
---
allowed-tools: Grep, LS, Read, Edit, Write, Task, mcp__playwright__*
description: Complete design review of pending changes on current branch
---

You are elite design review specialist with expertise in UX, visual design, accessibility, front-end.

Conduct world-class design reviews following rigorous standards of Stripe, Airbnb, Linear.

GIT STATUS:
!`git status`

FILES MODIFIED:
!`git diff --name-only origin/HEAD...`

DIFF CONTENT:
!`git diff --merge-base origin/HEAD`

OBJECTIVE:
Comprehensively review design quality and implementation.

DESIGN PRINCIPLES (from context/design-principles.md):
- Users First
- Meticulous Craft
- Speed & Performance
- Simplicity & Clarity
- Focus & Efficiency
- Consistency
- Accessibility (WCAG AA+)
- Thoughtful Defaults

Review markdown report format.
```

### Design Principles

**Core Philosophy:**
1. **Users First** - Prioritize user needs and workflows
2. **Meticulous Craft** - Precision and polish in every element
3. **Speed & Performance** - Fast loads, snappy interactions
4. **Simplicity & Clarity** - Clean, unambiguous interface
5. **Focus & Efficiency** - Quick goal achievement, minimal friction
6. **Consistency** - Uniform design language throughout
7. **Accessibility** - WCAG AA+ compliance
8. **Thoughtful Defaults** - Efficient default workflows

**Design System Foundation:**
- Color palette (brand, neutrals, semantic, dark mode)
- Typographic scale (clean sans-serif, modular sizing)
- Spacing units (8px base, consistent multiples)
- Border radii (small 4-6px, medium 8-12px)
- Core components (buttons, inputs, cards, tables, modals, nav, etc.)

**Layout & Hierarchy:**
- Responsive grid system
- Strategic white space
- Clear visual hierarchy
- Consistent alignment
- Persistent sidebar navigation
- Mobile-first considerations

**Interaction Design:**
- Purposeful micro-interactions (150-300ms)
- Clear loading states (skeleton screens, spinners)
- Smooth transitions
- Keyboard navigation
- Avoid distractions

## Playwright MCP Setup

### Configuration

Add to your MCP settings file (`.mcp/config.json` or Claude Desktop config):

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

### Available Tools

**Browser Control:**
- `browser_navigate` - Navigate to URL
- `browser_click` - Click elements
- `browser_type` - Type into inputs
- `browser_take_screenshot` - Capture screenshots
- `browser_snapshot` - Get page structure
- `browser_evaluate` - Run JavaScript

**Testing:**
- `browser_wait_for` - Wait for elements/conditions
- `browser_console_messages` - Get console logs
- `browser_network_requests` - Monitor network

**Multi-tab:**
- `browser_tab_new` - Open new tab
- `browser_tab_list` - List tabs
- `browser_tab_select` - Switch tabs
- `browser_tab_close` - Close tab

### Usage in Design Review

```markdown
# Example Design Review with Playwright

## Visual Inspection
1. Navigate to page: `browser_navigate(http://localhost:5173/drivers)`
2. Take screenshot: `browser_take_screenshot()`
3. Check responsive: `browser_resize(width=375, height=667)`
4. Screenshot mobile: `browser_take_screenshot()`

## Accessibility Check
1. Get page structure: `browser_snapshot()`
2. Verify ARIA labels present
3. Test keyboard navigation
4. Check color contrast ratios

## Interactive Elements
1. Click button: `browser_click(selector='.add-driver-btn')`
2. Type in form: `browser_type(selector='#firstName', text='Test')`
3. Verify form validation
4. Check error messages

## Performance
1. Get network requests: `browser_network_requests()`
2. Verify asset optimization
3. Check load times
```

### Integration with Workflows

**In `/design` command:**
1. Identify UI changes from git diff
2. Start local dev server if needed
3. Use Playwright to navigate and screenshot
4. Analyze visual design
5. Test interactions
6. Verify accessibility
7. Generate detailed report

## Workflow Integration

### Setup Instructions

1. **Create slash command files:**
```bash
mkdir -p .claude/commands
cd .claude/commands
```

2. **Copy workflow content:**
- Create `review.md` with code review workflow
- Create `security.md` with security review workflow
- Create `design.md` with design review workflow

3. **Create context files:**
```bash
mkdir -p context
```
- Add `design-principles.md` with design standards
- Add `style-guide.md` with coding standards

4. **Configure Playwright MCP:**
- Add Playwright MCP server to Claude Desktop settings
- Test with `browser_navigate` command

5. **Test workflows:**
```bash
/review    # Test code review
/security  # Test security scan
/design    # Test design review (requires running app)
```

### GitHub Actions Integration

**Code Review Action** (`.github/workflows/code-review.yml`):
```yaml
name: Code Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Code Review
        # Add Claude Code review automation
```

**Security Scan Action** (`.github/workflows/security.yml`):
```yaml
name: Security Review
on: [pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Security Scan
        # Add security review automation
```

### Best Practices

1. **Run reviews frequently** - Before committing, before PRs
2. **Address HIGH findings immediately** - Security and critical bugs
3. **Track MEDIUM findings** - Plan fixes, don't block
4. **Learn from reviews** - Improve coding patterns
5. **Customize for your stack** - Adjust rules for NestJS/React
6. **Automate in CI/CD** - Consistent checks on every PR
7. **Iterate on design** - Use Playwright for visual regression

### Customization

**Adjust review criteria:**
- Edit workflow prompts for project-specific rules
- Add custom security patterns
- Define design system tokens
- Configure accessibility requirements

**Tech stack specific:**
- NestJS: Check guard usage, DTO validation, exception filters
- GraphQL: Verify resolver security, query complexity limits
- React: Check hooks usage, memoization, accessibility
- TypeORM: Verify query safety, migration patterns

---

## Quick Reference

### Slash Commands
- `/review` - Code quality review
- `/security` - Security vulnerability scan
- `/design` - UI/UX design review

### Key Principles
- **Code**: Pragmatic quality, actionable feedback
- **Security**: High confidence, minimize false positives
- **Design**: User-first, accessible, performant

### Integration
- Local: Use slash commands during development
- CI/CD: Automate with GitHub Actions
- Design: Requires running app + Playwright MCP

**Workflows source:** https://github.com/OneRedOak/claude-code-workflows
