export const trainingAudiences = [
  'CHAMPION',
  'OWNER',
  'ADMIN',
  'DISPATCHER',
  'DRIVER',
  'VIEWER',
] as const;

export type TrainingAudience = (typeof trainingAudiences)[number];
export type TrainingTrack =
  | 'start-here'
  | 'workspace-setup'
  | 'route-operations'
  | 'driver-quick-start'
  | 'go-live'
  | 'viewer-basics';
export type TrainingProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type KnowledgeCheckQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctOption: number;
  explanation: string;
};

export type KnowledgeCheck = {
  passingScore: number;
  questions: KnowledgeCheckQuestion[];
};

export type TrainingArticleSection = {
  heading: string;
  body: string;
  steps?: string[];
};

export type TrainingVideoChapter = {
  title: string;
  startSeconds: number;
  procedureIds: string[];
};

export type TrainingModule = {
  key: string;
  track: TrainingTrack;
  title: string;
  summary: string;
  audiences: TrainingAudience[];
  estimatedMinutes: number;
  contentVersion: string;
  lastReviewedAt: string;
  required: boolean;
  recertifyOnMajorVersion: boolean;
  videoSrc: string;
  captionsSrc: string;
  posterSrc: string;
  videoChapters: TrainingVideoChapter[];
  task: { label: string; href: string; completionHint: string };
  article: TrainingArticleSection[];
  knowledgeCheck: KnowledgeCheck;
};

export type TrainingProgress = {
  moduleKey: string;
  contentVersion: string;
  status: TrainingProgressStatus;
  score: number | null;
  signoffAcknowledged: boolean;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type OnboardingStep = {
  id: string;
  label: string;
  owner: string;
  complete: boolean;
  blocked: boolean;
  action: string;
  href: string;
  detail: string;
};

export type OnboardingReadiness = {
  championUserId: string | null;
  operationalSteps: OnboardingStep[];
  trainingSteps: OnboardingStep[];
  operationalComplete: number;
  trainingComplete: number;
  totalSteps: number;
  completedSteps: number;
  driverTrainingComplete: boolean;
  signoffComplete: boolean;
  readyForReview: boolean;
  nextAction: OnboardingStep | null;
  generatedAt: string;
};

const commonPoster = '/training/trovan-academy-poster.webp';

export const trovanTrainingCatalog: readonly TrainingModule[] = [
  {
    key: 'start-here',
    track: 'start-here',
    title: 'Start here: own the rollout',
    summary: 'Choose the customer Champion, set the seven-day launch rhythm, and understand the standard support boundary.',
    audiences: ['CHAMPION', 'OWNER', 'ADMIN'],
    estimatedMinutes: 15,
    contentVersion: '1.2.0',
    lastReviewedAt: '2026-08-19',
    required: true,
    recertifyOnMajorVersion: false,
    videoSrc: '/training/start-here.mp4',
    captionsSrc: '/training/start-here.vtt',
    posterSrc: commonPoster,
    videoChapters: [
      { title: 'How customer-led implementation works', startSeconds: 0, procedureIds: ['assign-champion'] },
      { title: 'Champion ownership and team roles', startSeconds: 28, procedureIds: ['assign-champion', 'first-login-tour'] },
      { title: 'Seven-day rollout sequence', startSeconds: 58, procedureIds: ['assign-champion'] },
      { title: 'Keep the pilot intentionally small', startSeconds: 91, procedureIds: ['first-login-tour'] },
      { title: 'Included support and service boundaries', startSeconds: 121, procedureIds: ['support-escalation'] },
      { title: 'First workspace action', startSeconds: 151, procedureIds: ['configure-team'] },
    ],
    task: {
      label: 'Review team access',
      href: '/settings',
      completionHint: 'Confirm the Champion, dispatchers, pilot driver, and escalation contact.',
    },
    article: [
      {
        heading: 'Your implementation model',
        body: 'The customer Champion owns data preparation, internal training, the practice route, and team follow-through. Trovan supplies the Academy, launch docket, product support, and one readiness review.',
      },
      {
        heading: 'Seven-day launch rhythm',
        body: 'Keep the rollout small and evidence-based.',
        steps: [
          'Day 1: confirm the Champion, users, roles, depot, and support path.',
          'Day 2: prepare drivers, vehicles, customers, and one real route-day file.',
          'Day 3: import and correct every location or constraint blocker.',
          'Day 4: create and review a provider-backed route draft.',
          'Day 5: dispatch a practice route and complete Driver Quick Start.',
          'Day 6: capture proof, rehearse an exception, and finish signoff.',
          'Day 7: complete the 30-minute Trovan readiness review.',
        ],
      },
      {
        heading: 'Included and excluded work',
        body: 'Academy access, the docket, best-effort support, and one readiness review are included. Data cleanup, custom integrations, onsite work, and live team training are separately scoped services.',
      },
    ],
    knowledgeCheck: {
      passingScore: 80,
      questions: [
        {
          id: 'champion-owner',
          prompt: 'Who owns customer data preparation and internal training?',
          options: ['The customer Champion', 'The pilot driver', 'Trovan support'],
          correctOption: 0,
          explanation: 'The customer Champion owns preparation and internal adoption; Trovan provides the self-service system and readiness review.',
        },
        {
          id: 'included-review',
          prompt: 'What live onboarding is included in the standard plan?',
          options: ['Weekly training calls', 'One 30-minute readiness review', 'Onsite launch support'],
          correctOption: 1,
          explanation: 'The standard plan includes one focused launch-readiness checkpoint.',
        },
      ],
    },
  },
  {
    key: 'workspace-setup',
    track: 'workspace-setup',
    title: 'Set up the operating workspace',
    summary: 'Configure the depot, team roles, customers, drivers, and vehicles before importing the pilot route day.',
    audiences: ['CHAMPION', 'OWNER', 'ADMIN'],
    estimatedMinutes: 25,
    contentVersion: '1.2.0',
    lastReviewedAt: '2026-08-19',
    required: true,
    recertifyOnMajorVersion: false,
    videoSrc: '/training/workspace-setup.mp4',
    captionsSrc: '/training/workspace-setup.vtt',
    posterSrc: commonPoster,
    videoChapters: [
      { title: 'Minimum operating workspace', startSeconds: 0, procedureIds: ['configure-depot'] },
      { title: 'Organization, timezone, and depot', startSeconds: 27, procedureIds: ['configure-depot'] },
      { title: 'Invite users and assign roles', startSeconds: 55, procedureIds: ['configure-team'] },
      { title: 'Create the pilot Driver and vehicle', startSeconds: 83, procedureIds: ['prepare-fleet', 'create-vehicle'] },
      { title: 'Prepare pilot customers', startSeconds: 116, procedureIds: ['add-customers'] },
      { title: 'Verify saved readiness evidence', startSeconds: 146, procedureIds: ['configure-depot', 'prepare-fleet', 'create-vehicle'] },
    ],
    task: {
      label: 'Configure workspace',
      href: '/settings',
      completionHint: 'Save one primary depot, active driver, ready vehicle, and the correct team roles.',
    },
    article: [
      {
        heading: 'Build the minimum pilot team',
        body: 'Start with one Owner or Admin Champion, one Dispatcher, and one Driver. Viewers can be added for read-only operational visibility.',
        steps: [
          'Confirm the organization timezone and primary depot.',
          'Invite each user with the least-privileged role they need.',
          'Create an active driver and confirm contact and credential fields.',
          'Create an available vehicle with realistic capacity and equipment.',
          'Add or import the customers included in the practice route.',
        ],
      },
      {
        heading: 'Role boundaries',
        body: 'Owners and Admins manage the workspace. Dispatchers plan and run routes. Drivers execute assigned work. Viewers can inspect operational data without changing it.',
      },
    ],
    knowledgeCheck: {
      passingScore: 80,
      questions: [
        {
          id: 'least-privilege',
          prompt: 'Which role should be used for read-only operational visibility?',
          options: ['Admin', 'Dispatcher', 'Viewer'],
          correctOption: 2,
          explanation: 'Viewer is the read-only role.',
        },
        {
          id: 'minimum-fleet',
          prompt: 'What is the minimum fleet setup needed for the practice route?',
          options: ['One active driver and one ready vehicle', 'Every company driver and vehicle', 'A live integration'],
          correctOption: 0,
          explanation: 'Keep the pilot narrow: one active driver and one ready vehicle are enough to prove the workflow.',
        },
      ],
    },
  },
  {
    key: 'route-operations',
    track: 'route-operations',
    title: 'Plan, dispatch, and prove a route day',
    summary: 'Import clean jobs, resolve blockers, optimize with road-network inputs, dispatch the route, and review proof.',
    audiences: ['CHAMPION', 'OWNER', 'ADMIN', 'DISPATCHER'],
    estimatedMinutes: 40,
    contentVersion: '1.2.0',
    lastReviewedAt: '2026-08-19',
    required: true,
    recertifyOnMajorVersion: true,
    videoSrc: '/training/route-operations.mp4',
    captionsSrc: '/training/route-operations.vtt',
    posterSrc: commonPoster,
    videoChapters: [
      { title: 'Prepare the route-day file', startSeconds: 0, procedureIds: ['import-jobs'] },
      { title: 'Preview, import, and validate jobs', startSeconds: 29, procedureIds: ['import-jobs', 'review-import'] },
      { title: 'Create the route draft', startSeconds: 60, procedureIds: ['plan-route'] },
      { title: 'Confirm provider-backed provenance', startSeconds: 91, procedureIds: ['plan-route'] },
      { title: 'Publish, assign, and dispatch', startSeconds: 122, procedureIds: ['review-adjust-route', 'dispatch-route'] },
      { title: 'Monitor execution, exceptions, and proof', startSeconds: 155, procedureIds: ['manage-exceptions', 'monitor-route', 'verify-proof'] },
    ],
    task: {
      label: 'Import the pilot route day',
      href: '/jobs',
      completionHint: 'Import the docket CSV, resolve location blockers, optimize, publish, dispatch, and capture proof.',
    },
    article: [
      {
        heading: 'Import and validate',
        body: 'Use CSV or JSON with customerName and deliveryAddress. Add time windows, service duration, load dimensions, equipment, driver rules, and site instructions when they affect routing.',
        steps: [
          'Import one representative route day rather than the entire operating history.',
          'Fix missing or ambiguous addresses before optimization.',
          'Review capacity, appointment, equipment, driver, and access blockers.',
          'Keep access codes and private instructions out of support messages.',
        ],
      },
      {
        heading: 'Optimize and review',
        body: 'Create a provider-backed draft, confirm road-network provenance, inspect unassigned work, and resolve every publish blocker before dispatch.',
      },
      {
        heading: 'Run and prove the day',
        body: 'Assign the trained pilot driver, publish and dispatch, follow status and exceptions, then confirm a persisted proof artifact in Proof of Delivery.',
      },
    ],
    knowledgeCheck: {
      passingScore: 80,
      questions: [
        {
          id: 'location-blocker',
          prompt: 'What should happen before optimizing jobs with unresolved addresses?',
          options: ['Dispatch them anyway', 'Correct or validate the locations', 'Delete the customers'],
          correctOption: 1,
          explanation: 'Location blockers must be resolved so the road-network plan is trustworthy.',
        },
        {
          id: 'provider-backed',
          prompt: 'Which route is ready for pilot review?',
          options: ['A provider-backed route with blockers resolved', 'A simulated preview route', 'A straight-line fallback route'],
          correctOption: 0,
          explanation: 'The hosted pilot requires provider-backed road-network routing and resolved blockers.',
        },
      ],
    },
  },
  {
    key: 'driver-quick-start',
    track: 'driver-quick-start',
    title: 'Driver Quick Start',
    summary: 'Open the assigned route, work each stop in order, communicate exceptions, and capture complete proof.',
    audiences: ['DRIVER'],
    estimatedMinutes: 15,
    contentVersion: '1.2.0',
    lastReviewedAt: '2026-08-19',
    required: true,
    recertifyOnMajorVersion: true,
    videoSrc: '/training/driver-quick-start.mp4',
    captionsSrc: '/training/driver-quick-start.vtt',
    posterSrc: commonPoster,
    videoChapters: [
      { title: 'Confirm the assigned route and vehicle', startSeconds: 0, procedureIds: ['driver-start-route'] },
      { title: 'Start and record physical arrival', startSeconds: 29, procedureIds: ['driver-start-route', 'driver-stop'] },
      { title: 'Capture complete proof', startSeconds: 57, procedureIds: ['driver-stop'] },
      { title: 'Report exceptions and message Dispatch', startSeconds: 88, procedureIds: ['manage-exceptions'] },
      { title: 'Depart and complete the route', startSeconds: 118, procedureIds: ['driver-stop'] },
      { title: 'Protect customer and delivery data', startSeconds: 148, procedureIds: ['support-escalation'] },
    ],
    task: {
      label: 'Open driver workspace',
      href: '/driver',
      completionHint: 'Complete one practice stop with arrival, proof, notes, and departure recorded.',
    },
    article: [
      {
        heading: 'Run the assigned route',
        body: 'Use the mobile driver workspace for the route assigned to your authenticated driver identity.',
        steps: [
          'Open the assigned route and review stop order and special instructions.',
          'Start the route, then mark arrival only when physically at the stop.',
          'Capture the required photo, signature, recipient, or note before leaving.',
          'Use the exception path when a stop cannot be completed as planned.',
          'Message Dispatch when the exception changes timing or customer expectations.',
          'Mark departure and complete the route only after every stop is resolved.',
        ],
      },
      {
        heading: 'Protect delivery data',
        body: 'Use only your assigned session. Do not forward access codes, proof images, tracking links, or customer details outside approved operational channels.',
      },
    ],
    knowledgeCheck: {
      passingScore: 80,
      questions: [
        {
          id: 'proof-timing',
          prompt: 'When should proof be captured?',
          options: ['Before arriving', 'At the stop before departure', 'At the end of the week'],
          correctOption: 1,
          explanation: 'Proof belongs to the stop and should be captured before departure.',
        },
        {
          id: 'failed-stop',
          prompt: 'What should a driver do when a stop cannot be completed?',
          options: ['Skip it silently', 'Use the exception path and notify Dispatch', 'Delete the stop'],
          correctOption: 1,
          explanation: 'Exceptions must stay attached to the operational record and be visible to Dispatch.',
        },
      ],
    },
  },
  {
    key: 'go-live',
    track: 'go-live',
    title: 'Complete launch readiness',
    summary: 'Confirm the practice evidence, escalation path, customer responsibilities, and first-30-day operating review.',
    audiences: ['CHAMPION', 'OWNER', 'ADMIN'],
    estimatedMinutes: 15,
    contentVersion: '1.2.0',
    lastReviewedAt: '2026-08-19',
    required: true,
    recertifyOnMajorVersion: true,
    videoSrc: '/training/go-live.mp4',
    captionsSrc: '/training/go-live.vtt',
    posterSrc: commonPoster,
    videoChapters: [
      { title: 'How readiness is calculated', startSeconds: 0, procedureIds: ['signoff-readiness'] },
      { title: 'Confirm training evidence', startSeconds: 28, procedureIds: ['signoff-readiness'] },
      { title: 'Confirm operating evidence', startSeconds: 57, procedureIds: ['signoff-readiness'] },
      { title: 'Rehearse support and exception ownership', startSeconds: 88, procedureIds: ['support-escalation'] },
      { title: 'Prepare week-one and day-30 measures', startSeconds: 118, procedureIds: ['review-kpis'] },
      { title: 'Submit signoff and request review', startSeconds: 150, procedureIds: ['signoff-readiness'] },
    ],
    task: {
      label: 'Review launch readiness',
      href: '/academy',
      completionHint: 'Confirm practice-route proof, support ownership, KPI baseline, and customer signoff.',
    },
    article: [
      {
        heading: 'Evidence before review',
        body: 'The workspace must show a depot, trained team, ready vehicle, validated jobs, provider-backed plan, dispatched practice route, and persisted proof.',
      },
      {
        heading: 'Readiness checkpoint',
        body: 'Use the included 30-minute review to confirm blockers, support ownership, route-day fallback procedures, and the exact production rollout date. It is not a general training session.',
      },
      {
        heading: 'First 30 days',
        body: 'Review time to plan, unassigned jobs, miles, late-risk stops, failed deliveries, proof completion, and support questions after week one and day 30.',
      },
    ],
    knowledgeCheck: {
      passingScore: 80,
      questions: [
        {
          id: 'review-purpose',
          prompt: 'What is the purpose of the launch-readiness review?',
          options: ['General team training', 'Confirm evidence, blockers, ownership, and launch timing', 'Clean customer data'],
          correctOption: 1,
          explanation: 'The checkpoint verifies that the self-guided implementation produced a launchable operating state.',
        },
        {
          id: 'first-month',
          prompt: 'When should the initial operating results be reviewed?',
          options: ['After week one and day 30', 'Only after one year', 'Before any route is planned'],
          correctOption: 0,
          explanation: 'Week-one and day-30 reviews expose adoption and process gaps early.',
        },
      ],
    },
  },
  {
    key: 'viewer-basics',
    track: 'viewer-basics',
    title: 'Viewer basics',
    summary: 'Use dashboard, tracking, proof, and reports without changing route-day records.',
    audiences: ['VIEWER'],
    estimatedMinutes: 5,
    contentVersion: '1.2.0',
    lastReviewedAt: '2026-08-19',
    required: false,
    recertifyOnMajorVersion: false,
    videoSrc: '/training/viewer-basics.mp4',
    captionsSrc: '/training/viewer-basics.vtt',
    posterSrc: commonPoster,
    videoChapters: [
      { title: 'Viewer role boundaries', startSeconds: 0, procedureIds: ['viewer-review'] },
      { title: 'Review route and tracking status', startSeconds: 27, procedureIds: ['viewer-review', 'monitor-route'] },
      { title: 'Inspect proof of delivery', startSeconds: 55, procedureIds: ['verify-proof'] },
      { title: 'Use reports with operating context', startSeconds: 84, procedureIds: ['review-kpis'] },
      { title: 'Ask for help safely', startSeconds: 116, procedureIds: ['support-escalation'] },
      { title: 'Complete Viewer knowledge check', startSeconds: 147, procedureIds: ['viewer-review'] },
    ],
    task: {
      label: 'Open dashboard',
      href: '/dashboard',
      completionHint: 'Locate active routes, exceptions, tracking, proof, and reports without editing records.',
    },
    article: [
      {
        heading: 'Read-only operating visibility',
        body: 'Viewers can inspect dashboard, route, tracking, proof, and report data. Contact an Owner, Admin, or Dispatcher when an operational record must change.',
      },
    ],
    knowledgeCheck: {
      passingScore: 80,
      questions: [
        {
          id: 'viewer-change',
          prompt: 'Who should a Viewer contact when a route must change?',
          options: ['A Dispatcher or Admin', 'The end customer', 'No one'],
          correctOption: 0,
          explanation: 'Viewer access is intentionally read-only.',
        },
      ],
    },
  },
] as const;

export const normalizeTrainingRoles = (roles: readonly string[] = []) =>
  Array.from(new Set(roles.map((role) => String(role).trim().toUpperCase()).filter(Boolean)));

export const getTrainingModulesForRoles = (roles: readonly string[] = []) => {
  const normalized = new Set(normalizeTrainingRoles(roles));
  const isChampion = normalized.has('OWNER') || normalized.has('ADMIN');
  return trovanTrainingCatalog.filter((module) =>
    module.audiences.some((audience) =>
      audience === 'CHAMPION' ? isChampion : normalized.has(audience),
    ),
  );
};

export const getMajorContentVersion = (version: string) => version.split('.')[0] || version;
