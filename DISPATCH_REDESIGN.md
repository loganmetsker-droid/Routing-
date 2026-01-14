# Dispatch UI/UX Redesign - Real-World Workflow

## Problem Summary
Current UI violates real dispatch workflow:
- Shows drivers first (wrong - vehicles come first)
- Unclear job-to-route mapping
- Optimization happens too late
- Driver assignment UI suggests manual work instead of system automation

---

## 1. Corrected UI Layout

### Single-Screen 4-Column Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DISPATCH CONTROL CENTER                           [Filters] [Refresh]   │
├─────────────────────────────────────────────────────────────────────────┤
│ CONFLICTS ALERT (if any)                                                │
│ • Driver X assigned to 2 routes                                         │
│ • Vehicle Y at capacity                                                 │
├────────────┬───────────────────┬──────────────────┬─────────────────────┤
│ UNASSIGNED │ VEHICLES & ROUTES │ READY TO DISPATCH│ LIVE STATUS         │
│ JOBS       │ (In Progress)     │                  │                     │
│            │                   │                  │                     │
│ [Select All│ ┌─ Vehicle 1 ───┐ │ ┌─ Route A ────┐│ Available Drivers:  │
│  5 jobs]   │ │ Capacity: 80% │ │ │ Vehicle: V1  ││ • John (0 routes)   │
│            │ │ Jobs: 3       │ │ │ Driver: John ││ • Mary (0 routes)   │
│ ☐ Job 1    │ │ Est: 45mi/2h  │ │ │ Jobs: 3      ││ • Bob (1 route)     │
│   Priority │ │               │ │ │ 45mi / 2h    ││                     │
│   Delivery │ │ Jobs:         │ │ │              ││ Vehicle Status:     │
│            │ │ • Job 4       │ │ │ [DISPATCH]   ││ • V1: Assigned      │
│ ☐ Job 2    │ │ • Job 5       │ │ └──────────────┘│ • V2: Available     │
│   ...      │ │ • Job 6       │ │                  │ • V3: In Transit    │
│            │ │               │ │ ┌─ Route B ────┐│                     │
│            │ │ [Optimize]    │ │ │ ...          ││                     │
│            │ │ [Assign Drvr] │ │ └──────────────┘│                     │
│[Auto-Assign│ └───────────────┘ │                  │                     │
│ Selected]  │                   │                  │                     │
│            │ ┌─ Vehicle 2 ───┐ │                  │                     │
│            │ │ Available     │ │                  │                     │
│            │ │ Capacity: 0%  │ │                  │                     │
│            │ │               │ │                  │                     │
│            │ │ [Drop here]   │ │                  │                     │
│            │ └───────────────┘ │                  │                     │
└────────────┴───────────────────┴──────────────────┴─────────────────────┘
```

**Key Changes from Current:**
1. **Column 1** (Unassigned Jobs) - Same, but clearer labeling
2. **Column 2** (Vehicles & Routes) - NEW: Vehicle-centric, shows capacity/jobs/estimates inline
3. **Column 3** (Ready to Dispatch) - Same concept, clearer display
4. **Column 4** (Live Status) - NEW: Replaces "Driver Workload Summary" at top, compact sidebar

---

## 2. Corrected Component Hierarchy

```
<DispatchUnified>
  ├─ <Header>
  │    └─ [Filters] [Refresh]
  │
  ├─ <ConflictsAlert>
  │    └─ List of conflicts (if any)
  │
  ├─ <DispatchWorkspace>
  │    │
  │    ├─ <UnassignedJobsColumn>
  │    │    ├─ [Select All checkbox]
  │    │    ├─ <JobCard> (map unassigned)
  │    │    └─ [Auto-Assign Selected button]
  │    │
  │    ├─ <VehiclesRoutesColumn>
  │    │    └─ <VehicleRouteCard> (map vehicles)
  │    │         ├─ Vehicle info (capacity, make/model)
  │    │         ├─ Route metrics (miles, time, job count)
  │    │         ├─ <JobList> (inline, collapsible)
  │    │         ├─ Assigned driver (if any)
  │    │         └─ Actions: [Optimize] [Assign Driver] [Remove Driver]
  │    │
  │    ├─ <ReadyToDispatchColumn>
  │    │    └─ <DispatchableRouteCard> (map ready routes)
  │    │         ├─ Vehicle + Driver pairing
  │    │         ├─ Job count, miles, time
  │    │         └─ [DISPATCH button]
  │    │
  │    └─ <LiveStatusColumn>
  │         ├─ <DriverStatusList> (compact)
  │         └─ <VehicleStatusList> (compact)
  │
  └─ <Dialogs>
       ├─ <AssignDriverDialog>
       └─ <FiltersDialog>
```

---

## 3. Updated State Model

### Job
```typescript
interface Job {
  id: string;
  customerName: string;
  deliveryAddress: string;
  pickupAddress?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'optimized' | 'dispatched' | 'in_progress' | 'completed';
  assignedRouteId?: string;
  assignedVehicleId?: string;  // NEW
  stopSequence?: number;        // NEW: Position in optimized route
}
```

### Vehicle
```typescript
interface Vehicle {
  id: string;
  make: string;
  model: string;
  licensePlate: string;
  status: 'available' | 'assigned' | 'in_transit' | 'maintenance';
  capacity: number;              // Max weight/volume
  currentLoad: number;           // Current utilization
  assignedRouteId?: string;
}
```

### Route
```typescript
interface Route {
  id: string;
  vehicleId: string;             // REQUIRED (assigned on creation)
  driverId?: string;             // OPTIONAL until dispatcher assigns
  status: 'building' | 'optimized' | 'ready' | 'dispatched' | 'in_progress' | 'completed';

  // Job assignments
  jobIds: string[];
  optimizedStops?: OptimizedStop[];  // NEW: After optimization

  // Metrics (calculated after optimization)
  totalDistance?: number;
  totalDuration?: number;
  estimatedCapacity?: number;

  // Timestamps
  createdAt: string;
  optimizedAt?: string;
  dispatchedAt?: string;
}

interface OptimizedStop {
  jobId: string;
  sequence: number;
  address: string;
  estimatedArrival?: string;
  distanceFromPrevious?: number;
}
```

### Driver
```typescript
interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  status: 'available' | 'assigned' | 'on_route' | 'off_duty';
  currentHours: number;
  maxHours: number;
  assignedRouteIds: string[];    // NEW: Can handle multiple routes (but not recommended)
  workloadScore: number;         // NEW: For auto-assignment balancing
}
```

---

## 4. Updated Dispatch Workflow Logic

### Phase 1: Job Creation
```typescript
// User creates jobs via Jobs page
const newJob = {
  id: generateId(),
  status: 'pending',
  assignedRouteId: null,
  assignedVehicleId: null,
  stopSequence: null
};
```

### Phase 2: Vehicle Assignment + Optimization
```typescript
// User drags jobs onto vehicle OR clicks "Auto-Assign Selected"
async function assignJobsToVehicle(jobIds: string[], vehicleId: string) {
  // 1. Create or update route for this vehicle
  const route = await createOrGetRoute(vehicleId);

  // 2. Add jobs to route
  route.jobIds.push(...jobIds);
  route.status = 'building';

  // 3. Update jobs
  jobs.forEach(job => {
    job.assignedRouteId = route.id;
    job.assignedVehicleId = vehicleId;
    job.status = 'assigned';
  });

  // 4. IMMEDIATELY TRIGGER OPTIMIZATION
  await optimizeRoute(route.id);
}

async function optimizeRoute(routeId: string) {
  const route = routes.find(r => r.id === routeId);

  // Call backend optimization API
  const optimized = await api.optimizeRoute({
    vehicleId: route.vehicleId,
    jobIds: route.jobIds
  });

  // Update route with optimization results
  route.optimizedStops = optimized.stops;
  route.totalDistance = optimized.distance;
  route.totalDuration = optimized.duration;
  route.estimatedCapacity = optimized.capacity;
  route.status = 'optimized';
  route.optimizedAt = new Date().toISOString();

  // Update job stop sequences
  optimized.stops.forEach((stop, idx) => {
    const job = jobs.find(j => j.id === stop.jobId);
    if (job) job.stopSequence = idx;
  });
}
```

### Phase 3: Driver Auto-Assignment
```typescript
// System automatically assigns drivers when route is optimized
// OR dispatcher manually assigns via "Assign Driver" button

async function autoAssignDrivers() {
  const optimizedRoutes = routes.filter(r => r.status === 'optimized' && !r.driverId);
  const availableDrivers = drivers
    .filter(d => d.status === 'available')
    .sort((a, b) => a.workloadScore - b.workloadScore);  // Least busy first

  // Even distribution
  for (let i = 0; i < optimizedRoutes.length; i++) {
    if (availableDrivers[i]) {
      await assignDriverToRoute(optimizedRoutes[i].id, availableDrivers[i].id);
    }
  }
}

async function assignDriverToRoute(routeId: string, driverId: string) {
  const route = routes.find(r => r.id === routeId);
  const driver = drivers.find(d => d.id === driverId);

  // Assign
  route.driverId = driverId;
  route.status = 'ready';  // Now ready to dispatch

  driver.assignedRouteIds.push(routeId);
  driver.status = 'assigned';
  driver.workloadScore += route.jobIds.length;
}
```

### Phase 4: Dispatch
```typescript
async function dispatchRoute(routeId: string) {
  const route = routes.find(r => r.id === routeId);

  // Validation
  if (!route.driverId) throw new Error('No driver assigned');
  if (!route.optimizedStops) throw new Error('Route not optimized');

  // Update statuses
  route.status = 'dispatched';
  route.dispatchedAt = new Date().toISOString();

  const driver = drivers.find(d => d.id === route.driverId);
  driver.status = 'on_route';

  const vehicle = vehicles.find(v => v.id === route.vehicleId);
  vehicle.status = 'in_transit';

  // Update jobs
  route.jobIds.forEach(jobId => {
    const job = jobs.find(j => j.id === jobId);
    if (job) job.status = 'dispatched';
  });

  await api.dispatchRoute(routeId);
}
```

---

## 5. Event Triggers

### When Optimization Runs
1. **After job(s) added to vehicle** → `optimizeRoute(routeId)` (automatic)
2. **User clicks [Optimize] button** → `optimizeRoute(routeId)` (manual re-optimization)
3. **Job removed from route** → `optimizeRoute(routeId)` (automatic re-optimization)

### When Driver Assignment Runs
1. **Route status changes to 'optimized'** → `autoAssignDrivers()` (automatic, system-wide)
2. **User clicks [Assign Driver]** → Open dialog → `assignDriverToRoute()` (manual override)
3. **User clicks [Remove Driver]** → `unassignDriver()` → Mark route as 'optimized' again

### When Data Refreshes
1. **SSE event received** → `loadData()` (real-time updates)
2. **User clicks [Refresh]** → `loadData()` (manual refresh)
3. **After any mutation** → `loadData()` (ensure UI in sync)

---

## 6. Key UX Improvements

### Clarity Fixes
1. **Vehicle cards show capacity** → `80% (3/10 jobs)` or `1,200 lbs / 1,500 lbs`
2. **Job list inline with vehicle** → Expand/collapse to see which jobs are on this route
3. **Optimization metrics visible** → `45 mi / 2h 15min` shown immediately after optimization
4. **Driver assignment happens AFTER routing** → UI reflects this with "Assign Driver" button only appearing after optimization

### Interaction Improvements
1. **Drag jobs onto vehicles** → Immediate visual feedback + auto-optimization
2. **Bulk assign** → Select multiple jobs, click "Auto-Assign Selected" → System picks best vehicle(s)
3. **Manual override** → [Assign Driver] button opens dialog with suggested drivers sorted by workload
4. **Dispatch validation** → [DISPATCH] button only enabled when route is ready (vehicle + driver + optimized)

### Status Indicators
```
Job:     pending → assigned → optimized → dispatched → in_progress → completed
Route:   building → optimized → ready → dispatched → in_progress → completed
Vehicle: available → assigned → in_transit → maintenance
Driver:  available → assigned → on_route → off_duty
```

---

## 7. Implementation Checklist

### Backend Changes Required
- [ ] Add `assignedVehicleId` field to Job entity
- [ ] Add `stopSequence` field to Job entity
- [ ] Add `optimizedStops` field to Route entity
- [ ] Add `workloadScore` field to Driver entity
- [ ] Update route optimization API to accept `vehicleId` + `jobIds`
- [ ] Create auto-assign-drivers endpoint
- [ ] Update dispatch validation to check all requirements

### Frontend Changes Required
- [ ] Redesign `DispatchUnified.tsx` with 4-column layout
- [ ] Create `VehicleRouteCard` component (replaces current route card)
- [ ] Add inline job list to vehicle cards (collapsible)
- [ ] Move driver workload to compact sidebar
- [ ] Update drag-and-drop to target vehicles (not drivers)
- [ ] Trigger optimization immediately after jobs assigned
- [ ] Add "Assign Driver" button to optimized routes
- [ ] Update state model for new fields
- [ ] Update status flow logic

### Testing Required
- [ ] Test drag job onto vehicle → auto-optimization
- [ ] Test bulk assign → system picks vehicles + optimizes
- [ ] Test manual driver assignment after optimization
- [ ] Test dispatch validation (must have vehicle + driver + optimization)
- [ ] Test conflict detection (same driver on 2 routes)
- [ ] Test capacity limits (vehicle at max)
- [ ] Test driver workload balancing
- [ ] Test real-time updates via SSE

---

## 8. Wireframe (ASCII)

### Vehicle & Routes Column (Core Change)

```
┌─────────────────────────────────────┐
│ VEHICLES & ROUTES (In Progress)    │
├─────────────────────────────────────┤
│                                     │
│ ┌─ VEHICLE: Truck 1 (ABC-123) ────┐│
│ │ Status: Assigned                ││
│ │ Capacity: ████████░░ 80%        ││
│ │                                 ││
│ │ Route ID: rt-x7k9               ││
│ │ Jobs: 3  |  45 mi  |  2h 15m    ││
│ │ Driver: John Doe                ││
│ │                                 ││
│ │ Jobs (click to expand):         ││
│ │ ▼ 1. Job #1 - Customer A        ││
│ │   2. Job #2 - Customer B        ││
│ │   3. Job #3 - Customer C        ││
│ │                                 ││
│ │ [Optimize] [Change Driver]      ││
│ └─────────────────────────────────┘│
│                                     │
│ ┌─ VEHICLE: Van 1 (XYZ-456) ─────┐│
│ │ Status: Assigned                ││
│ │ Capacity: ████░░░░░░ 40%        ││
│ │                                 ││
│ │ Route ID: rt-a2b5               ││
│ │ Jobs: 2  |  28 mi  |  1h 30m    ││
│ │ Driver: ⚠️ Not Assigned         ││
│ │                                 ││
│ │ Jobs (click to expand):         ││
│ │ ▶ 1. Job #4 - Customer D        ││
│ │   2. Job #5 - Customer E        ││
│ │                                 ││
│ │ [Optimize] [Assign Driver]      ││
│ └─────────────────────────────────┘│
│                                     │
│ ┌─ VEHICLE: Truck 2 (DEF-789) ────┐│
│ │ Status: Available               ││
│ │ Capacity: ░░░░░░░░░░ 0%         ││
│ │                                 ││
│ │ No jobs assigned                ││
│ │                                 ││
│ │ [Drop jobs here to assign]      ││
│ └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

**Key Visual Cues:**
- **Capacity bar** → Immediate feedback on vehicle utilization
- **Metrics inline** → Miles, time, job count shown prominently
- **Expandable job list** → See which jobs are on this route
- **Status-aware buttons** → "Assign Driver" only shows after optimization
- **Empty vehicle** → Clear drop zone for unassigned jobs

---

## Summary

**Core Philosophy Change:**
- **OLD**: Driver-centric, manual assignment, optimization as afterthought
- **NEW**: Vehicle-centric, auto-optimization, driver assignment after routing

**Workflow Enforcement:**
1. Jobs → Vehicles (drag or auto-assign)
2. System optimizes immediately
3. System suggests/assigns driver
4. Dispatcher reviews and dispatches

**Visual Hierarchy:**
1. Unassigned jobs (left)
2. Vehicles with assigned routes (center) ← MAIN FOCUS
3. Ready-to-dispatch routes (right)
4. Live status sidebar (far right)

This design matches real-world dispatching: **route the vehicle first, assign the driver second**.
