import type { SvgIconComponent } from '@mui/icons-material';
import {
  AssignmentTurnedInRounded,
  ArrowForwardRounded,
  CheckCircleRounded,
  CloudDoneRounded,
  ContactSupportRounded,
  DirectionsCarRounded,
  FactCheckRounded,
  ForumRounded,
  GavelRounded,
  HubRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  LockRounded,
  MapRounded,
  RouteRounded,
  SecurityRounded,
  ShieldRounded,
  SupportAgentRounded,
  TimelineRounded,
  VerifiedUserRounded,
} from '@mui/icons-material';

export type FleetSizeKey = '5–15' | '16–35' | '36–75' | '76–150' | '151–300' | '300+ / Custom';
export type DailyStopsKey = '50' | '125' | '250';
export type PainKey = 'planning' | 'updates' | 'etas' | 'windows';
export type RequestType =
  | 'Route audit'
  | 'Book demo'
  | 'Sales question'
  | 'Implementation'
  | 'Support / login help'
  | 'Security review'
  | 'Careers interest';

export type AuditInputs = {
  fleetSize: FleetSizeKey;
  dailyStops: DailyStopsKey;
  pain: PainKey;
};

export type RequestModalDefaults = {
  requestType: RequestType;
  fleetSize?: FleetSizeKey;
  notes?: string;
};

export type PublicRoute = {
  path: string;
  label: string;
};

export type WorkflowKey = 'plan' | 'dispatch' | 'drive' | 'track' | 'proof';

export type WorkflowPage = {
  key: WorkflowKey;
  path: string;
  navLabel: string;
  heading: string;
  eyebrow: string;
  body: string;
  problem: string;
  outcome: string;
  image: string;
  imageAlt: string;
  capabilities: string[];
  metrics: Array<{ label: string; value: string }>;
  icon: SvgIconComponent;
};

export const cookiePreferenceDefaults = {
  essential: true,
  analytics: false,
  marketing: false,
};

export const publicMarketingRoutes: PublicRoute[] = [
  { path: '/', label: 'Home' },
  { path: '/platform', label: 'Platform' },
  { path: '/platform/plan', label: 'Plan routes' },
  { path: '/platform/dispatch', label: 'Dispatch live' },
  { path: '/platform/drive', label: 'Driver app' },
  { path: '/platform/track', label: 'Customer tracking & ETA' },
  { path: '/platform/proof', label: 'Proof & analytics' },
  { path: '/demo', label: 'Demo' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/testimonials', label: 'Testimonials' },
  { path: '/security', label: 'Security' },
  { path: '/resources', label: 'Resources' },
  { path: '/support', label: 'Support' },
  { path: '/company', label: 'Company' },
  { path: '/mission', label: 'Mission' },
  { path: '/careers', label: 'Careers' },
  { path: '/legal/privacy', label: 'Privacy Policy' },
  { path: '/legal/terms', label: 'Terms of Service' },
  { path: '/legal/cookies', label: 'Cookie Policy' },
  { path: '/legal/exercise-rights', label: 'Privacy Rights Request' },
  { path: '/resources/downloads', label: 'Downloads' },
];

export const fleetSizeOptions: Array<{ label: FleetSizeKey; description: string }> = [
  { label: '5–15', description: 'Owner-led routes' },
  { label: '16–35', description: 'Growing dispatch team' },
  { label: '36–75', description: 'Multi-route operation' },
  { label: '76–150', description: 'Regional fleet' },
  { label: '151–300', description: 'Multi-market operation' },
  { label: '300+ / Custom', description: 'Enterprise rollout' },
];

export const dailyStopOptions: Array<{ label: DailyStopsKey; description: string }> = [
  { label: '50', description: 'Light daily plan' },
  { label: '125', description: 'Dense local routes' },
  { label: '250', description: 'High-volume delivery' },
];

export const painOptions: Array<{ key: PainKey; label: string; description: string }> = [
  { key: 'planning', label: 'Planning time', description: 'Routes take too long to build.' },
  { key: 'updates', label: 'Driver updates', description: 'Dispatch is chasing route status.' },
  { key: 'etas', label: 'Customer ETAs', description: 'Customers keep asking where orders are.' },
  { key: 'windows', label: 'Missed windows', description: 'Stops slip without early warning.' },
];

export const requestTypeOptions: RequestType[] = [
  'Route audit',
  'Book demo',
  'Sales question',
  'Implementation',
  'Support / login help',
  'Security review',
  'Careers interest',
];

export const workflowPages: WorkflowPage[] = [
  {
    key: 'plan',
    path: '/platform/plan',
    navLabel: 'Plan routes',
    heading: 'Build routes your team can actually run.',
    eyebrow: 'Planning workspace',
    body: 'Import stops, apply constraints, balance workload, and create dispatch-ready routes before the day starts.',
    problem: 'Late route plans force dispatchers to fix preventable problems while drivers are already waiting.',
    outcome: 'A planning workspace that shows imported stops, lane balance, route risk, and map context before publish.',
    image: '/marketing/routing-workspace-dotted.png',
    imageAlt: 'Trovan route planning workspace with imported stops, draft lanes, and connected route map',
    capabilities: ['Import stops from CSV or order-system exports', 'Set time windows, capacity, territories, and driver limits', 'Compare route versions before sending approved routes to dispatch'],
    metrics: [
      { label: 'Planning mode', value: 'before dispatch' },
      { label: 'Route logic', value: 'constraints + balance' },
      { label: 'Best fit', value: 'dense route days' },
    ],
    icon: RouteRounded,
  },
  {
    key: 'dispatch',
    path: '/platform/dispatch',
    navLabel: 'Dispatch live',
    heading: 'Run the route day from one live board.',
    eyebrow: 'Live dispatch board',
    body: 'See route progress, driver status, exceptions, and late-risk stops without chasing updates across calls and texts.',
    problem: 'Dispatcher chaos starts when driver status, exceptions, notes, and route changes live in different places.',
    outcome: 'A live dispatch board that keeps assignments, route progress, exception flags, and same-day changes visible.',
    image: '/marketing/dispatch-board.png',
    imageAlt: 'Trovan live dispatch board with route progress, driver status, and exception context',
    capabilities: ['Monitor live route progress by lane and driver', 'Handle exceptions without losing route context', 'Reassign or rebalance work while keeping a proof trail'],
    metrics: [
      { label: 'Dispatch state', value: 'live' },
      { label: 'Exception handling', value: 'in context' },
      { label: 'Best fit', value: 'dispatcher teams' },
    ],
    icon: TimelineRounded,
  },
  {
    key: 'drive',
    path: '/platform/drive',
    navLabel: 'Driver app',
    heading: 'Give drivers the next best action.',
    eyebrow: 'Driver mobile app',
    body: 'Drivers get their route, stop details, customer notes, navigation, and proof capture in a simple mobile workflow.',
    problem: 'Drivers should not need dispatcher screens, text threads, or paper notes to know what happens next.',
    outcome: 'A driver-only mobile route flow for the next stop, notes, completion, skip reasons, and proof capture.',
    image: '/marketing/driver-workspace.png',
    imageAlt: 'Trovan Driver mobile app showing next stop, route notes, and completion actions',
    capabilities: ['Show the next stop, customer notes, and navigation context', 'Capture complete, skip, notes, signature, photo, or document proof', 'Keep driver updates attached to route history'],
    metrics: [
      { label: 'Mobile flow', value: 'driver-only' },
      { label: 'Proof capture', value: 'route-tied' },
      { label: 'Best fit', value: 'field drivers' },
    ],
    icon: LocalShippingRounded,
  },
  {
    key: 'track',
    path: '/platform/track',
    navLabel: 'Customer tracking & ETA',
    heading: 'Keep customers updated before they call.',
    eyebrow: 'Customer visibility',
    body: 'Share delivery status, ETA, and proof updates so customers know what is happening without calling dispatch.',
    problem: 'Where-is-my-order calls steal dispatcher time when route progress is invisible to customers and support.',
    outcome: 'A customer-facing tracking page that turns live route events into clear status and ETA context.',
    image: '/marketing/tracking-workspace.png',
    imageAlt: 'Trovan customer tracking page with ETA, delivery status timeline, and support context',
    capabilities: ['Share customer ETA and route-progress status', 'Show delivery-complete state and proof context when available', 'Give support a consistent page for delivery questions'],
    metrics: [
      { label: 'Customer view', value: 'public link' },
      { label: 'Support load', value: 'fewer calls' },
      { label: 'Best fit', value: 'ETA-heavy routes' },
    ],
    icon: MapRounded,
  },
  {
    key: 'proof',
    path: '/platform/proof',
    navLabel: 'Proof & analytics',
    heading: 'Know what happened on every route.',
    eyebrow: 'Completion evidence',
    body: 'Capture timestamps, photos, notes, driver updates, and delivery outcomes so your team can resolve questions quickly.',
    problem: 'Missed proof, scattered notes, and unclear delivery outcomes create avoidable disputes after the route ends.',
    outcome: 'A completed-route record with timestamps, proof records, exception notes, and delivery outcomes in one place.',
    image: '/marketing/proof-workspace.png',
    imageAlt: 'Trovan proof summary showing completed route records, timestamps, notes, and proof of delivery',
    capabilities: ['Review completed route records with proof and timestamps', 'Keep exception notes and failed-delivery reasons attached', 'Use route history to support customer follow-up and coaching'],
    metrics: [
      { label: 'Evidence', value: 'attached' },
      { label: 'Review path', value: 'auditable' },
      { label: 'Best fit', value: 'proof-sensitive work' },
    ],
    icon: AssignmentTurnedInRounded,
  },
];

export const problemOutcomes = [
  {
    icon: RouteRounded,
    pain: 'Late routes',
    outcome: 'Routes planned before the day breaks',
    body: 'Build drafts around capacity, service windows, territories, and delivery density before dispatch is under pressure.',
  },
  {
    icon: TimelineRounded,
    pain: 'Dispatcher chaos',
    outcome: 'One live board for the route day',
    body: 'See route status, driver progress, exceptions, and same-day changes without rebuilding the day from texts.',
  },
  {
    icon: LocalShippingRounded,
    pain: 'Missed proof',
    outcome: 'Simple driver execution',
    body: 'Give drivers a focused stop-by-stop mobile workflow for arrival, notes, completion, skip reasons, and proof.',
  },
  {
    icon: CheckCircleRounded,
    pain: 'Where-is-my-order calls',
    outcome: 'Customer tracking and proof',
    body: 'Keep customers informed with ETA context and delivery proof attached to the route run.',
  },
];

export const auditDeliverables = [
  ['Route-day review', 'How one real route day moves from order intake to route plan, dispatch handoff, driver execution, and proof.'],
  ['Waste and late-risk map', 'Where miles, planning time, service-window risk, and preventable late stops show up.'],
  ['Dispatch bottleneck scan', 'Where driver updates, urgent changes, exception notes, and customer calls slow the day down.'],
  ['Proof and support gap', 'Where ETA, proof, failed delivery reasons, and customer communication break down.'],
  ['Rollout plan', 'What Trovan would need to connect first before a larger production rollout.'],
] as const;

export const pricingPlans = [
  {
    name: 'Launch',
    price: '$399',
    cta: 'Request Launch setup',
    requestType: 'Implementation' as RequestType,
    helperText: 'Launch onboarding is currently reviewed before activation.',
    body: 'For local delivery teams proving route discipline.',
    features: ['Route planning workspace', 'Driver mobile flow', 'Public tracking links'],
  },
  {
    name: 'Scale',
    price: '$899',
    cta: 'Book ROI walkthrough',
    requestType: 'Book demo' as RequestType,
    body: 'For operators that need live dispatch, customer visibility, route history, and exception control.',
    features: ['Dispatch command center', 'Customer and fleet records', 'Analytics and route history'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cta: 'Review route-day ROI',
    requestType: 'Sales question' as RequestType,
    body: 'For multi-team fleets with security review, implementation planning, API needs, and support requirements.',
    features: ['Security review support', 'Webhook and API access', 'Implementation readiness plan'],
  },
];

export const securityControlCopy = [
  'Role-based access separates owner, admin, dispatcher, driver, and viewer workflows.',
  'Audit logs, route events, and request IDs help operators review changes and support incidents.',
  'Sensitive-field redaction is used for passwords, tokens, emails, phones, payment identifiers, and operational request logs.',
  'Rate limiting, explicit CORS origins, signed webhook verification, environment-secret handling, and backup/restore posture are part of the verified baseline.',
  'Data ownership, retention, DPA requests, and subprocessors should be reviewed during vendor diligence before production launch.',
  'SSO/SAML, formal audit claims, uptime SLAs, data residency, and encryption details are not claimed here unless confirmed in the customer agreement or security review.',
];

export const securityControls = [
  { icon: VerifiedUserRounded, title: 'Role-based access control', body: 'Owner, admin, dispatcher, driver, and viewer workflows stay separated so users see the right route-day surface.' },
  { icon: FactCheckRounded, title: 'Audit logs and request IDs', body: 'Route events, audit trails, and request IDs give support and operations a review path when something changes.' },
  { icon: ShieldRounded, title: 'Data handling and redaction', body: 'Sensitive fields are redacted in logs, and production secrets are expected from environment configuration.' },
  { icon: LockRounded, title: 'Operational guardrails', body: 'Rate limiting, CORS origin control, signed webhook verification, and backup/restore posture are represented in the baseline.' },
];

export const testimonialProofItems = [
  {
    title: 'Clearer planning handoff',
    body: 'Turn recurring dense stops into route lanes dispatchers can review before driver assignment.',
    outcome: 'Clearer planning handoff',
  },
  {
    title: 'Fewer status chases',
    body: 'See route progress, exceptions, and driver status without piecing together text threads.',
    outcome: 'Fewer status chases',
  },
  {
    title: 'More visible delivery status',
    body: 'Give customers ETA and delivery updates so support can focus on real exceptions.',
    outcome: 'More visible delivery status',
  },
];

export const resourceCards = [
  { icon: ArrowForwardRounded, title: 'Product walkthrough', body: 'See how one route day moves from imported stops to dispatch, driver execution, customer tracking, and proof.', href: '/demo' },
  { icon: RouteRounded, title: 'Route audit checklist', body: 'Prepare one real route day so Trovan can review wasted miles, late-risk stops, and dispatch bottlenecks.', href: '/resources/downloads' },
  { icon: TimelineRounded, title: 'Dispatch readiness checklist', body: 'Review the route handoff, driver status flow, exception handling, and support path before rollout.', href: '/resources/downloads' },
  { icon: Inventory2Rounded, title: 'Buyer guide', body: 'How to evaluate route planning software around planning, live dispatch, driver proof, and customer visibility.', href: '/resources/downloads' },
  { icon: CloudDoneRounded, title: 'Implementation checklist', body: 'Map first-route rollout steps: imports, depots, drivers, permissions, pilot day, training, and KPIs.', href: '/support' },
  { icon: FactCheckRounded, title: 'ROI calculator', body: 'Estimate route-day savings from minutes saved, miles reduced, and failed deliveries avoided.', href: '/pricing' },
  { icon: SecurityRounded, title: 'Security overview', body: 'Review RBAC, audit logs, request IDs, redaction, guardrails, DPA questions, and security review paths.', href: '/security' },
  { icon: ContactSupportRounded, title: 'Support hub', body: 'Login help, implementation questions, security review, and account-access paths without a fake ticket system.', href: '/support' },
];

export const supportTopics = [
  { icon: SupportAgentRounded, title: 'Login and access help', body: 'Use support/login help when your team cannot reach the route workspace or needs access reviewed.' },
  { icon: HubRounded, title: 'Implementation questions', body: 'Ask about imports, current systems, route proof, customer updates, or first rollout sequencing.' },
  { icon: ForumRounded, title: 'Sales and demo follow-up', body: 'Book a walkthrough around your planning, dispatch, driver execution, and tracking workflows.' },
];

export const legalPages = {
  privacy: {
    heading: 'Privacy Policy',
    body: 'Trovan handles route, driver, customer, and operational data for last-mile planning, dispatch, tracking, and proof workflows. Counsel review is recommended before launch; this page is written for product-specific buyer diligence.',
    sections: [
      ['Company and contact', 'TryTrovan public requests can be routed through the support, sales, security review, or privacy-rights request paths until a dedicated legal contact is finalized.'],
      ['Data we expect to process', 'Account information, company users, route records, stop details, driver and vehicle records, customer delivery information, location/ETA context, proof-of-delivery photos, signatures, notes, support requests, and operational logs needed to provide the service.'],
      ['Customer data and end-customer data', 'Trovan customers control the route, delivery, driver, proof, and end-customer records they submit to the service. Trovan uses that data to provide routing, dispatch, tracking, proof, support, implementation, security review, and account administration.'],
      ['Cookies and analytics', 'Essential preferences are supported. Analytics and marketing categories are off by default until configured and should not load before consent preferences are honored.'],
      ['Subprocessors and security practices', 'Subprocessors, DPAs, retention, deletion, and security review materials are covered with Trovan before production use. Public security details are summarized on the Security page.'],
      ['Choices and requests', 'Teams can contact Trovan for access, correction, deletion, export, or other privacy-rights requests through the Privacy Rights Request path.'],
    ],
  },
  terms: {
    heading: 'Terms of Service',
    body: 'These terms describe expected service usage boundaries for TryTrovan public review. Commercial terms, subscription details, and security attachments should be confirmed in the signed customer agreement.',
    sections: [
      ['Use of service', 'Trovan is intended for legitimate route planning, dispatch, delivery tracking, driver execution, proof, analytics, and operational review workflows.'],
      ['Subscriptions, payment, and cancellation', 'Subscription, payment, cancellation, support, and implementation terms should be defined in the customer agreement or order form. Public pricing is directional until reviewed with Trovan.'],
      ['Customer responsibilities', 'Customers are responsible for accurate account users, route data, customer permissions, driver/customer communications, and compliance with their own delivery obligations.'],
      ['Data ownership and confidentiality', 'Customers retain responsibility for the data they provide. Trovan should protect confidential operational data according to the security and commercial terms agreed with each customer.'],
      ['Acceptable use and beta features', 'The service should not be used for unlawful activity, unauthorized tracking, or unsupported production workflows. Beta or preview features may change before general availability.'],
      ['Availability and changes', 'Trovan may improve product surfaces, security controls, integrations, support paths, and pricing as the service matures.'],
    ],
  },
  cookies: {
    heading: 'Cookie Policy',
    body: 'Trovan prepares preference controls for essential, analytics, and marketing categories. Analytics and marketing remain off by default until those tools are configured.',
    sections: [
      ['Essential storage', 'Essential browser storage supports auth/session behavior, preview state, and saved preferences.'],
      ['Analytics', 'Analytics storage is optional and off by default in this pass.'],
      ['Marketing', 'Marketing storage is optional and off by default in this pass.'],
      ['Changing preferences', 'Use Cookie preferences in the footer to update stored preferences. Essential storage remains on because it is required for core site behavior.'],
    ],
  },
  rights: {
    heading: 'Privacy Rights Request',
    body: 'Use this page to request access, correction, deletion, export, or review of personal or operational information associated with Trovan.',
    sections: [
      ['Submit a request', 'Use the support or privacy request path with your work email, company, request type, and the details needed to identify the account or record.'],
      ['Verification', 'Trovan may need to verify account association before acting on data requests.'],
      ['Response path', 'Requests are routed through support or implementation review until a dedicated privacy operations workflow is configured.'],
    ],
  },
};

export const downloadCards = [
  { icon: Inventory2Rounded, title: 'Route audit checklist', body: 'Prepare route volume, current planning tools, driver handoff, customer update flow, proof gaps, and one sample route day.', href: '/resources' },
  { icon: TimelineRounded, title: 'Dispatch readiness checklist', body: 'Review route publish steps, driver status updates, exception ownership, same-day changes, and support escalation.', href: '/platform/dispatch' },
  { icon: CloudDoneRounded, title: 'Implementation checklist', body: 'Plan imports, depots, drivers, permissions, pilot route day, training, rollout KPIs, and review cadence.', href: '/support' },
  { icon: FactCheckRounded, title: 'ROI calculator', body: 'Estimate labor, mileage, and failed-delivery savings before a deeper route audit.', href: '/pricing' },
  { icon: GavelRounded, title: 'Policy center', body: 'Privacy Policy, Terms of Service, Cookie Policy, and Privacy Rights Request pages for public review.', href: '/legal/privacy' },
  { icon: DirectionsCarRounded, title: 'Workflow pages', body: 'Plan routes, dispatch live, driver app, customer tracking, and proof pages with product screenshots.', href: '/platform/plan' },
];

export const missionGoals = [
  { title: 'Plan the day', body: 'Operators should know which routes are ready, which need review, and where waste or late risk exists before dispatch.' },
  { title: 'Run the day', body: 'Dispatchers and drivers should work from one shared operating picture instead of text threads, spreadsheets, and paper notes.' },
  { title: 'Prove every stop', body: 'Proof, exceptions, timestamps, and customer updates should stay attached to the route record after delivery.' },
  { title: 'Earn expansion through proof', body: 'Trovan starts with a real route audit and grows only when the product proves value in the route day.' },
];

export const footerGroups = [
  {
    label: 'Product',
    links: [
      { label: 'Platform', href: '/platform' },
      { label: 'Plan routes', href: '/platform/plan' },
      { label: 'Dispatch live', href: '/platform/dispatch' },
      { label: 'Driver app', href: '/platform/drive' },
      { label: 'Customer tracking & ETA', href: '/platform/track' },
      { label: 'Proof & analytics', href: '/platform/proof' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'About', href: '/company' },
      { label: 'Mission', href: '/mission' },
      { label: 'Careers', href: '/careers' },
      { label: 'Testimonials', href: '/testimonials' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { label: 'Product walkthrough', href: '/demo' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Resources', href: '/resources' },
      { label: 'Downloads', href: '/resources/downloads' },
      { label: 'Support', href: '/support' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Cookie Policy', href: '/legal/cookies' },
      { label: 'Privacy Rights Request', href: '/legal/exercise-rights' },
    ],
  },
];

export function getWorkflowByPath(pathname: string) {
  return workflowPages.find((item) => item.path === pathname);
}

export function getAuditSnapshot(inputs: AuditInputs) {
  const stopFactor = inputs.dailyStops === '50' ? 1 : inputs.dailyStops === '125' ? 2 : 3;
  const fleetFactor =
    inputs.fleetSize === '5–15'
      ? 1
      : inputs.fleetSize === '16–35'
        ? 2
        : inputs.fleetSize === '36–75'
          ? 3
          : inputs.fleetSize === '76–150'
            ? 4
            : 5;
  const planningHours = 3 + stopFactor + fleetFactor;
  const routesToReview = Math.max(2, fleetFactor + stopFactor);
  const updateGaps =
    inputs.pain === 'etas' ? 'High' : inputs.pain === 'updates' ? 'Medium-high' : 'Medium';
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
