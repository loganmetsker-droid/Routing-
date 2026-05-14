# Last-Mile Route Audit Website Design

Date: 2026-05-14  
Project: Trovan public website  
Primary domain: `trytrovan.com`

## Goal

Turn the current Trovan public launch page into a credible SaaS sales website for last-mile delivery operators with roughly 5-75 vehicles. The page should sell a focused first offer: a route audit that helps operators find wasted miles, planning time, dispatcher bottlenecks, and customer-update gaps before asking them to commit to a full platform rollout.

The page must feel like a real business website, not a static AI mockup. It should keep using real product screenshots from the existing Trovan UI and include clickable flows, native forms, and meaningful interactive state.

## Positioning

Trovan is a last-mile route planning, dispatch, driver execution, and customer tracking workspace.

Core message:

> Find the wasted miles in tomorrow's routes.

Audience:

- Delivery owners and operators.
- Operations managers.
- Dispatch leads.
- Teams currently planning in spreadsheets, map tabs, text threads, or disconnected point tools.

Primary customer pain:

- Route planning takes too long.
- Dispatchers are chasing drivers manually.
- Drivers need a clearer execution flow.
- Customers keep asking for ETA and proof.
- Operators cannot quickly see which routes are wasteful or risky before the day starts.

Primary CTA:

- `Get a routing audit`

Secondary CTA:

- `Book a demo`

## Page Structure

### 1. Header

Desktop navigation:

- `Trovan`
- `Platform`
- `Route audit`
- `Product`
- `Pricing`
- `Implementation`
- Secondary link: `Sign in`
- Primary button: `Get a routing audit`

Mobile navigation should collapse into a compact menu or stacked header without hiding the primary CTA.

### 2. Hero And Audit Preview

Hero copy:

- H1: `Find the wasted miles in tomorrow's routes`
- Body: Explain that Trovan helps last-mile teams plan balanced routes, publish work to drivers, track exceptions, and keep customers updated without spreadsheets, map tabs, and text threads.

Hero layout:

- Left side: headline, copy, CTA pair, and 2-3 concise trust/outcome statements.
- Right side: interactive `Route audit preview` module.
- The next product section should peek below the first viewport on normal laptop and desktop heights.

Interactive audit preview:

- Inputs:
  - Fleet size: `5-15`, `16-35`, `36-75`
  - Daily stops: slider or segmented values such as `50`, `125`, `250`
  - Biggest pain: `Planning time`, `Driver updates`, `Customer ETAs`, `Missed windows`
- Output changes live:
  - `Planning hours at risk`
  - `Routes needing review`
  - `Customer update gaps`
  - A short recommended next step based on the selected pain.
- Button inside module: `Build my audit`
- Form action can open the same routing-audit dialog as the primary CTA.

The audit preview is not a calculator with guaranteed savings. It is a qualification and demo framing tool. Copy should avoid unsupported ROI claims.

### 3. Problem-To-Outcome Band

Show four operational pains and their Trovan outcomes:

- `Manual route planning` -> `Balanced route plans`
- `Dispatcher guesswork` -> `Live dispatch board`
- `Driver text threads` -> `Mobile execution flow`
- `Customer ETA calls` -> `Tracking and proof links`

This section should be scan-friendly and more operational than decorative. Use icons sparingly and keep language concrete.

### 4. Product Proof Section

Use the existing real screenshots:

- `/marketing/routing-workspace.png`
- `/marketing/dispatch-board.png`
- `/marketing/driver-workspace.png`

Add a fourth product path for customer tracking if a screenshot exists later; until then, use a native UI mini-preview or link to `/track/demo-token`.

Recommended layout:

- Large featured screenshot for routing workspace.
- Side rail or tab controls for:
  - `Plan`
  - `Dispatch`
  - `Drive`
  - `Track`
- Clicking each tab changes the screenshot, copy, and CTA.

Each product proof panel should include:

- One outcome heading.
- Two or three specific capabilities.
- Link to the actual product route, such as `/routing`, `/dispatch`, `/driver`, or `/track/demo-token`.

### 5. Route Audit Offer Section

This is the conversion core.

Headline:

- `What you get in a Trovan route audit`

Content:

- `Workflow review`: how jobs become route plans today.
- `Dispatch friction map`: where updates and exceptions get stuck.
- `Driver execution check`: how drivers receive, complete, and prove work.
- `Customer visibility gap`: where ETA/proof communication breaks down.
- `Implementation plan`: what Trovan would need to connect first.

CTA:

- `Start my route audit`

This section should make the offer feel valuable even before the user has bought software.

### 6. Pricing

Keep pricing simple and sales-ready:

- `Starter`
  - For local teams proving route discipline.
  - CTA: `Get Starter audit`
- `Growth`
  - For dispatch-heavy teams that need live route execution.
  - CTA: `Talk through Growth`
  - Featured plan.
- `Operations`
  - For multi-team delivery operators needing implementation support.
  - CTA: `Plan implementation`

Pricing can stay directional. Avoid overpromising exact enterprise features until provider-backed launch gates are complete.

### 7. Implementation And Trust

Position implementation honestly:

- `Domain and hosting`
- `Auth and user roles`
- `Billing path`
- `Email/SMS/customer updates`
- `Routing-service verification`
- `Security and tenant controls`

This section should not expose internal uncertainty in a way that scares buyers. Present it as a professional rollout checklist:

> We map your current workflow, connect the first systems, and prove the day-one route flow before expanding.

### 8. Final CTA

Final section:

- Headline: `Bring tomorrow's routes into one workspace`
- CTA: `Get a routing audit`
- Secondary: `Book a demo`
- Optional link: `View customer tracking`

## Forms And Interactions

### Routing Audit Dialog

The primary CTA opens a native dialog or full-page form with:

- Work email
- Company
- Fleet size
- Daily stops
- Biggest routing pain
- Current planning method
- Optional notes

After submit:

- Show an in-page success state.
- Copy should say the request was captured for rollout/demo unless a real backend integration is implemented in the same pass.
- Do not pretend email/CRM delivery happened if it did not.

### Demo Dialog

`Book a demo` can use the existing dialog pattern but should be updated to match route-audit language and visual styling.

### Product Links

All product CTAs should remain clickable:

- `/routing`
- `/dispatch`
- `/driver`
- `/track/demo-token`
- `/login`

Direct route refresh currently needs Cloudflare SPA fallback to be deployed. The local frontend should include `_redirects` or an equivalent Worker static-assets SPA config.

## Visual System

Keep the existing Trovan brand direction, but make it cleaner and more credible:

- Background: dark charcoal/black for hero and trust sections.
- Surface: warm white or true white for product and pricing sections.
- Accent: copper/rust used for primary CTAs and route highlights.
- Typography:
  - Keep the current `Instrument Sans` for UI/body.
  - Keep `Newsreader` or the existing brand serif for large display headings, but use it with restraint.
- Cards:
  - Use small-radius SaaS panels, not oversized rounded bento blocks.
  - Avoid cards inside cards.
- Media:
  - Real screenshots should be large, legible, and framed consistently.
  - Product screenshots should not be hidden behind heavy overlays.
- Motion:
  - Add subtle interaction on audit controls and screenshot tab transitions.
  - Respect `prefers-reduced-motion`.

## Components

Recommended component split:

- `MarketingHeader`
- `RouteAuditPreview`
- `RouteAuditDialog`
- `ProblemOutcomeBand`
- `ProductProofTabs`
- `AuditOfferSection`
- `PricingSection`
- `ImplementationSection`
- `FinalCta`

Keep these in `PublicLaunchPage.tsx` only if the file stays readable. If it grows too large, extract local components under `frontend/src/pages/public-launch/`.

## Data Model

Use static arrays for:

- Navigation items.
- Audit preview options.
- Pain-to-outcome cards.
- Product proof tabs.
- Audit deliverables.
- Pricing plans.
- Implementation checklist items.

The audit preview state should be local React state. It does not need backend persistence in this pass.

## Error Handling

- Product screenshot image failures should keep the existing fallback behavior, but the fallback should look polished and on-brand.
- Form submit should never navigate away or lose entered state unexpectedly.
- If a product link is unavailable in hosted deployment, it should still be valid in local SPA routing and covered by the Cloudflare fallback deployment task.

## Accessibility

- Preserve semantic landmarks: `header`, `main`, `section`, form labels, and accessible dialog close buttons.
- All controls in the audit preview must be keyboard reachable.
- Buttons and links must have visible focus states.
- Color contrast must pass for dark and light sections.
- Dialog success state should be announced with appropriate alert semantics.

## SEO And Metadata

Update public metadata where the project currently supports it:

- Title: `Trovan | Last-mile route planning and dispatch`
- Description: `Find wasted miles, dispatch routes, guide drivers, and keep customers updated from one last-mile delivery workspace.`

Do not add unsupported claims such as guaranteed savings or customer counts.

## Verification Plan

Required checks after implementation:

- `npm run build --workspace=frontend`
- Existing launch/audit Playwright coverage, updated for new CTA labels.
- Browser or Playwright smoke for:
  - Homepage loads.
  - Primary audit CTA opens form.
  - Audit preview controls update output.
  - Product tabs change content.
  - Product links are clickable.
  - Mobile viewport has no horizontal overflow.
  - Direct `/routing` and `/dashboard` refresh behavior is addressed before production handoff.
- Hosted smoke after deploy:
  - `https://trytrovan.com/` returns `200`.
  - `https://www.trytrovan.com/` returns `200`.
  - Direct app routes either return the SPA shell or intentionally redirect.

## Out Of Scope For This Pass

- Real CRM/calendar/email integration.
- Real ROI calculator with guaranteed savings.
- Customer logos or testimonials unless real references are available.
- Broad fleet-management claims around maintenance, safety, ELD, compliance, insurance, or asset tracking.
- Payment checkout.
- AI/chat route-advice backend.

## Source References Considered

- Samsara reference: fast lead capture, pricing/demo CTA, strong operational platform feel.
- Solera reference: route optimization, dispatch, real-time tracking, and operational outcome language.
- Fleetio reference: workflow-specific paths and product-led clarity.
- Omnitracs reference: routing/dispatch positioning around customer demands, optimized routes, and exception response.

The design should borrow the seriousness and conversion structure of these references without copying their brand, layout, or unsupported breadth.
