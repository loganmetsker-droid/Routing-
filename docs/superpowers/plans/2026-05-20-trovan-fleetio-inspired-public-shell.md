# Trovan Fleetio-Inspired Public Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Trovan public homepage and shared shell into a stronger Fleetio-inspired SaaS marketing experience without pushing live.

**Architecture:** Keep the existing React/MUI public-site module, but add richer content data, reusable mega-menu and product-media components, and homepage sections with restrained scroll motion. Do not clone Fleetio colors or exact copy; preserve Trovan warm/copper brand and existing public/protected route boundaries.

**Tech Stack:** React 18, MUI, React Router, Vite, Vitest, Playwright.

---

### Task 1: Public Shell And Media Frame

**Files:**
- Modify: `frontend/src/pages/public-site/PublicSite.tsx`
- Modify: `e2e/launch-audit.spec.ts`

- [ ] **Step 1: Write failing Playwright tests**

Add tests that verify the public header exposes rich Product/Solutions/Resources mega-menu content, that marketing dashboard screenshots do not render fake browser three-dot chrome, and that the homepage exposes Fleetio-inspired proof sections.

- [ ] **Step 2: Run targeted Playwright tests to verify failure**

Run: `PLAYWRIGHT_MOCK_API_PORT=3041 PLAYWRIGHT_FRONTEND_PORT=5221 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5221 npx playwright test e2e/launch-audit.spec.ts -g "public header mega menus|marketing dashboard frames|homepage fleet-style story"`

Expected: FAIL because the richer menus, no-browser-chrome frame labels, and new story sections are not implemented yet.

- [ ] **Step 3: Replace tiny dropdowns with mega-menu panels**

Implement a reusable menu panel in `PublicSite.tsx` using current MUI `Menu`/`Box` primitives. Product should include workflow links with short descriptions; Solutions should include real operator scenarios; Resources should include demo, support, security, implementation, downloads. Company can remain simple or use a compact panel.

- [ ] **Step 4: Replace screenshot browser chrome**

Update `ScreenshotFrame` and `HeroProductShowcase` so they render as product/app frames, not fake browser windows. Remove the three dot elements and replace the top chrome with a product label/status strip.

- [ ] **Step 5: Run targeted tests to verify pass**

Run the same Playwright command from Step 2. Expected: PASS.

### Task 2: Homepage Story Rhythm

**Files:**
- Modify: `frontend/src/pages/public-site/PublicSite.tsx`
- Modify: `frontend/src/pages/public-site/publicSiteData.ts` only if content data needs to be shared.
- Modify: `e2e/launch-audit.spec.ts`

- [ ] **Step 1: Add failing homepage section test**

Assert the homepage includes a stronger proof strip, a modern operating-grid section, sticky product story copy, no fake customer logos, and only appropriate CTA count.

- [ ] **Step 2: Implement homepage sections**

Add sections: proof strip, modern route-day grid, sticky product story, outcome metrics, buyer FAQ/resources. Keep CTAs restrained. Use existing screenshot assets and route-line preview.

- [ ] **Step 3: Add restrained motion**

Use CSS transitions/keyframes and `@media (prefers-reduced-motion: reduce)` friendly styles. Add `data-motion="scroll-reveal"` markers for testability, not heavy JS scroll listeners.

- [ ] **Step 4: Run targeted tests**

Run focused Playwright tests and verify screenshots at desktop/mobile.

### Task 3: Verification

**Files:**
- No required source changes unless verification catches defects.

- [ ] **Step 1: Run frontend checks**

Run:
- `npm run build --workspace=frontend`
- `npm run lint --workspace=frontend`
- `npm run test --workspace=frontend`
- focused public Playwright tests

- [ ] **Step 2: Rendered QA**

Start local preview with `PLAYWRIGHT_MOCK_API_PORT=3042 PLAYWRIGHT_FRONTEND_PORT=5222 node scripts/playwright-preview-server.mjs`, capture desktop/mobile screenshots for `/`, Product menu, Solutions menu, Resources menu, and `/demo`.

- [ ] **Step 3: Confirm local-only state**

Do not run Cloudflare deploy or git push. Report changed files and local screenshots.
