# Last-Mile Route Audit Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current public Trovan launch page with a sales-ready last-mile route-audit website that converts delivery operators into audit/demo leads.

**Architecture:** Keep the route at `/` and preserve the existing React/Vite/MUI stack. Split the public page into local sections and static data helpers so the page remains readable while delivering live audit-preview state, tabbed product proof, route-audit/demo dialogs, pricing, implementation trust, and final CTA flows.

**Tech Stack:** React 18, TypeScript, Vite, MUI v5, React Router, Playwright, Cloudflare Worker static assets.

---

## File Structure

- Modify `frontend/src/pages/PublicLaunchPage.tsx`: public landing page composition, section components, local state, route-audit dialog, product proof tabs, pricing, and implementation CTA.
- Keep `frontend/public/_redirects`: SPA fallback rules for hosted direct app routes. Expand only if new public routes are introduced.
- Modify `e2e/launch-audit.spec.ts`: update homepage workflow tests for `Get a routing audit`, audit preview controls, product tabs, and form success state.
- Optionally modify `frontend/src/App.tsx`: only if metadata or routing changes require it. The current `/` route should remain `PublicLaunchPage`.
- Optionally modify `frontend/index.html`: update static title/description if Vite metadata is currently static there.
- Do not modify backend files for this pass.

## Task 1: Public Page Data And Audit Preview Model

**Files:**
- Modify: `frontend/src/pages/PublicLaunchPage.tsx`

- [ ] **Step 1: Define static data arrays and audit state types**

Add these type definitions and data constants near the top of `frontend/src/pages/PublicLaunchPage.tsx`, replacing the current generic `sections`, `flowSteps`, `productScreens`, and `plans` constants:

```ts
type FleetSizeKey = '5-15' | '16-35' | '36-75';
type DailyStopsKey = '50' | '125' | '250';
type PainKey = 'planning' | 'updates' | 'etas' | 'windows';

type AuditInputs = {
  fleetSize: FleetSizeKey;
  dailyStops: DailyStopsKey;
  pain: PainKey;
};

type AuditSnapshot = {
  planningHours: string;
  routesToReview: string;
  updateGaps: string;
  nextStep: string;
};

const navItems = [
  { label: 'Platform', href: '#platform' },
  { label: 'Route audit', href: '#route-audit' },
  { label: 'Product', href: '#product' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Implementation', href: '#implementation' },
];

const fleetSizeOptions: Array<{ label: FleetSizeKey; description: string }> = [
  { label: '5-15', description: 'Owner-led routes' },
  { label: '16-35', description: 'Growing dispatch team' },
  { label: '36-75', description: 'Multi-route operation' },
];

const dailyStopOptions: Array<{ label: DailyStopsKey; description: string }> = [
  { label: '50', description: 'Light daily plan' },
  { label: '125', description: 'Dense local routes' },
  { label: '250', description: 'High-volume delivery' },
];

const painOptions: Array<{ key: PainKey; label: string; description: string }> = [
  { key: 'planning', label: 'Planning time', description: 'Routes take too long to build.' },
  { key: 'updates', label: 'Driver updates', description: 'Dispatch is chasing route status.' },
  { key: 'etas', label: 'Customer ETAs', description: 'Customers keep asking where orders are.' },
  { key: 'windows', label: 'Missed windows', description: 'Stops slip without early warning.' },
];
```

- [ ] **Step 2: Add deterministic audit snapshot helper**

Add this helper below the constants:

```ts
function getAuditSnapshot(inputs: AuditInputs): AuditSnapshot {
  const stopFactor = inputs.dailyStops === '50' ? 1 : inputs.dailyStops === '125' ? 2 : 3;
  const fleetFactor = inputs.fleetSize === '5-15' ? 1 : inputs.fleetSize === '16-35' ? 2 : 3;
  const planningHours = 3 + stopFactor + fleetFactor;
  const routesToReview = Math.max(2, fleetFactor + stopFactor);
  const updateGaps = inputs.pain === 'etas' ? 'High' : inputs.pain === 'updates' ? 'Medium-high' : 'Medium';

  const nextSteps: Record<PainKey, string> = {
    planning: 'Start with tomorrow route build and compare manual planning time to a dispatch-ready Trovan plan.',
    updates: 'Map the handoff between dispatch and drivers, then replace status chasing with live route progress.',
    etas: 'Review the customer notification path and identify where tracking links can remove ETA calls.',
    windows: 'Review late-risk stops before dispatch so planners can rebalance routes earlier.',
  };

  return {
    planningHours: `${planningHours}-${planningHours + 2} hrs`,
    routesToReview: `${routesToReview}-${routesToReview + 2}`,
    updateGaps,
    nextStep: nextSteps[inputs.pain],
  };
}
```

- [ ] **Step 3: Run frontend typecheck through build**

Run:

```bash
npm run build --workspace=frontend
```

Expected: TypeScript should compile. If it fails because constants are not yet wired, continue to Task 2 and re-run after wiring.

## Task 2: Header, Hero, And Interactive Route Audit Preview

**Files:**
- Modify: `frontend/src/pages/PublicLaunchPage.tsx`

- [ ] **Step 1: Update header copy and CTAs**

Change `MarketingHeader` props to:

```ts
function MarketingHeader({
  onStartAudit,
  onBookDemo,
}: {
  onStartAudit: () => void;
  onBookDemo: () => void;
}) {
```

Use `navItems` for nav buttons. Keep `Sign in` as an outlined link to `/login`. Replace the primary header button with:

```tsx
<Button variant="contained" startIcon={<RouteRoundedIcon />} onClick={onStartAudit}>
  Get a routing audit
</Button>
```

- [ ] **Step 2: Create `RouteAuditPreview` component**

Add this component before `PublicLaunchPage`:

```tsx
function RouteAuditPreview({
  onStartAudit,
}: {
  onStartAudit: (inputs?: AuditInputs) => void;
}) {
  const [inputs, setInputs] = useState<AuditInputs>({
    fleetSize: '16-35',
    dailyStops: '125',
    pain: 'planning',
  });
  const snapshot = getAuditSnapshot(inputs);

  return (
    <Box
      aria-label="Route audit preview"
      sx={{
        borderRadius: 1.6,
        border: `1px solid ${alpha('#FFF8ED', 0.14)}`,
        bgcolor: alpha(trovanColors.utility.panel, 0.92),
        boxShadow: '0 34px 90px rgba(0,0,0,0.42)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: `1px solid ${alpha('#FFF8ED', 0.1)}` }}>
        <Typography variant="h5" sx={{ color: '#FFF8ED', fontWeight: 900 }}>
          Route audit preview
        </Typography>
        <Typography sx={{ mt: 0.5, color: alpha('#FFF8ED', 0.68) }}>
          Tune the snapshot to your operation and see where a first Trovan audit starts.
        </Typography>
      </Box>
      <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'grid', gap: 2 }}>
        <Box>
          <Typography sx={{ color: alpha('#FFF8ED', 0.72), fontWeight: 800, mb: 1 }}>
            Fleet size
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {fleetSizeOptions.map((option) => (
              <Button
                key={option.label}
                variant={inputs.fleetSize === option.label ? 'contained' : 'outlined'}
                onClick={() => setInputs((current) => ({ ...current, fleetSize: option.label }))}
              >
                {option.label}
              </Button>
            ))}
          </Stack>
        </Box>
        <Box>
          <Typography sx={{ color: alpha('#FFF8ED', 0.72), fontWeight: 800, mb: 1 }}>
            Daily stops
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {dailyStopOptions.map((option) => (
              <Button
                key={option.label}
                variant={inputs.dailyStops === option.label ? 'contained' : 'outlined'}
                onClick={() => setInputs((current) => ({ ...current, dailyStops: option.label }))}
              >
                {option.label}
              </Button>
            ))}
          </Stack>
        </Box>
        <TextField
          select
          label="Biggest routing pain"
          value={inputs.pain}
          onChange={(event) =>
            setInputs((current) => ({ ...current, pain: event.target.value as PainKey }))
          }
          InputLabelProps={{ sx: { color: alpha('#FFF8ED', 0.72) } }}
          sx={{
            '& .MuiInputBase-root': { color: '#FFF8ED' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#FFF8ED', 0.18) },
            '& .MuiSvgIcon-root': { color: '#FFF8ED' },
          }}
        >
          {painOptions.map((option) => (
            <MenuItem key={option.key} value={option.key}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
          {[
            ['Planning hours at risk', snapshot.planningHours],
            ['Routes needing review', snapshot.routesToReview],
            ['Customer update gaps', snapshot.updateGaps],
          ].map(([label, value]) => (
            <Box key={label} sx={{ p: 1.4, borderRadius: 1.2, bgcolor: alpha('#FFF8ED', 0.06), border: `1px solid ${alpha('#FFF8ED', 0.1)}` }}>
              <Typography sx={{ color: alpha('#FFF8ED', 0.6), fontSize: 12, fontWeight: 800 }}>
                {label}
              </Typography>
              <Typography sx={{ mt: 0.5, color: '#FFF8ED', fontSize: 24, fontWeight: 900 }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
        <Alert severity="info" sx={{ bgcolor: alpha('#C99658', 0.12), color: '#FFF8ED' }}>
          {snapshot.nextStep}
        </Alert>
        <Button variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} onClick={() => onStartAudit(inputs)}>
          Build my audit
        </Button>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Replace hero copy and right-side preview**

In `PublicLaunchPage`, replace the current hero H1 with:

```tsx
Find the wasted miles in tomorrow&apos;s routes
```

Replace the body copy with:

```tsx
Trovan helps last-mile delivery operators turn spreadsheet plans, map tabs, driver texts, and ETA calls into one route planning and dispatch workspace.
```

Set hero CTA buttons to:

```tsx
<Button variant="contained" size="large" startIcon={<RouteRoundedIcon />} onClick={() => openAuditDialog()}>
  Get a routing audit
</Button>
<Button variant="outlined" size="large" startIcon={<CalendarMonthRoundedIcon />} onClick={() => setDemoOpen(true)}>
  Book a demo
</Button>
```

Replace `<ProductPreview />` with:

```tsx
<RouteAuditPreview onStartAudit={openAuditDialog} />
```

- [ ] **Step 4: Add `openAuditDialog` state**

In `PublicLaunchPage`, add:

```ts
const [auditOpen, setAuditOpen] = useState(false);
const [auditDefaults, setAuditDefaults] = useState<AuditInputs>({
  fleetSize: '16-35',
  dailyStops: '125',
  pain: 'planning',
});

const openAuditDialog = (inputs?: AuditInputs) => {
  if (inputs) {
    setAuditDefaults(inputs);
  }
  setAuditOpen(true);
};
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build --workspace=frontend
```

Expected: PASS.

## Task 3: Route Audit Dialog And Demo Dialog Copy

**Files:**
- Modify: `frontend/src/pages/PublicLaunchPage.tsx`

- [ ] **Step 1: Add `RouteAuditDialog` component**

Add:

```tsx
function RouteAuditDialog({
  open,
  defaults,
  onClose,
}: {
  open: boolean;
  defaults: AuditInputs;
  onClose: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Get a Trovan routing audit
        <IconButton aria-label="Close routing audit form" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 3 }}>
        {submitted ? (
          <Alert severity="success" sx={{ my: 1 }}>
            Routing audit request captured locally for this rollout. The next implementation pass can connect this form to CRM, email, or calendar booking.
          </Alert>
        ) : (
          <Stack
            key={`${defaults.fleetSize}-${defaults.dailyStops}-${defaults.pain}`}
            component="form"
            spacing={2}
            onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}
          >
            <Typography color="text.secondary">
              Share your route volume and workflow pain. We will frame the audit around planning time, dispatch handoffs, driver execution, and customer updates.
            </Typography>
            <TextField label="Work email" type="email" required fullWidth />
            <TextField label="Company" required fullWidth />
            <TextField label="Fleet size" select required defaultValue={defaults.fleetSize}>
              {fleetSizeOptions.map((option) => (
                <MenuItem key={option.label} value={option.label}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="Daily stops" select required defaultValue={defaults.dailyStops}>
              {dailyStopOptions.map((option) => (
                <MenuItem key={option.label} value={option.label}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="Biggest routing pain" select required defaultValue={defaults.pain}>
              {painOptions.map((option) => (
                <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="Current planning method" placeholder="Spreadsheet, Google Maps, legacy route tool, driver texts..." fullWidth />
            <TextField label="What should we inspect first?" multiline minRows={3} fullWidth />
            <Button type="submit" variant="contained" size="large" startIcon={<RouteRoundedIcon />}>
              Request route audit
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Reset success state on dialog reopen**

Inside `RouteAuditDialog`, add this effect:

```ts
useEffect(() => {
  if (open) {
    setSubmitted(false);
  }
}, [open]);
```

Update the page import from `react` to include `useEffect` if it does not already.

- [ ] **Step 3: Update existing `DemoDialog` copy**

Change the title to:

```tsx
Book a Trovan demo
```

Change the intro copy to:

```tsx
Tell us what your dispatch day looks like. We will show the product path for route planning, dispatch, driver execution, and customer tracking.
```

Change the submit button to:

```tsx
Request demo
```

- [ ] **Step 4: Render `RouteAuditDialog`**

At the bottom of `PublicLaunchPage`, before `DemoDialog`, add:

```tsx
<RouteAuditDialog open={auditOpen} defaults={auditDefaults} onClose={() => setAuditOpen(false)} />
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build --workspace=frontend
```

Expected: PASS.

## Task 4: Problem Outcomes, Product Proof Tabs, Route Audit Offer, Pricing, Trust, Final CTA

**Files:**
- Modify: `frontend/src/pages/PublicLaunchPage.tsx`

- [ ] **Step 1: Replace `flowSteps` with `problemOutcomes`**

Add:

```ts
const problemOutcomes = [
  {
    icon: RouteRoundedIcon,
    pain: 'Manual route planning',
    outcome: 'Balanced route plans',
    body: 'Build route drafts around capacity, service windows, and delivery density before the day starts.',
  },
  {
    icon: TimelineRoundedIcon,
    pain: 'Dispatcher guesswork',
    outcome: 'Live dispatch board',
    body: 'See route status, exceptions, and assignments without rebuilding the day from text threads.',
  },
  {
    icon: LocalShippingRoundedIcon,
    pain: 'Driver text threads',
    outcome: 'Mobile execution flow',
    body: 'Give drivers a clear stop-by-stop workspace for arrival, proof, notes, and route completion.',
  },
  {
    icon: CheckRoundedIcon,
    pain: 'Customer ETA calls',
    outcome: 'Tracking and proof links',
    body: 'Keep customers informed with tracking links and delivery proof attached to the route run.',
  },
];
```

- [ ] **Step 2: Replace product screen data with tab data**

Add:

```ts
const productTabs = [
  {
    key: 'plan',
    label: 'Plan',
    title: 'Plan routes before they become dispatch problems',
    src: '/marketing/routing-workspace.png',
    href: '/routing',
    capabilities: ['Objective controls for balanced route drafts', 'Map-first route inspection', 'Capacity and unassigned-job visibility'],
  },
  {
    key: 'dispatch',
    label: 'Dispatch',
    title: 'Keep route execution visible after publish',
    src: '/marketing/dispatch-board.png',
    href: '/dispatch',
    capabilities: ['Route lanes and exception context', 'Driver assignment visibility', 'Dispatch-ready operational board'],
  },
  {
    key: 'drive',
    label: 'Drive',
    title: 'Give drivers a focused mobile route flow',
    src: '/marketing/driver-workspace.png',
    href: '/driver',
    capabilities: ['Arrive, proof, depart execution', 'Stop notes and route progress', 'Driver-only workspace path'],
  },
  {
    key: 'track',
    label: 'Track',
    title: 'Reduce customer where-is-it calls',
    href: '/track/demo-token',
    capabilities: ['Public tracking path', 'Delivery status timeline', 'Proof-ready customer updates'],
  },
];
```

- [ ] **Step 3: Create `ProductProofTabs` component**

Add this local `ProductProofTabs` component before `PublicLaunchPage`:

```tsx
function ProductProofTabs() {
  const [activeKey, setActiveKey] = useState(productTabs[0].key);
  const activeTab = productTabs.find((tab) => tab.key === activeKey) ?? productTabs[0];

  return (
    <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.42fr 0.58fr' }, gap: 3, alignItems: 'stretch' }}>
      <Box sx={{ display: 'grid', gap: 1.2, alignContent: 'start' }} role="tablist" aria-label="Product proof">
        {productTabs.map((tab) => (
          <Button
            key={tab.key}
            role="tab"
            aria-selected={activeKey === tab.key}
            onClick={() => setActiveKey(tab.key)}
            variant={activeKey === tab.key ? 'contained' : 'outlined'}
            sx={{ justifyContent: 'space-between', minHeight: 54 }}
            endIcon={<ArrowForwardRoundedIcon />}
          >
            {tab.label}
          </Button>
        ))}
        <Box sx={{ mt: 2, p: 2, borderRadius: 1.5, bgcolor: 'background.paper', border: `1px solid ${alpha(trovanColors.utility.ink, 0.1)}` }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {activeTab.title}
          </Typography>
          <List dense sx={{ mt: 1 }}>
            {activeTab.capabilities.map((capability) => (
              <ListItem key={capability} disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckRoundedIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={capability} />
              </ListItem>
            ))}
          </List>
          <Button href={activeTab.href} variant="text" endIcon={<ArrowForwardRoundedIcon />}>
            Open screen
          </Button>
        </Box>
      </Box>
      <Box sx={{ borderRadius: 1.8, bgcolor: alpha(trovanColors.utility.ink, 0.04), border: `1px solid ${alpha(trovanColors.utility.ink, 0.1)}`, overflow: 'hidden', minHeight: { xs: 360, md: 520 } }}>
        {activeTab.src ? (
          <Box component="img" src={activeTab.src} alt={`${activeTab.label} product screenshot`} sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left' }} />
        ) : (
          <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', display: 'grid', alignContent: 'center', bgcolor: '#f7f0e3' }}>
            <Box sx={{ mx: 'auto', width: 'min(100%, 420px)', borderRadius: 2, bgcolor: '#fffaf0', boxShadow: '0 24px 70px rgba(47, 38, 28, 0.18)', overflow: 'hidden', border: `1px solid ${alpha(trovanColors.brand.cocoa, 0.14)}` }}>
              <Box sx={{ p: 2, bgcolor: trovanColors.brand.cocoa, color: '#fff8ed' }}>
                <Typography sx={{ fontWeight: 900 }}>Delivery tracking</Typography>
                <Typography sx={{ color: alpha('#fff8ed', 0.72), fontSize: 13 }}>Order TRV-1048</Typography>
              </Box>
              <Stack spacing={1.5} sx={{ p: 2 }}>
                {['Route published', 'Driver en route', 'Arriving next', 'Proof ready'].map((event, index) => (
                  <Box key={event} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: index < 3 ? trovanColors.brand.sage : alpha(trovanColors.brand.cocoa, 0.2) }} />
                    <Typography sx={{ fontWeight: 800 }}>{event}</Typography>
                  </Box>
                ))}
                <Alert severity="success">ETA window: 2:10-2:35 PM</Alert>
              </Stack>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Replace the product tour section**

Change the section id from `product-tour` to `product`.

Use heading:

```tsx
Real product flow from plan to proof
```

Use body:

```tsx
The audit points into the actual Trovan workspace: planning, dispatch, driver execution, and customer tracking.
```

Replace the four cards and three screenshot cards with:

```tsx
<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
  {problemOutcomes.map((item) => (
    <Box key={item.pain} sx={{ p: 2, borderRadius: 1.5, bgcolor: 'background.paper', border: `1px solid ${alpha(trovanColors.utility.ink, 0.1)}` }}>
      <item.icon sx={{ color: trovanColors.brand.sage }} />
      <Typography sx={{ mt: 1.5, color: 'text.secondary', fontSize: 13, fontWeight: 800 }}>
        {item.pain}
      </Typography>
      <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 900 }}>
        {item.outcome}
      </Typography>
      <Typography sx={{ mt: 1, color: 'text.secondary' }}>
        {item.body}
      </Typography>
    </Box>
  ))}
</Box>
<ProductProofTabs />
```

- [ ] **Step 5: Add `AuditOfferSection`**

Add an array:

```ts
const auditDeliverables = [
  ['Workflow review', 'How jobs become route plans today.'],
  ['Dispatch friction map', 'Where updates and exceptions get stuck.'],
  ['Driver execution check', 'How drivers receive, complete, and prove work.'],
  ['Customer visibility gap', 'Where ETA and proof communication breaks down.'],
  ['Implementation plan', 'What Trovan would need to connect first.'],
];
```

Render a new section with id `route-audit`, heading `What you get in a Trovan route audit`, the five deliverables, and a CTA `Start my route audit` wired to `openAuditDialog`.

- [ ] **Step 6: Update pricing cards**

Keep three plans but update CTA labels:

- Starter: `Get Starter audit`
- Growth: `Talk through Growth`
- Operations: `Plan implementation`

All pricing CTAs should call `openAuditDialog()`. Do not route any pricing CTA to the demo dialog in this pass.

- [ ] **Step 7: Update implementation trust section**

Change id from `security` to `implementation`.

Heading:

```tsx
A rollout path operators can trust
```

Items:

- `Domain and hosting`
- `Auth and user roles`
- `Billing path`
- `Email, SMS, and customer updates`
- `Routing-service verification`
- `Security and tenant controls`

Use copy from the spec and avoid exposing internal blockers as scary gaps.

- [ ] **Step 8: Add final CTA section**

Add final dark section after implementation:

```tsx
<Typography variant="h2">Bring tomorrow&apos;s routes into one workspace</Typography>
<Button onClick={() => openAuditDialog()} variant="contained">Get a routing audit</Button>
<Button onClick={() => setDemoOpen(true)} variant="outlined">Book a demo</Button>
<Button href="/track/demo-token" variant="text">View customer tracking</Button>
```

- [ ] **Step 9: Run build**

Run:

```bash
npm run build --workspace=frontend
```

Expected: PASS.

## Task 5: SEO Metadata And SPA Fallback

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/public/_redirects`

- [ ] **Step 1: Inspect metadata**

Run:

```bash
sed -n '1,120p' frontend/index.html
```

- [ ] **Step 2: Update title and description**

Ensure `frontend/index.html` includes:

```html
<title>Trovan | Last-mile route planning and dispatch</title>
<meta
  name="description"
  content="Find wasted miles, dispatch routes, guide drivers, and keep customers updated from one last-mile delivery workspace."
/>
```

- [ ] **Step 3: Expand `_redirects` if missing routes**

Ensure `frontend/public/_redirects` contains:

```text
/dashboard /index.html 200
/dashboard/* /index.html 200
/jobs /index.html 200
/jobs/* /index.html 200
/routing /index.html 200
/routing/* /index.html 200
/dispatch /index.html 200
/dispatch/* /index.html 200
/driver /index.html 200
/driver/* /index.html 200
/track/* /index.html 200
/login /index.html 200
/auth/callback /index.html 200
```

- [ ] **Step 4: Run build and confirm `_redirects` copies**

Run:

```bash
npm run build --workspace=frontend
test -f frontend/dist/_redirects && sed -n '1,80p' frontend/dist/_redirects
```

Expected: PASS and the redirect rules are present.

## Task 6: Playwright Launch Audit Updates

**Files:**
- Modify: `e2e/launch-audit.spec.ts`

- [ ] **Step 1: Add public launch workflow test**

Add a test near the existing public launch tests:

```ts
test('public launch route audit flow is interactive', async ({ page }) => {
  await gotoReady(page, '/');

  await expect(page.getByRole('heading', { name: /Find the wasted miles/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Get a routing audit/i }).first()).toBeVisible();
  await expect(page.getByLabel(/Route audit preview/i)).toBeVisible();

  await page.getByRole('button', { name: '36-75' }).click();
  await page.getByRole('button', { name: '250' }).click();
  await page.getByLabel(/Biggest routing pain/i).click();
  await page.getByRole('option', { name: /Customer ETAs/i }).click();

  await expect(page.getByText(/Customer update gaps/i)).toBeVisible();
  await expect(page.getByText(/High/i)).toBeVisible();

  await page.getByRole('button', { name: /Build my audit/i }).click();
  await expect(page.getByRole('dialog', { name: /Get a Trovan routing audit/i })).toBeVisible();
  await page.getByLabel(/Work email/i).fill('ops@example.com');
  await page.getByLabel(/Company/i).fill('Example Delivery');
  await page.getByLabel(/Current planning method/i).fill('Spreadsheet and map tabs');
  await page.getByRole('button', { name: /Request route audit/i }).click();
  await expect(page.getByText(/Routing audit request captured locally/i)).toBeVisible();
});
```

- [ ] **Step 2: Add product tab test**

Add:

```ts
test('public launch product proof tabs change content', async ({ page }) => {
  await gotoReady(page, '/');

  await page.getByRole('tab', { name: 'Dispatch' }).click();
  await expect(page.getByText(/Keep route execution visible/i)).toBeVisible();

  await page.getByRole('tab', { name: 'Drive' }).click();
  await expect(page.getByText(/focused mobile route flow/i)).toBeVisible();

  await page.getByRole('tab', { name: 'Track' }).click();
  await expect(page.getByText(/Reduce customer where-is-it calls/i)).toBeVisible();
});
```

- [ ] **Step 3: Run focused Playwright spec locally**

Start the preview server if needed:

```bash
npm run build --workspace=frontend
npm run preview --workspace=frontend -- --host 127.0.0.1 --port 5199
```

In another shell run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5199 npx playwright test e2e/launch-audit.spec.ts --project=chromium --grep "public launch"
```

Expected: PASS.

## Task 7: Visual And Responsive Verification

**Files:**
- Modify only files required to fix issues found during verification.

- [ ] **Step 1: Run production build**

Run:

```bash
npm run build --workspace=frontend
```

Expected: PASS.

- [ ] **Step 2: Start preview**

Run:

```bash
npm run preview --workspace=frontend -- --host 127.0.0.1 --port 5199
```

Expected: Vite preview serves at `http://127.0.0.1:5199/`.

- [ ] **Step 3: Capture desktop and mobile screenshots with Playwright**

Run:

```bash
node - <<'NODE'
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 960 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `.tmp/launch-audit/${viewport.name}-route-audit-site.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error(`${viewport.name} has horizontal overflow`);
    await page.close();
  }
  await browser.close();
})();
NODE
```

Expected: screenshots are written and no overflow error occurs.

- [ ] **Step 4: Inspect screenshots**

Use the app image viewer or `view_image` on:

- `.tmp/launch-audit/desktop-route-audit-site.png`
- `.tmp/launch-audit/mobile-route-audit-site.png`

Fix any visible overlap, clipped CTA, unreadable screenshot framing, weak first viewport, or mobile overflow.

## Task 8: Hosted Deploy And Smoke

**Files:**
- No source changes expected unless deploy smoke finds an issue.

- [ ] **Step 1: Build deploy ZIP**

Run:

```bash
npm run build --workspace=frontend
rm -f /tmp/trovan-frontend-dist.zip
(cd frontend/dist && zip -qr /tmp/trovan-frontend-dist.zip .)
ls -lh /tmp/trovan-frontend-dist.zip
```

- [ ] **Step 2: Deploy to Cloudflare**

Preferred:

```bash
npx wrangler login
npx wrangler deploy
```

If the repo does not yet have a Worker config, use the Cloudflare dashboard upload flow for static assets and upload `/tmp/trovan-frontend-dist.zip`.

- [ ] **Step 3: Hosted smoke**

Run:

```bash
curl -I --max-time 20 https://trytrovan.com/
curl -I --max-time 20 https://www.trytrovan.com/
curl -I --max-time 20 https://trytrovan.com/routing
curl -I --max-time 20 https://trytrovan.com/dashboard
```

Expected:

- Apex and `www` return `200`.
- Direct app routes return `200` SPA shell or an intentional redirect, not Cloudflare 1033 and not Worker static 404.

- [ ] **Step 4: Run final memory update**

Run:

```bash
/Users/logan/Desktop/CodexBrain/scripts/codex_auto_memory.sh "$(pwd)"
```

Expected: `Automatic memory updated.`

## Self-Review

Spec coverage:

- Header, hero, audit preview, problem/outcome band, product proof tabs, route audit offer, pricing, implementation trust, final CTA, dialogs, product links, metadata, SPA fallback, accessibility, and verification are covered.

Placeholder scan:

- No `TBD`, `TODO`, or vague "add tests" steps remain. Each testing task includes concrete Playwright code or shell commands.

Type consistency:

- `AuditInputs`, `FleetSizeKey`, `DailyStopsKey`, and `PainKey` are defined before use.
- Dialog defaults use the same option keys as the preview.
- CTA names match the approved spec.
