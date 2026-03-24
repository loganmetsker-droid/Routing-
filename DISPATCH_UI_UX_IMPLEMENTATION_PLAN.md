# Dispatch UI/UX Implementation Plan

## Purpose
- Create a dispatcher workflow that is linear when planning work and dense when executing work.
- Reduce handoff friction between Jobs, Dispatch, and Tracking.
- Replace the current purple-heavy visual language with a more operational, transport-oriented design system.

## Current UX Review

### What is already working
- The app is mostly consolidated onto a smaller set of active screens.
- The dispatch page already attempts to show jobs, routes, and live status in one place.
- The jobs page supports bulk actions and the customer flow supports structured addresses.

### Workflow friction found in the current app
1. Jobs selection does not carry into Dispatch.
   - `JobsPageEnhancedV2` sends users to `/dispatch`, but it does not pass the selected job ids.
   - Result: the user has to re-select work after navigating.

2. Dispatch planning and live operations are mixed into one screen.
   - The current dispatch board is trying to be planner, route editor, driver assigner, and live command center at once.
   - Result: the screen is visually heavy and the user has to mentally switch modes.

3. Driver assignment still happens after route creation in the current active flow.
   - Current behavior in `DispatchUnifiedV2` creates the route first, then asks for driver assignment later.
   - Result: the actual flow does not match the intended "assign resources before final dispatch" model.

4. There is no strong handoff between planning and execution.
   - A planner should finish with a route in a "Ready to Dispatch" lane.
   - An operator should then start the route with confidence that vehicle, driver, stops, and warnings are resolved.

5. Map trust is weak.
   - The dispatch map currently uses mock/randomized positions when route coordinates are missing.
   - Result: the map feels decorative instead of operational.

6. Visual hierarchy is inconsistent.
   - Some screens follow the global theme; some active screens hardcode dark colors.
   - Result: the product feels stitched together instead of designed as one system.

7. Several actions do not clearly communicate the next step.
   - Example: "Open Dispatch Board" does not indicate whether it is carrying jobs forward.
   - Example: the conflict area reads as important, but does not yet create a resolution flow.

## Recommended Workflow Structure

### Split the product into two operating modes

#### Mode 1: Planning
- Entry point: Jobs
- Goal: turn unassigned jobs into validated, ready-to-dispatch routes
- Main actions:
  - Select jobs
  - Confirm or edit delivery data
  - Choose vehicles
  - Assign drivers
  - Optimize route order
  - Review warnings
  - Move routes to Ready

#### Mode 2: Execution
- Entry point: Dispatch
- Goal: dispatch, monitor, and complete active routes
- Main actions:
  - Review ready routes
  - Start route
  - Monitor delays/conflicts
  - Complete or cancel route
  - Move route into historical/completed state

## Recommended Primary Workflow

### Step 1: Jobs Inbox
- Show only actionable jobs by default:
  - Unassigned
  - Assigned but not started
  - Exception
- Let users multi-select jobs and launch a planner tray.
- Persist selected job ids into route planning state.

### Step 2: Planning Drawer / Planner Screen
- Section A: Selected Jobs
- Section B: Vehicle Pool
- Section C: Driver Assignment
- Section D: Route Preview
- Section E: Validation

Required validations before "Create Ready Route":
- Every selected route has a vehicle
- Every vehicle has a driver
- No duplicate driver or vehicle assignment
- No invalid address payloads
- Jobs are still in a dispatchable status

### Step 3: Ready to Dispatch Lane
- Show route card summary:
  - Driver
  - Vehicle
  - Job count
  - ETA window
  - Warning count
  - Last optimized time
- CTA:
  - Dispatch now
  - Edit route
  - Re-optimize

### Step 4: Active Dispatch Board
- Focus only on routes that are:
  - ready
  - in progress
  - blocked
- Split screen:
  - Left: active routes queue
  - Center: operational map
  - Right: live status, alerts, route health

### Step 5: Completion and Archive
- Completed routes and jobs leave the active workflow automatically.
- Historical review moves to tracking/history, not the main operational surface.

## Screen-Level Recommendations

### Jobs Page
- Keep it as the operational inbox.
- Replace "Open Dispatch Board" with:
  - "Plan Route"
  - Label should include selected count, for example: `Plan Route (6)`
- Add a sticky bottom action bar on desktop and mobile.
- Show a compact route-planning summary before navigating.

### Dispatch Page
- Reframe it as an execution board, not the first place users construct routes.
- Keep the 3-column structure, but tighten the purpose:
  - Unassigned work should only show jobs sent from the planner or flagged exceptions
  - Vehicle column should be "Ready / Active Routes"
  - Live status should be alerts, staffing, and vehicle health

### Customers Page
- Good candidate for low-friction data entry.
- Keep structured address input, but visually distinguish:
  - saved default address
  - delivery exceptions
  - special notes

### Tracking Page
- Position it as historical and live follow-through, not part of route creation.
- Add route confidence indicators:
  - on time
  - at risk
  - delayed

## Implementation Phases

### Phase 1: Workflow Smoothing
- Pass selected job ids from Jobs into Dispatch planning state.
- Separate planning state from active route monitoring state.
- Standardize route lifecycle labels:
  - draft
  - ready
  - in_progress
  - completed
  - cancelled
- Remove dead-end controls or convert them into real actions.

### Phase 2: Information Architecture
- Make Jobs the default planning inbox.
- Make Dispatch the active route board.
- Keep Tracking for follow-through and completed route review.
- Remove lingering UI paths that imply duplicate route creation flows.

### Phase 3: Visual System Refresh
- Move hardcoded page colors into shared tokens.
- Create a single operational theme used across:
  - Layout
  - Dashboard
  - Jobs
  - Dispatch
  - Tracking

### Phase 4: Trust and Clarity
- Replace mocked map behavior with clearer empty states when route geometry is unavailable.
- Add explicit exception banners:
  - missing driver
  - duplicate assignment
  - route failed optimization
  - route using fallback geometry

## Recommended Visual Direction

### Direction Name
- Signal Ops

### Why this direction
- It feels operational, credible, and fast.
- It avoids generic SaaS purple gradients.
- It supports long hours of use without looking flat or dull.

### Recommended Palette

#### Core surfaces
- Background: `#F3F1EC`
- Elevated surface: `#FBF9F4`
- Panel border: `#D8D1C5`
- Primary ink: `#1F2A2E`
- Secondary ink: `#55636B`

#### Brand / action colors
- Primary action: `#0F766E`
- Primary hover: `#115E59`
- Secondary accent: `#C96F2D`
- Secondary hover: `#A85B25`

#### Status colors
- Success: `#2F855A`
- Warning: `#D69E2E`
- Error: `#C53030`
- Info: `#2B6CB0`

#### Map / route colors
- Route A: `#0F766E`
- Route B: `#C96F2D`
- Route C: `#2B6CB0`
- Route D: `#7C5E3C`
- Route E: `#7A8F3B`

### Typography recommendation
- Use a more characterful operational stack.
- Recommended heading font:
  - `"Space Grotesk", "Inter", sans-serif`
- Recommended body font:
  - `"Inter", "Segoe UI", sans-serif`

### Component styling direction
- Rounded, but not bubbly
- Strong panel dividers
- Tactile buttons with restrained lift
- Lighter backgrounds with darker ink for day-to-day operations
- Use color mainly for action, alerting, and route identity

## Alternative Palette Options

### Option B: Rail Yard
- Background: `#ECE8E1`
- Surface: `#F8F5EF`
- Ink: `#20262B`
- Primary: `#1D4ED8`
- Accent: `#B45309`
- Good if you want a cooler, more industrial look

### Option C: Night Dispatch
- Background: `#111827`
- Surface: `#17212B`
- Ink: `#E5E7EB`
- Primary: `#14B8A6`
- Accent: `#F59E0B`
- Good if you want a dark operations room aesthetic

## Recommendation
- Use Signal Ops first.
- It gives the product a more grounded transportation identity and improves readability faster than the current indigo/pink/purple styling.

## Definition of Smooth Workflow
- A dispatcher can go from selected jobs to ready route without re-selecting data.
- Every main screen has one primary purpose.
- No critical action should need more than one confirmation unless it is destructive.
- The user should always know:
  - what state the route is in
  - what is blocking dispatch
  - what the next best action is

## Suggested Next Build Step
1. Fix current TypeScript failures first so the frontend is buildable.
2. Implement workflow handoff from Jobs to Planner.
3. Apply the Signal Ops theme tokens to Layout, Jobs, and Dispatch.
4. Refactor Dispatch into planning and execution states.
5. Clean up live map and exception handling.
