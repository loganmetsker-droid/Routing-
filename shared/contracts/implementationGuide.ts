export type ImplementationGuideStep = {
  title: string;
  click: string;
  instruction: string;
  expected: string;
  caution?: string;
};

export type ImplementationGuideSection = {
  id: string;
  programStageId: string;
  moduleKey: string;
  title: string;
  audience: string;
  goal: string;
  route: string;
  screenshot: {
    src: string;
    alt: string;
    caption: string;
  };
  steps: ImplementationGuideStep[];
  completeWhen: string;
};

export type ImplementationProgramStage = {
  id: string;
  number: number;
  title: string;
  owner: string;
  target: string;
  outcome: string;
  evidence: string;
  procedureIds: string[];
};

export type ImplementationFaq = {
  category: string;
  question: string;
  answer: string;
};

export type ImplementationTroubleshootingItem = {
  symptom: string;
  likelyCause: string;
  resolution: string[];
  escalateWhen: string;
};

export const implementationProgramStages: readonly ImplementationProgramStage[] = [
  {
    id: 'kickoff', number: 1, title: 'Kickoff and ownership', owner: 'Customer Champion', target: 'Day 1',
    outcome: 'The customer understands the implementation model, names accountable people, and can navigate the system.',
    evidence: 'Champion, pilot team, practice date, support path, and launch docket are recorded.',
    procedureIds: ['assign-champion', 'first-login-tour'],
  },
  {
    id: 'foundation', number: 2, title: 'Workspace foundation', owner: 'Champion or Admin', target: 'Day 1',
    outcome: 'The organization, timezone, depot, users, and role boundaries match the pilot operation.',
    evidence: 'Saved workspace settings and successful role-based sign-ins.',
    procedureIds: ['configure-depot', 'configure-team'],
  },
  {
    id: 'records', number: 3, title: 'Operational records', owner: 'Champion, Admin, or fleet owner', target: 'Day 2',
    outcome: 'The pilot Driver, vehicle, and customers are complete enough to support a real route.',
    evidence: 'One active Driver, one ready vehicle, and accurate pilot customer records.',
    procedureIds: ['prepare-fleet', 'create-vehicle', 'add-customers'],
  },
  {
    id: 'jobs', number: 4, title: 'Route-day data', owner: 'Dispatcher', target: 'Day 3',
    outcome: 'One representative day is imported and every routing-critical field is validated.',
    evidence: 'Saved jobs, accepted row counts, valid locations, and explained exclusions.',
    procedureIds: ['import-jobs', 'review-import'],
  },
  {
    id: 'planning', number: 5, title: 'Plan and approve the route', owner: 'Dispatcher', target: 'Day 4',
    outcome: 'The route is provider-backed, operationally feasible, reviewed, and approved for handoff.',
    evidence: 'Provider provenance, resolved blockers, explainable assignments, and a published version.',
    procedureIds: ['plan-route', 'review-adjust-route'],
  },
  {
    id: 'launch-day', number: 6, title: 'Dispatch and practice execution', owner: 'Dispatcher and pilot Driver', target: 'Days 5-6',
    outcome: 'The team rehearses the complete handoff, stop flow, proof, messaging, and exception response.',
    evidence: 'Dispatched route, Driver events, proof, message history, and a resolved practice exception.',
    procedureIds: ['dispatch-route', 'driver-start-route', 'driver-stop', 'manage-exceptions'],
  },
  {
    id: 'visibility', number: 7, title: 'Monitor, verify, and close the day', owner: 'Dispatcher, Champion, and Viewer', target: 'Day 6',
    outcome: 'Operations can explain route progress and final outcomes without reconstructing the day from texts.',
    evidence: 'Tracking state, persisted proof, resolved exceptions, and a closed route record.',
    procedureIds: ['monitor-route', 'verify-proof', 'viewer-review'],
  },
  {
    id: 'go-live', number: 8, title: 'Readiness and first 30 days', owner: 'Customer Champion', target: 'Day 7 and ongoing',
    outcome: 'The customer enters the readiness review with evidence, then owns adoption and improvement after launch.',
    evidence: 'Ready-for-review status, signoff, launch date, KPI owners, and escalation process.',
    procedureIds: ['signoff-readiness', 'review-kpis', 'support-escalation'],
  },
] as const;

export const implementationGuideSections: readonly ImplementationGuideSection[] = [
  {
    id: 'assign-champion',
    programStageId: 'kickoff',
    moduleKey: 'start-here',
    title: 'Assign the Customer Champion and open the launch plan',
    audience: 'Owner or Admin',
    goal: 'Put one accountable person in charge before data or training work begins.',
    route: '/academy',
    screenshot: {
      src: '/training/guides/academy-readiness.png',
      alt: 'Academy overview with the Launch readiness panel identified by a numbered callout.',
      caption: 'Open Academy and use the Launch readiness panel as the implementation control center.',
    },
    steps: [
      {
        title: 'Open the Academy',
        click: 'Account menu → Help & Training',
        instruction: 'Open the Academy while signed in as an Owner or Admin. The page should show the role-filtered lesson list and the Launch readiness panel.',
        expected: 'Start Here, Workspace Setup, Route Operations, and Go-Live are visible.',
      },
      {
        title: 'Select the Champion',
        click: 'Customer Champion → Select Champion',
        instruction: 'Choose the Owner or Admin who will own the seven-day schedule, data preparation, internal training, practice route, and signoff.',
        expected: 'The selected person remains visible after the page is refreshed.',
        caution: 'Do not assign a Driver or Viewer. The Champion must be able to coordinate configuration and team completion.',
      },
      {
        title: 'Download the working packet',
        click: 'Download launch docket',
        instruction: 'Save the versioned ZIP and open the roster, job-import template, practice checklist, and KPI worksheet.',
        expected: 'The ZIP downloads successfully and contains the PDF plus editable CSV worksheets.',
      },
    ],
    completeWhen: 'A named Owner/Admin Champion, pilot Dispatcher, pilot Driver, practice date, and escalation contact are recorded.',
  },
  {
    id: 'configure-team',
    programStageId: 'foundation',
    moduleKey: 'workspace-setup',
    title: 'Confirm users and least-privileged roles',
    audience: 'Champion or Admin',
    goal: 'Give each pilot participant only the access needed for their work.',
    route: '/settings',
    screenshot: {
      src: '/training/guides/settings-team.png',
      alt: 'Settings page with the Team tab identified by a numbered callout.',
      caption: 'In Settings, click Team to review invitations, membership, and roles.',
    },
    steps: [
      {
        title: 'Open team settings',
        click: 'Settings → Team',
        instruction: 'Review the people included in the pilot. Confirm the invited work email and organization membership before changing a role.',
        expected: 'The Champion, Dispatcher, and pilot Driver each appear once with the correct work identity.',
      },
      {
        title: 'Apply role boundaries',
        click: 'Role selector beside each user',
        instruction: 'Use Owner/Admin for workspace administration, Dispatcher for planning and dispatch, Driver for assigned mobile work, and Viewer for read-only visibility.',
        expected: 'Every person can reach the pages required for their track and cannot reach restricted actions.',
        caution: 'Use the least-privileged role. Do not give Admin access simply to work around an invitation or permissions problem.',
      },
      {
        title: 'Test access',
        click: 'Send or resend invitation',
        instruction: 'Have each pilot participant sign in with the invited address before the practice day.',
        expected: 'Each participant can sign in and sees the correct workspace for their role.',
      },
    ],
    completeWhen: 'The pilot team can sign in, each role is correct, and no shared accounts are used.',
  },
  {
    id: 'first-login-tour',
    programStageId: 'kickoff',
    moduleKey: 'start-here',
    title: 'Complete the first-login system tour',
    audience: 'Champion, Owner, or Admin',
    goal: 'Know where work begins, where operational status lives, and where to get help before configuring records.',
    route: '/dashboard',
    screenshot: {
      src: '/training/guides/dashboard-navigation.png',
      alt: 'Dashboard with the primary navigation and Help and Training entry identified by numbered callouts.',
      caption: 'Use the main navigation for operational work and Help & Training whenever a process is unfamiliar.',
    },
    steps: [
      {
        title: 'Confirm the active workspace',
        click: 'Account menu → organization name',
        instruction: 'Verify the signed-in work identity, active organization, and assigned role before entering customer or route data.',
        expected: 'The correct organization and role are shown and no other customer workspace is active.',
        caution: 'Stop immediately if the organization is wrong. Never place one customer’s data in another tenant.',
      },
      {
        title: 'Orient to the operating flow',
        click: 'Dashboard → Jobs → Routing → Dispatch → Tracking',
        instruction: 'Open each navigation item without changing data. Notice that Jobs holds route-day work, Routing creates a plan, Dispatch releases it, and Tracking follows execution.',
        expected: 'Each permitted page opens and the Champion can explain when the team uses it.',
      },
      {
        title: 'Find training and support',
        click: 'Account menu → Help & Training',
        instruction: 'Open Academy, then open the Written guide and Support hub links. Bookmark the guide for the pilot week.',
        expected: 'Academy, the guide index, Q&A, troubleshooting, and the support hub are reachable.',
      },
    ],
    completeWhen: 'The Champion can identify the active tenant, describe the Jobs-to-Tracking flow, and open Academy and Support without assistance.',
  },
  {
    id: 'configure-depot',
    programStageId: 'foundation',
    moduleKey: 'workspace-setup',
    title: 'Set organization, timezone, and primary depot',
    audience: 'Champion or Admin',
    goal: 'Make route dates, appointment windows, and route origins describe the same operating day.',
    route: '/settings',
    screenshot: {
      src: '/training/guides/settings-operations.png',
      alt: 'Settings page with the Operations tab identified by a numbered callout.',
      caption: 'Use the Operations tab for timezone and depot configuration.',
    },
    steps: [
      {
        title: 'Open operating settings',
        click: 'Settings → Operations',
        instruction: 'Confirm the organization timezone first, then review the depot used by the practice vehicle.',
        expected: 'Times shown in jobs, routing, dispatch, tracking, and history align with the local operating day.',
      },
      {
        title: 'Save the depot',
        click: 'Primary depot → Save',
        instruction: 'Enter the complete service address and mark the real pilot origin as primary.',
        expected: 'The depot is saved and the Academy readiness step changes to complete.',
        caution: 'Do not use a billing office if the vehicle actually begins service somewhere else.',
      },
    ],
    completeWhen: 'One primary depot and the correct service timezone persist after refresh.',
  },
  {
    id: 'prepare-fleet',
    programStageId: 'records',
    moduleKey: 'workspace-setup',
    title: 'Create and verify the pilot Driver',
    audience: 'Champion, Admin, or fleet owner',
    goal: 'Create a Driver record that matches the person, login identity, qualifications, and practice assignment.',
    route: '/drivers',
    screenshot: {
      src: '/training/guides/drivers-add.png',
      alt: 'Drivers page with the Add Driver button identified by a numbered callout.',
      caption: 'Click Add Driver and use the pilot Driver’s real work identity and qualifications.',
    },
    steps: [
      {
        title: 'Open the Driver form',
        click: 'Drivers → Add Driver',
        instruction: 'Open the form and enter the pilot Driver’s name, work email, phone, employee identifier, and operating status.',
        expected: 'The form identifies the same person invited to the Driver workspace.',
      },
      {
        title: 'Record eligibility',
        click: 'License and certification fields',
        instruction: 'Enter the valid license class, expiration, certifications, territory, shift availability, and any equipment restrictions used by planning.',
        expected: 'The record contains the qualifications required by the representative route day.',
        caution: 'Do not invent qualifications to clear a routing blocker. Correct the work or assign a qualified Driver.',
      },
      {
        title: 'Save and verify',
        click: 'Save Driver',
        instruction: 'Save the record, find it in Drivers, and confirm active status and the same work email used for sign-in.',
        expected: 'The Driver remains visible after refresh and Academy readiness recognizes an active Driver.',
      },
    ],
    completeWhen: 'The active pilot Driver is saved, qualified for the work, and linked to the invited Driver identity.',
  },
  {
    id: 'create-vehicle',
    programStageId: 'records',
    moduleKey: 'workspace-setup',
    title: 'Create and verify the practice vehicle',
    audience: 'Champion, Admin, or fleet owner',
    goal: 'Give planning accurate capacity, equipment, availability, and Driver compatibility.',
    route: '/vehicles',
    screenshot: {
      src: '/training/guides/vehicles-add.png',
      alt: 'Vehicles page with the Add Vehicle button identified by a numbered callout.',
      caption: 'Click Add Vehicle and enter operating limits that reflect the real practice vehicle.',
    },
    steps: [
      {
        title: 'Open the vehicle form',
        click: 'Vehicles → Add Vehicle',
        instruction: 'Enter the unit name or number, type, registration information, operating status, and home depot.',
        expected: 'The vehicle can be distinguished from every other fleet unit and belongs to the pilot depot.',
      },
      {
        title: 'Enter routing limits',
        click: 'Capacity and equipment fields',
        instruction: 'Record weight, volume, pallet or dimensional capacity, equipment, temperature or hazmat capability, territory, and any Driver restrictions that apply.',
        expected: 'The vehicle can be evaluated against every constraint in the pilot jobs.',
        caution: 'Use approved operating limits, not the theoretical maximum or placeholder values.',
      },
      {
        title: 'Save and verify readiness',
        click: 'Save Vehicle',
        instruction: 'Save the record, reopen it, and confirm it is active, available on the practice date, and compatible with the pilot Driver.',
        expected: 'The vehicle persists after refresh and Academy recognizes a ready vehicle.',
      },
    ],
    completeWhen: 'One active, available, correctly constrained vehicle is saved for the pilot depot and Driver.',
  },
  {
    id: 'add-customers',
    programStageId: 'records',
    moduleKey: 'workspace-setup',
    title: 'Add and verify pilot customers',
    audience: 'Champion, Admin, or Dispatcher',
    goal: 'Create reusable customer locations and service instructions before route-day jobs are loaded.',
    route: '/customers',
    screenshot: {
      src: '/training/guides/customers-add.png',
      alt: 'Customers page with the Add Customer button identified by a numbered callout.',
      caption: 'Click Add Customer and verify the service location, contact, and safe operating notes.',
    },
    steps: [
      {
        title: 'Create the customer',
        click: 'Customers → Add Customer',
        instruction: 'Enter the customer name, service address, approved contact details, and customer reference used by operations.',
        expected: 'The customer is uniquely identifiable and the service address resolves to the intended location.',
      },
      {
        title: 'Add service requirements',
        click: 'Service details and notes',
        instruction: 'Record appointment windows, access limitations, equipment needs, service duration, receiving instructions, and approved contact preferences.',
        expected: 'A Dispatcher or Driver can understand the service conditions without a separate private message.',
        caution: 'Do not store passwords, alarm codes, payment data, medical details, or unrelated personal information in free-text notes.',
      },
      {
        title: 'Save and verify the map location',
        click: 'Save Customer',
        instruction: 'Save, reopen the record, and confirm the mapped location represents the service entrance rather than a postal centroid when precision matters.',
        expected: 'The record persists and can be selected when creating or importing a pilot job.',
      },
    ],
    completeWhen: 'Every pilot customer has an accurate service location, approved contact data, and usable operating instructions.',
  },
  {
    id: 'import-jobs',
    programStageId: 'jobs',
    moduleKey: 'route-operations',
    title: 'Import and validate one representative route day',
    audience: 'Dispatcher, Champion, or Admin',
    goal: 'Load a small, accurate pilot day and resolve every routing-critical data problem.',
    route: '/jobs',
    screenshot: {
      src: '/training/guides/jobs-import.png',
      alt: 'Jobs page with the Import CSV button identified by a numbered callout.',
      caption: 'Click Import CSV on Jobs, then validate the preview before saving.',
    },
    steps: [
      {
        title: 'Prepare the file',
        click: 'Launch docket → Job import CSV template',
        instruction: 'Keep the header row unchanged. Populate customerName and deliveryAddress, then add only constraints that affect the route.',
        expected: 'Every row represents one intended stop and required units use one consistent format.',
      },
      {
        title: 'Open import',
        click: 'Jobs → Import CSV',
        instruction: 'Select the completed file and inspect the preview before confirming the import.',
        expected: 'The preview reports the intended row count and identifies invalid or missing fields.',
      },
      {
        title: 'Resolve readiness blockers',
        click: 'Job row → readiness details',
        instruction: 'Correct incomplete addresses, duplicate rows, conflicting time windows, inconsistent dimensions, and missing equipment or driver rules.',
        expected: 'Every pilot job has a routable pickup or delivery location and no unexplained blocker.',
        caution: 'Never place passwords, tokens, or private access instructions in the import file or a support message.',
      },
    ],
    completeWhen: 'The intended jobs are saved, location validation is complete, and excluded rows have an explicit reason.',
  },
  {
    id: 'plan-route',
    programStageId: 'planning',
    moduleKey: 'route-operations',
    title: 'Create and review a provider-backed route',
    audience: 'Dispatcher or Admin',
    goal: 'Produce a road-network plan with explainable assignments and no hidden publish blocker.',
    route: '/routing',
    screenshot: {
      src: '/training/guides/routing-exceptions.png',
      alt: 'Routing workspace with the Exceptions only view identified by a numbered callout.',
      caption: 'Use Exceptions only to focus review on unassigned work and route blockers.',
    },
    steps: [
      {
        title: 'Create the draft',
        click: 'Routing → Generate route draft',
        instruction: 'Confirm service date, depot, selected jobs, available vehicles, eligible Drivers, and the optimization objective.',
        expected: 'A route draft appears with assigned and unassigned work separated.',
      },
      {
        title: 'Review exceptions',
        click: 'Exceptions only',
        instruction: 'Open each capacity, appointment, equipment, certification, territory, access, temperature, or hazmat blocker and resolve the underlying record.',
        expected: 'No required pilot job remains unassigned without a documented decision.',
      },
      {
        title: 'Confirm provenance',
        click: 'Optimizer provenance',
        instruction: 'Verify solver, matrix provider and mode, coverage, solve time, fallback state, and warnings before publishing.',
        expected: 'The plan is provider-backed with road-network inputs and no simulated or straight-line fallback.',
        caution: 'Do not publish a degraded plan merely to advance the checklist.',
      },
    ],
    completeWhen: 'The published plan is provider-backed, assignments are explainable, and all pilot blockers are resolved or explicitly excluded.',
  },
  {
    id: 'review-import',
    programStageId: 'jobs',
    moduleKey: 'route-operations',
    title: 'Review imported jobs before planning',
    audience: 'Dispatcher or Champion',
    goal: 'Prove that the saved route day matches the source file and contains no hidden data-quality blocker.',
    route: '/jobs',
    screenshot: {
      src: '/training/guides/jobs-import.png',
      alt: 'Jobs page with import and validation controls identified by numbered callouts.',
      caption: 'After import, compare the saved jobs with the source file before opening Routing.',
    },
    steps: [
      {
        title: 'Reconcile counts',
        click: 'Jobs → service-date filter',
        instruction: 'Filter to the practice date and compare saved, rejected, duplicate, and excluded counts with the import summary and source file.',
        expected: 'Every source row has one explained outcome and no job appears twice.',
      },
      {
        title: 'Inspect routing-critical values',
        click: 'Open a representative job',
        instruction: 'Verify address, coordinates, appointment window, service duration, quantity, dimensions, equipment, Driver, access, temperature, and hazmat requirements.',
        expected: 'Saved values match the customer commitment and use consistent units and timezone.',
      },
      {
        title: 'Clear the readiness queue',
        click: 'Job readiness details',
        instruction: 'Open every blocked or warning job. Correct the source record, revalidate, or record an explicit reason for excluding it from the pilot.',
        expected: 'All included jobs are routable and all exclusions have an owner and reason.',
      },
    ],
    completeWhen: 'The saved count is reconciled, a sample is field-checked, and every included job is ready for routing.',
  },
  {
    id: 'review-adjust-route',
    programStageId: 'planning',
    moduleKey: 'route-operations',
    title: 'Review, adjust, and publish the route',
    audience: 'Dispatcher',
    goal: 'Turn the optimized draft into a version the team can safely execute and explain.',
    route: '/routing',
    screenshot: {
      src: '/training/guides/routing-selected.png',
      alt: 'Routing workspace with the Selected route view identified by a numbered callout.',
      caption: 'Use Selected route to review sequence, timing, capacity, and exceptions before publishing.',
    },
    steps: [
      {
        title: 'Review one route end to end',
        click: 'Selected route',
        instruction: 'Compare stop order, drive time, service time, appointment windows, load progression, depot return, and Driver shift against the operating plan.',
        expected: 'The route is feasible and every stop has a clear reason for its placement.',
      },
      {
        title: 'Make an operational adjustment',
        click: 'Stop timeline or route action menu',
        instruction: 'Move, insert, or reassign a stop only for a real operational reason. Recalculate and review the resulting route, constraints, and provenance.',
        expected: 'The change is saved, constraints remain satisfied, and any accepted risk is explicit.',
        caution: 'Manual changes can invalidate capacity, time-window, or Driver rules. Always review the whole route again.',
      },
      {
        title: 'Publish the approved version',
        click: 'Publish route plan',
        instruction: 'Confirm the selected version, unresolved exception count, provider-backed provenance, and assigned depot before publishing.',
        expected: 'A published version number and timestamp are visible and Dispatch receives the same plan.',
      },
    ],
    completeWhen: 'The final plan is reviewed end to end, constraints remain valid, and one identifiable version is published.',
  },
  {
    id: 'dispatch-route',
    programStageId: 'launch-day',
    moduleKey: 'route-operations',
    title: 'Assign, publish, and dispatch the practice route',
    audience: 'Dispatcher',
    goal: 'Hand the reviewed route to the trained Driver and keep same-day decisions in one operational record.',
    route: '/dispatch',
    screenshot: {
      src: '/training/guides/dispatch-attention.png',
      alt: 'Dispatch board with the Needs attention filter identified by a numbered callout.',
      caption: 'Use Needs attention before dispatch to find routes that are not ready.',
    },
    steps: [
      {
        title: 'Check readiness',
        click: 'Dispatch → Needs attention',
        instruction: 'Review unpublished plans, missing assignments, ineligible vehicles, open exceptions, and pending reroute decisions.',
        expected: 'The practice route no longer appears in the attention queue.',
      },
      {
        title: 'Assign resources',
        click: 'Practice route → Driver and vehicle selectors',
        instruction: 'Select the trained pilot Driver and the eligible vehicle verified during setup.',
        expected: 'The route shows the intended Driver and vehicle with no eligibility warning.',
      },
      {
        title: 'Dispatch',
        click: 'Publish, then Dispatch',
        instruction: 'Confirm the final route version and release it to the Driver workspace.',
        expected: 'The route enters the dispatched state and appears for the authenticated pilot Driver.',
      },
    ],
    completeWhen: 'The correct Driver can open the dispatched route and Dispatch sees the same route state.',
  },
  {
    id: 'driver-stop',
    programStageId: 'launch-day',
    moduleKey: 'driver-quick-start',
    title: 'Complete one Driver practice stop',
    audience: 'Pilot Driver',
    goal: 'Rehearse the same stop-state, proof, message, and exception flow used on launch day.',
    route: '/driver',
    screenshot: {
      src: '/training/guides/driver-arrive.png',
      alt: 'Mobile Driver route with the Arrive button identified by a numbered callout.',
      caption: 'Tap Arrive only after physically reaching the stop.',
    },
    steps: [
      {
        title: 'Open the assigned route',
        click: 'Driver workspace → Start stop flow',
        instruction: 'Confirm the vehicle, stop order, address, appointment window, access notes, and special instructions.',
        expected: 'The route and vehicle match the assignment provided by Dispatch.',
      },
      {
        title: 'Record arrival',
        click: 'Arrive',
        instruction: 'Tap only when physically at the stop. If the location or assignment is wrong, contact Dispatch before changing state.',
        expected: 'The stop history records the arrival timestamp.',
      },
      {
        title: 'Complete or except the stop',
        click: 'Add proof or Report exception',
        instruction: 'Capture every required photo, signature, recipient, and note. If service fails, select the real reason and message Dispatch when timing or customer expectations change.',
        expected: 'Proof or the exception remains attached to the correct stop after refresh.',
      },
      {
        title: 'Depart and finish',
        click: 'Depart',
        instruction: 'Record departure before moving on. Complete the route only after every stop is completed or otherwise resolved.',
        expected: 'Dispatch sees the same stop state and event history.',
      },
    ],
    completeWhen: 'Arrival, proof or exception, any required message, and departure are visible to Dispatch for the practice stop.',
  },
  {
    id: 'driver-start-route',
    programStageId: 'launch-day',
    moduleKey: 'driver-quick-start',
    title: 'Start the assigned Driver route',
    audience: 'Pilot Driver',
    goal: 'Verify identity, assignment, vehicle, and route details before the first movement.',
    route: '/driver',
    screenshot: {
      src: '/training/guides/driver-start.png',
      alt: 'Mobile Driver workspace with the Start stop flow control identified by a numbered callout.',
      caption: 'Confirm the assignment and vehicle before starting the stop flow.',
    },
    steps: [
      {
        title: 'Sign in on the approved device',
        click: 'Driver sign-in → assigned route',
        instruction: 'Use the Driver’s own work identity. Confirm the displayed date, route, Driver name, and vehicle against the Dispatch handoff.',
        expected: 'The Driver sees exactly one intended practice assignment with the correct vehicle.',
        caution: 'Do not share a Driver session or continue when another person’s route is shown.',
      },
      {
        title: 'Review the day',
        click: 'Route summary and stop list',
        instruction: 'Review stop order, addresses, appointment windows, load or equipment notes, service instructions, and the Dispatch contact path.',
        expected: 'The Driver understands the route, first stop, special requirements, and how to report a problem.',
      },
      {
        title: 'Begin execution',
        click: 'Start stop flow',
        instruction: 'Start only after the vehicle inspection is complete and Dispatch has confirmed the released plan.',
        expected: 'The route enters the active state and Dispatch can see the same state.',
      },
    ],
    completeWhen: 'The authenticated Driver starts the correct dispatched route with the correct vehicle and Dispatch sees the active state.',
  },
  {
    id: 'manage-exceptions',
    programStageId: 'launch-day',
    moduleKey: 'route-operations',
    title: 'Record, communicate, and resolve an exception',
    audience: 'Driver and Dispatcher',
    goal: 'Keep the operational decision, owner, customer impact, and outcome attached to the route record.',
    route: '/route-runs/route-alpha-001',
    screenshot: {
      src: '/training/guides/route-run-exception.png',
      alt: 'Route-run detail with the New exception button identified by a numbered callout.',
      caption: 'Create the exception on the affected route or stop, then assign and resolve it from the same record.',
    },
    steps: [
      {
        title: 'Create the operational exception',
        click: 'Route run → New exception',
        instruction: 'Select the affected route or stop, accurate reason, severity, timestamp, customer impact, and a concise factual description.',
        expected: 'The exception appears in the route timeline and exception queue with an ownerable status.',
      },
      {
        title: 'Coordinate in the route record',
        click: 'Driver Messages → Message driver',
        instruction: 'Send the next action, decision owner, and required update time. Use the approved escalation channel for urgent safety or customer-impact events.',
        expected: 'Dispatch and Driver can see the same instruction and message history.',
        caution: 'Do not include passwords, payment data, access codes, or unnecessary personal information.',
      },
      {
        title: 'Acknowledge and resolve',
        click: 'Exceptions → Acknowledge or Resolve',
        instruction: 'Assign an owner, record the action taken, update the route or customer commitment, and resolve only when no follow-up remains.',
        expected: 'Status, owner, resolution, and related route events remain visible after refresh.',
      },
    ],
    completeWhen: 'One practice exception has a route context, owner, message history, documented outcome, and resolved status.',
  },
  {
    id: 'verify-proof',
    programStageId: 'visibility',
    moduleKey: 'route-operations',
    title: 'Verify proof and close practice exceptions',
    audience: 'Dispatcher or Champion',
    goal: 'Confirm the route record can explain what happened without relying on texts or paper notes.',
    route: '/pod',
    screenshot: {
      src: '/training/guides/proof-filters.png',
      alt: 'Proof of Delivery page with the Filters control identified by a numbered callout.',
      caption: 'Filter Proof of Delivery to the practice route and inspect the saved artifact.',
    },
    steps: [
      {
        title: 'Find the practice record',
        click: 'Proof of Delivery → Filters',
        instruction: 'Filter by the practice date, route, Driver, or proof status and open the expected stop.',
        expected: 'The proof record is attached to the same route and stop completed by the Driver.',
      },
      {
        title: 'Inspect completeness',
        click: 'Proof record',
        instruction: 'Confirm required photo, signature, recipient, note, and timestamps according to the stop policy.',
        expected: 'Required artifacts load successfully and show the correct stop context.',
      },
      {
        title: 'Resolve exceptions',
        click: 'Exceptions → open item',
        instruction: 'Assign an owner and outcome to every failed, skipped, delayed, or rescheduled stop.',
        expected: 'No practice exception is left without a reason, owner, and next action.',
      },
    ],
    completeWhen: 'At least one persisted proof artifact is verified and every practice exception has an owner and outcome.',
  },
  {
    id: 'monitor-route',
    programStageId: 'visibility',
    moduleKey: 'route-operations',
    title: 'Monitor route progress and act on risk',
    audience: 'Dispatcher or Champion',
    goal: 'Use live route state and event history to identify a meaningful problem before it becomes a missed commitment.',
    route: '/tracking',
    screenshot: {
      src: '/training/guides/tracking-view.png',
      alt: 'Tracking page with route and Driver view controls identified by numbered callouts.',
      caption: 'Use Tracking to compare planned progress with current Driver and route signals.',
    },
    steps: [
      {
        title: 'Open the live operating view',
        click: 'Tracking → Both',
        instruction: 'Filter to the practice date and route, then show route and Driver context together.',
        expected: 'The correct route, Driver, vehicle, completed stops, current state, and latest signal are visible.',
      },
      {
        title: 'Refresh and interpret risk',
        click: 'Refresh signals',
        instruction: 'Compare current progress, latest signal time, estimated arrival, appointment windows, outstanding stops, and open exceptions. Check event history before assuming a Driver is late.',
        expected: 'The Dispatcher can identify whether the route is on plan, stale, delayed, or blocked and explain the evidence.',
      },
      {
        title: 'Take the documented next action',
        click: 'Open route run or exception',
        instruction: 'Message the Driver, create an exception, update the customer commitment, or begin the approved fallback according to ownership and urgency.',
        expected: 'The action and owner are recorded in the operational system rather than only in an external text.',
      },
    ],
    completeWhen: 'The team identifies one practice risk from Tracking and records the correct next action and owner.',
  },
  {
    id: 'signoff-readiness',
    programStageId: 'go-live',
    moduleKey: 'go-live',
    title: 'Complete signoff and request the readiness review',
    audience: 'Customer Champion',
    goal: 'Arrive at the included checkpoint with evidence and decisions already prepared.',
    route: '/academy',
    screenshot: {
      src: '/training/guides/academy-readiness.png',
      alt: 'Academy Launch readiness panel identified by a numbered callout.',
      caption: 'The readiness panel identifies the next incomplete evidence-backed action.',
    },
    steps: [
      {
        title: 'Clear the next action',
        click: 'Launch readiness → next action button',
        instruction: 'Open the identified action and correct the underlying training or workspace record. Repeat until every required step is complete.',
        expected: 'The panel shows Ready for Review rather than a manually checked placeholder.',
      },
      {
        title: 'Complete customer signoff',
        click: 'Go-Live → responsibility acknowledgement',
        instruction: 'Confirm team coverage, practice evidence, support boundary, escalation ownership, fallback procedure, KPI owners, and target launch date.',
        expected: 'Go-Live is complete and customer signoff is persisted.',
      },
      {
        title: 'Request the checkpoint',
        click: 'Request review',
        instruction: 'Schedule the included 30-minute review with the Champion and the person authorized to make launch decisions.',
        expected: 'The request includes the launch date, remaining blocker if any, and responsible owner.',
      },
    ],
    completeWhen: 'Academy says Ready for Review and the signed docket matches the same team, evidence, blockers, and KPI dates.',
  },
  {
    id: 'viewer-review',
    programStageId: 'visibility',
    moduleKey: 'viewer-basics',
    title: 'Review route visibility without changing records',
    audience: 'Viewer',
    goal: 'Find route, tracking, proof, and report answers while preserving read-only boundaries.',
    route: '/tracking',
    screenshot: {
      src: '/training/guides/tracking-view.png',
      alt: 'Tracking page with the route and driver view control identified by a numbered callout.',
      caption: 'Use Tracking to review operational status; contact Dispatch when a record must change.',
    },
    steps: [
      {
        title: 'Open operational visibility',
        click: 'Navigation → Tracking',
        instruction: 'Use route and Driver filters to locate the intended delivery context.',
        expected: 'Planned work, current progress, estimated arrival, completed stops, and exceptions are visible.',
      },
      {
        title: 'Inspect supporting records',
        click: 'Proof of Delivery or Analytics',
        instruction: 'Review the relevant proof or report and compare it with route events before interpreting a surprising value.',
        expected: 'The Viewer can answer the business question without editing operational data.',
      },
    ],
    completeWhen: 'The Viewer can locate one route, tracking record, proof artifact, and report, and knows when to contact Dispatch.',
  },
  {
    id: 'review-kpis',
    programStageId: 'go-live',
    moduleKey: 'go-live',
    title: 'Review first-week and first-30-day KPIs',
    audience: 'Customer Champion, Owner, or Viewer',
    goal: 'Turn the implementation into a repeatable operating review with named owners and corrective actions.',
    route: '/analytics',
    screenshot: {
      src: '/training/guides/analytics-export.png',
      alt: 'Analytics page with the View and Export controls identified by numbered callouts.',
      caption: 'Use Analytics and the docket KPI worksheet for the week-one and day-30 reviews.',
    },
    steps: [
      {
        title: 'Set the review window',
        click: 'Analytics → date range → View',
        instruction: 'Choose the first week or first 30 days and apply the same depot, route, or Driver scope used by the KPI owner.',
        expected: 'The report period and population match the signed launch plan.',
      },
      {
        title: 'Review adoption and operations',
        click: 'KPI summary',
        instruction: 'Review time to first practice route, training completion, dispatch success, on-time performance, exception rate, proof completion, and support requests. Validate surprising values against route events.',
        expected: 'Every KPI has a value or a documented data-quality reason, target, and accountable owner.',
      },
      {
        title: 'Export and assign actions',
        click: 'Export',
        instruction: 'Save the report with the review date, then record corrective action, owner, and due date in the docket KPI worksheet.',
        expected: 'The review artifact and action list are available to the Champion and launch decision-maker.',
      },
    ],
    completeWhen: 'Week-one and day-30 reviews are scheduled, KPI owners are named, and every off-target result has a dated action.',
  },
  {
    id: 'support-escalation',
    programStageId: 'go-live',
    moduleKey: 'go-live',
    title: 'Use support and the escalation path',
    audience: 'All roles; Champion owns coordination',
    goal: 'Resolve common issues quickly while giving Support safe, complete evidence when product help is required.',
    route: '/support',
    screenshot: {
      src: '/training/guides/support-search.png',
      alt: 'Support knowledge base with the search field identified by a numbered callout.',
      caption: 'Search the knowledge base by symptom before opening a support request.',
    },
    steps: [
      {
        title: 'Search by symptom',
        click: 'Support → Search help articles',
        instruction: 'Search the exact visible symptom or control name. Follow the guide checks in order and note the result of each check.',
        expected: 'A relevant article or troubleshooting entry identifies a safe next action.',
      },
      {
        title: 'Apply the ownership matrix',
        click: 'Launch docket → exception and escalation matrix',
        instruction: 'Route data preparation, scheduling, team completion, and customer-specific process decisions to the Champion. Route product defects and platform access failures to Support.',
        expected: 'The issue has one owner, priority, next update time, and customer-impact statement.',
      },
      {
        title: 'Submit a useful request',
        click: 'Support → Contact support',
        instruction: 'Include organization, role, page, route/job/stop ID, expected result, observed result, local time, request ID, checks already completed, and a redacted screenshot.',
        expected: 'Support can reproduce or investigate without first requesting basic context.',
        caution: 'Never send passwords, tokens, private keys, payment data, access codes, signatures, or unrelated customer data.',
      },
    ],
    completeWhen: 'The Champion can classify an issue, name the correct owner, and prepare a safe complete support request.',
  },
] as const;

export const implementationFaqs: readonly ImplementationFaq[] = [
  { category: 'Getting started', question: 'Where should a new customer begin?', answer: 'Assign an Owner or Admin as Customer Champion, open Academy, download the launch docket, and record the pilot Dispatcher, Driver, depot, vehicle, route date, and escalation contact before importing data.' },
  { category: 'Scope', question: 'Should we import every customer and route before the pilot?', answer: 'No. Use one representative route day, one depot, one trained Driver, and one ready vehicle. Expand only after the complete workflow is proven.' },
  { category: 'Access', question: 'Why can a user not see the page shown in the guide?', answer: 'The guide is role-based. Confirm the person used the invited work identity and has the least-privileged role required for the task. Do not grant Admin simply to bypass an access problem.' },
  { category: 'Imports', question: 'Can we rename or remove columns in the provided CSV?', answer: 'Keep the supported header names. customerName and deliveryAddress are the minimum. Optional constraint fields may be left blank when they do not apply, but routing-critical data should not be omitted.' },
  { category: 'Planning', question: 'What does provider-backed mean?', answer: 'The route used road-network travel inputs from the configured routing provider. Confirm solver, matrix mode, coverage, fallback state, solve time, and warnings in optimizer provenance.' },
  { category: 'Planning', question: 'What should we do with an unassigned job?', answer: 'Open the blocker and correct the underlying address, capacity, appointment, equipment, certification, driver, territory, access, temperature, or hazmat rule. If the job is deliberately excluded, record the reason.' },
  { category: 'Driver', question: 'What if the Driver sees the wrong route or vehicle?', answer: 'Do not start the route. Confirm the Driver signed in with the assigned identity and ask Dispatch to correct the assignment. Start only after both workspaces show the same route and vehicle.' },
  { category: 'Proof', question: 'What counts as practice-route proof?', answer: 'A persisted artifact attached to the correct stop, such as the required photo, signature, recipient, note, and timestamps. A screenshot of an unsaved form is not proof.' },
  { category: 'Readiness', question: 'Can the readiness checklist be checked manually?', answer: 'Operational steps come from saved workspace records and training steps come from versioned completion. Correct the underlying record through the next-action link.' },
  { category: 'Support', question: 'What should a useful support request include?', answer: 'Include organization, role, page, route/job/stop ID, expected result, observed result, local time, visible request ID, and a redacted screenshot. Never send passwords, tokens, access codes, signatures, or unrelated customer data.' },
] as const;

export const implementationTroubleshooting: readonly ImplementationTroubleshootingItem[] = [
  {
    symptom: 'Invitation or sign-in does not work',
    likelyCause: 'Wrong email, expired invitation, revoked membership, blocked pop-up, or stale browser session.',
    resolution: ['Confirm the invited work email exactly.', 'Resend the invitation from Settings → Team.', 'Sign out, close other organization sessions, and retry in a current browser.', 'Record the visible request ID if the failure remains.'],
    escalateWhen: 'The correct active membership still fails in a clean browser session.',
  },
  {
    symptom: 'A user cannot see the expected navigation or action',
    likelyCause: 'The assigned role does not permit the operation or the user signed in with another identity.',
    resolution: ['Compare the required audience in the guide with the membership role.', 'Confirm the signed-in email.', 'Use an Owner/Admin to correct the role only when the person truly owns that responsibility.'],
    escalateWhen: 'The correct role and identity still do not expose the documented control.',
  },
  {
    symptom: 'CSV import rejects the file',
    likelyCause: 'Changed headers, unsupported encoding, inconsistent rows, invalid dates, or spreadsheet formatting damage.',
    resolution: ['Start again from the downloaded template.', 'Keep the header row unchanged.', 'Export as UTF-8 CSV.', 'Check quoted commas, date/time values, and consistent measurement units.', 'Import a two-row sample to isolate the failing field.'],
    escalateWhen: 'A minimal template-based file still fails; attach a sanitized sample and request ID.',
  },
  {
    symptom: 'Imported job is blocked from routing',
    likelyCause: 'Unresolved address or an unmet appointment, capacity, equipment, certification, territory, access, temperature, or hazmat requirement.',
    resolution: ['Open the job readiness details.', 'Correct the specific field named by the blocker.', 'Confirm the intended Driver and vehicle satisfy the same constraint.', 'Revalidate before optimizing again.'],
    escalateWhen: 'The readiness detail conflicts with the saved record after refresh.',
  },
  {
    symptom: 'Optimization falls back or shows degraded provenance',
    likelyCause: 'Routing-provider configuration, coverage, timeout, or unreachable location problem.',
    resolution: ['Read the optimizer provenance warning.', 'Confirm every pilot location is validated and covered.', 'Retry once after correcting data.', 'Do not publish the simulated or straight-line plan.'],
    escalateWhen: 'Validated covered locations repeatedly fail with the same provider/request details.',
  },
  {
    symptom: 'A route cannot be published',
    likelyCause: 'Unassigned required work, unresolved blocker, degraded provider result, or pending risk acceptance.',
    resolution: ['Open Exceptions only.', 'Resolve each blocker or deliberately exclude the affected job with a reason.', 'Confirm provider-backed provenance.', 'Regenerate and review the plan.'],
    escalateWhen: 'The publish control remains blocked after the readiness panel shows no blockers.',
  },
  {
    symptom: 'A published route cannot be dispatched',
    likelyCause: 'Missing or ineligible Driver/vehicle, stale route version, open exception, or pending reroute decision.',
    resolution: ['Open Dispatch → Needs attention.', 'Confirm the route version is published.', 'Reassign an eligible trained Driver and ready vehicle.', 'Resolve pending reroute or exception decisions.'],
    escalateWhen: 'The route shows ready but Dispatch still rejects the action; include route ID and request ID.',
  },
  {
    symptom: 'Driver cannot see the assigned route',
    likelyCause: 'Wrong signed-in Driver identity, route not dispatched, or assignment changed after the Driver loaded the page.',
    resolution: ['Confirm the Driver work email and identity.', 'Ask Dispatch to confirm dispatched state and assignment.', 'Refresh the Driver workspace after the correction.', 'Do not share another Driver session.'],
    escalateWhen: 'Both workspaces show the same identity and dispatched assignment but the route remains absent.',
  },
  {
    symptom: 'Arrival, departure, or proof will not save',
    likelyCause: 'Network interruption, missing required field, denied camera/location permission, or stale stop state.',
    resolution: ['Keep the page open and confirm network service.', 'Read the inline required-field message.', 'Allow the required browser permission for the approved device.', 'Refresh only after noting whether the action shows as saved.', 'Message Dispatch before leaving the stop.'],
    escalateWhen: 'The action repeatedly fails with connectivity restored; include route/stop ID, time, and request ID.',
  },
  {
    symptom: 'Proof exists but readiness remains incomplete',
    likelyCause: 'The artifact is unsaved, attached to another stop or route, or does not satisfy the configured proof requirement.',
    resolution: ['Open Proof of Delivery and filter to the practice route.', 'Verify the exact stop association.', 'Confirm every required artifact and timestamp is present.', 'Refresh Academy after the persisted proof appears.'],
    escalateWhen: 'The correct persisted artifact is visible but the readiness response still marks proof incomplete.',
  },
  {
    symptom: 'Training completion disappeared after an update',
    likelyCause: 'The module had a major content version change marked for recertification, or the user completed it under another identity.',
    resolution: ['Confirm the signed-in identity.', 'Review the displayed content version.', 'Complete the updated knowledge check when recertification is required.'],
    escalateWhen: 'Completion disappeared after only a minor content update for the same organization and identity.',
  },
  {
    symptom: 'Academy readiness does not match the workspace',
    likelyCause: 'A record was not saved, a different organization is active, a role-specific training requirement is incomplete, or data is still being refreshed.',
    resolution: ['Use the next-action link rather than checking a separate spreadsheet.', 'Open and save the underlying record.', 'Confirm the active organization and Champion.', 'Refresh once and compare team progress.'],
    escalateWhen: 'The source record and Academy response remain inconsistent; provide the step name and redacted evidence.',
  },
] as const;
