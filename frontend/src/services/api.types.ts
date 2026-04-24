import type {
  Driver as SharedDriver,
  Job as SharedJob,
  JsonValue,
  OptimizationObjective,
  Route as SharedRoute,
  Vehicle as SharedVehicle,
} from '@shared/contracts';
import type {
  DispatchDriver,
  DispatchJob,
  DispatchVehicle,
} from '../types/dispatch';

export type JsonRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const clonePreview = <T,>(seed: T): T =>
  JSON.parse(JSON.stringify(seed));

export const getErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
};

export type StructuredAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
};

export type JobRecord = Omit<
  SharedJob,
  | 'pickupAddressStructured'
  | 'deliveryAddressStructured'
  | 'pickupLocation'
  | 'deliveryLocation'
  | 'timeWindow'
> & {
  customerId?: string;
  pickupAddress?: string;
  deliveryAddress: string;
  pickupAddressStructured?: StructuredAddress | null;
  deliveryAddressStructured?: StructuredAddress | null;
  pickupLocation?: JsonRecord | null;
  deliveryLocation?: JsonRecord | null;
  timeWindow?: { start: string; end: string };
  assignedVehicleId?: string | null;
  stopSequence?: number | null;
};

export type RouteStopLocation = {
  latitude: number;
  longitude: number;
};

export type RouteStopRecord = {
  jobId: string;
  sequence: number;
  address: string;
  location?: RouteStopLocation;
};

export type RouteRecord = Omit<SharedRoute, 'routeData' | 'polyline'> & {
  totalDistance?: number | null;
  totalDuration?: number | null;
  polyline?: JsonValue | null;
  optimizedStops?: RouteStopRecord[];
  routeData?: JsonRecord | null;
  dataQuality?: 'live' | 'degraded' | 'simulated';
  optimizationStatus?: 'optimized' | 'degraded' | 'failed';
  planningWarnings?: string[];
  droppedJobIds?: string[];
  plannerDiagnostics?: JsonRecord;
  simulated?: boolean;
  rerouteState?: string | null;
  pendingRerouteRequestId?: string | null;
  exceptionCategory?: string | null;
  constraintPackId?: string | null;
  estimatedCapacity?: number;
  optimizedAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
};

export type DriverRecord = SharedDriver &
  Partial<Pick<DispatchDriver, 'currentHours' | 'maxHours'>> & {
    licenseType?: string | null;
    assignedVehicleId?: string | null;
    notes?: string | null;
  };

export type VehicleRecord = SharedVehicle &
  Partial<Pick<DispatchVehicle, 'capacity'>> & {
    type?: string | null;
    weightCapacity?: string | number | null;
    volumeCapacity?: string | number | null;
    territoryRestriction?: string | null;
    maxRouteMinutes?: string | number | null;
  };

export type OptimizerHealth = {
  status: 'healthy' | 'degraded' | 'unavailable';
  circuitOpen: boolean;
  consecutiveFailures: number;
  lastCheckedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  message?: string;
};

export type OptimizerEvent = {
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  fallbackUsed: boolean;
  timestamp: string;
};

export type DispatchTimelineEvent = {
  id: string;
  routeId?: string | null;
  source: 'optimizer' | 'reroute' | 'workflow' | 'system';
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  payload?: JsonRecord | null;
  reasonCode?: string | null;
  action?: string | null;
  actor?: string | null;
  packId?: string | null;
  createdAt: string;
};

export type RerouteConstraintDiagnostics = {
  feasible: boolean;
  reasonCodes: string[];
  infeasibleJobReasonCodes: Record<string, string[]>;
  impactedJobIds: string[];
  impactedStopIds: string[];
  capacityConflicts: Array<{
    metric: 'weight_kg' | 'volume_m3';
    demand: number;
    capacity: number;
    overBy: number;
  }>;
  timeWindowViolations: Array<{
    jobId: string;
    eta: string;
    windowStart: string;
    windowEnd: string;
    latenessMinutes: number;
  }>;
  skillMismatches: Array<{
    jobId: string;
    requiredSkills: string[];
    availableSkills: string[];
  }>;
  warnings: string[];
  selectedPackId?: string | null;
  packDiagnostics?: Array<{
    packId: string;
    feasible: boolean;
    reasonCodes: string[];
    warnings: string[];
    details?: JsonRecord;
  }>;
  feasibilityScore?: number;
  conflictSummary?: {
    critical: number;
    major: number;
    minor: number;
    total: number;
  };
};

export type ReroutePreviewAlternative = {
  action: string;
  label: string;
  summary: string;
  feasible: boolean;
  score: number;
  rank: number;
  rationale: string;
  tradeoffs: string[];
};

export type ReroutePreview = {
  beforeSnapshot: JsonRecord;
  afterSnapshot: JsonRecord;
  impactSummary: JsonRecord;
  impliedDataQuality: 'live' | 'degraded' | 'simulated';
  impliedOptimizationStatus: 'optimized' | 'degraded' | 'failed';
  impliedWorkflowStatus: string;
  dispatchBlocked: boolean;
  constraintDiagnostics: RerouteConstraintDiagnostics;
  alternatives: ReroutePreviewAlternative[];
  feasibilitySummary?: {
    score: number;
    feasible: boolean;
    rationale: string;
  };
};

export type RerouteRequest = {
  id: string;
  routeId: string;
  exceptionCategory: string;
  action: string;
  status: 'requested' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  reason: string;
  requestPayload?: JsonRecord | null;
  beforeSnapshot?: JsonRecord | null;
  afterSnapshot?: JsonRecord | null;
  impactSummary?: JsonRecord | null;
  plannerDiagnostics?: JsonRecord | null;
  requesterId?: string | null;
  reviewerId?: string | null;
  reviewNote?: string | null;
  appliedBy?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  appliedAt?: string | null;
  createdAt?: string;
};

export type TrackingVehicleLocation = {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  vehicleInfo?: {
    licensePlate?: string;
    make?: string;
    model?: string;
    status?: string;
    vehicleType?: string;
  };
};

export type TrackingLocationsSnapshot = {
  vehicles: TrackingVehicleLocation[];
  timestamp: string;
  count: number;
};

export type TrackingStatistics = {
  totalRecords: number;
  vehiclesTracked: number;
  oldestRecord?: string;
  newestRecord?: string;
};

export type TrackingReadiness = {
  ready: boolean;
  checkedAt: string;
  organizationId?: string;
  summary: {
    telemetryRecords: number;
    vehiclesTracked: number;
    activeVehicles: number;
    latestTelemetryAt?: string;
  };
};

export type RouteVersionStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'SUPERSEDED';

export type RouteVersion = {
  id: string;
  routeId: string;
  versionNumber: number;
  status: RouteVersionStatus;
  snapshot: JsonRecord;
  createdByUserId?: string | null;
  reviewedByUserId?: string | null;
  approvedByUserId?: string | null;
  publishedByUserId?: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
};

export type PlannerRoutePlan = {
  id: string;
  serviceDate: string;
  status: string;
  objective: OptimizationObjective;
  metrics?: JsonRecord;
  warnings?: Array<string | JsonRecord>;
};

export type PlannerRoutePlanGroup = {
  id: string;
  routePlanId: string;
  groupIndex: number;
  label: string;
  driverId?: string | null;
  vehicleId?: string | null;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  serviceTimeMinutes?: number;
  totalWeightKg?: number;
  totalVolumeM3?: number;
  warnings?: Array<string | JsonRecord>;
};

export type PlannerRoutePlanStop = {
  id: string;
  routePlanId: string;
  routePlanGroupId: string;
  jobId: string;
  jobStopId: string;
  stopSequence: number;
  isLocked: boolean;
  plannedArrival?: string | null;
  plannedDeparture?: string | null;
  metadata?: JsonRecord;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  serviceTimezone?: string;
  settings?: OrganizationSettingsRecord;
  membership?: { role?: string; roles?: string[] };
};

export type OrganizationBrandingRecord = {
  brandName?: string;
  primaryColor?: string;
  accentColor?: string;
  supportEmail?: string;
  supportPhone?: string;
  trackingHeadline?: string;
  trackingSubtitle?: string;
};

export type OrganizationSettingsRecord = {
  branding: OrganizationBrandingRecord;
  notifications?: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    replyToEmail?: string;
    defaultChannel?: 'email' | 'sms' | 'both';
  };
  retention?: {
    auditDays?: number;
    operationalDays?: number;
  };
  identity?: {
    workosOrganizationId?: string;
    workosConnectionId?: string;
    domainVerificationStatus?: 'unverified' | 'pending' | 'verified';
    ssoEnforced?: boolean;
    mfaEnforced?: boolean;
  };
};

export type AuthConfigurationRecord = {
  enabled: boolean;
  configured: boolean;
  localLoginAllowed: boolean;
  preferredProvider: 'workos' | 'local-config';
  workos: {
    apiKeyConfigured: boolean;
    authkitDomain?: string | null;
    clientIdConfigured: boolean;
    connectionIdConfigured: boolean;
    mfaManagedByProvider: boolean;
    redirectUri?: string | null;
    ssoReady: boolean;
  };
};

export type AuthSessionRecord = {
  id: string;
  email: string;
  authProvider: string;
  providerSessionId?: string | null;
  current: boolean;
  roles: string[];
  userAgent?: string | null;
  ipAddress?: string | null;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OrganizationMemberRecord = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  roles: string[];
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    email: string;
    displayName: string;
    authProvider: string;
    externalId?: string | null;
    isActive: boolean;
  } | null;
};

export type OrganizationInvitationRecord = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  roles: string[];
  status: string;
  provider: string;
  providerInvitationId?: string | null;
  acceptUrl?: string | null;
  providerState?: string | null;
  lastError?: string | null;
  invitedByUserId?: string | null;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PlatformApiKeyRecord = {
  id: string;
  organizationId: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PlatformWebhookRecord = {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  subscribedEvents: string[];
  status: 'ACTIVE' | 'PAUSED';
  lastDeliveryAt?: string | null;
  lastFailure?: string | null;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PlatformWebhookDeliveryRecord = {
  id: string;
  endpointId: string;
  organizationId: string;
  eventType: string;
  status: string;
  requestId?: string | null;
  attempts: number;
  responseStatus?: number | null;
  failureReason?: string | null;
  payload: JsonRecord;
  deliveredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AnalyticsOverviewRecord = {
  generatedAt: string;
  serviceLevel: {
    onTimeRate: number;
    proofCaptureRate: number;
    exceptionRate: number;
    completedRouteRunsLast7Days: number;
  };
  operations: {
    totalRouteRuns: number;
    activeRouteRuns: number;
    plannedRouteRuns: number;
    averageRouteDistanceKm: number;
    averageRouteDurationMinutes: number;
  };
  fleet: {
    totalVehicles: number;
    activeVehicles: number;
    vehiclesReportingRecently: number;
    totalDrivers: number;
    activeDrivers: number;
  };
  workload: {
    totalStops: number;
    servicedStops: number;
    openExceptions: number;
  };
  routeStatusBreakdown: Array<{ status: string; count: number }>;
  exceptionStatusBreakdown: Array<{ status: string; count: number }>;
};

export type DriverManifestStopRecord = {
  id: string;
  stopSequence: number;
  status: string;
  plannedArrival?: string | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  notes?: string | null;
};

export type DriverManifestRouteRecord = {
  routeRun: {
    id: string;
    status: string;
    workflowStatus?: string | null;
    plannedStart?: string | null;
    completedAt?: string | null;
    totalDistanceKm?: number | null;
    totalDurationMinutes?: number | null;
    vehicleId?: string | null;
  };
  stops: DriverManifestStopRecord[];
  vehicle?: {
    id: string;
    make: string;
    model: string;
    licensePlate: string;
    status?: string | null;
  } | null;
  latestTelemetry?: {
    latitude: number;
    longitude: number;
    speed?: number | null;
    heading?: number | null;
    timestamp: string;
  } | null;
  progress: {
    totalStops: number;
    completedStops: number;
    remainingStops: number;
    nextStopId?: string | null;
  };
};

export type DriverManifestRecord = {
  generatedAt: string;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    currentVehicleId?: string | null;
  };
  routes: DriverManifestRouteRecord[];
};

export type PublicTrackingRecord = {
  organization: {
    id: string;
    name: string;
    slug: string;
    branding: OrganizationBrandingRecord;
  };
  routeRun: {
    id: string;
    status: string;
    workflowStatus?: string | null;
    plannedStart?: string | null;
    actualStart?: string | null;
    completedAt?: string | null;
    eta?: string | null;
    jobCount?: number | null;
    vehicleId?: string | null;
  };
  stops: DriverManifestStopRecord[];
  vehicle?: {
    id: string;
    make: string;
    model: string;
    licensePlate: string;
    status?: string | null;
  } | null;
  latestTelemetry?: {
    latitude: number;
    longitude: number;
    speed?: number | null;
    heading?: number | null;
    timestamp: string;
  } | null;
  expiresAt: string;
};

export type AuditLogRecord = {
  id: string;
  organizationId?: string | null;
  actorId: string;
  actorType: string;
  entityType: string;
  entityId: string;
  action: string;
  source: string;
  createdAt: string;
};

export type AuditOverviewRecord = {
  generatedAt: string;
  controls: {
    requestIdsEnabled: boolean;
    structuredRequestLogging: boolean;
    sensitiveFieldRedaction: boolean;
    authMode: string;
    auditRetentionDays: number;
    dispatchEventRetentionDays: number;
  };
  counts: {
    totalEntries: number;
    last24hEntries: number;
    last7dEntries: number;
  };
  actionBreakdown: Array<{
    action: string;
    count: number;
  }>;
  recentEntries: AuditLogRecord[];
};

export type BillingSubscriptionRecord = {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
};

export type BillingPlanRecord = {
  plan: string;
  label: string;
  monthlyPriceUsd: number;
  dispatcherSeats: number;
  features: string[];
  stripePriceConfigured: boolean;
};

export type BillingOverviewRecord = {
  generatedAt: string;
  stripeConfigured: boolean;
  organizationId?: string | null;
  billingContactEmail?: string | null;
  activeSubscription?: BillingSubscriptionRecord | null;
  subscriptions: BillingSubscriptionRecord[];
  plans: BillingPlanRecord[];
  controls: {
    invoiceAutomationReady: boolean;
    failedPaymentHandlingReady: boolean;
    webhookConfigured: boolean;
  };
  recommendations: string[];
};

export type PreviewState = {
  jobs: DispatchJob[];
  routes: RouteRecord[];
  drivers: DispatchDriver[];
  vehicles: DispatchVehicle[];
  optimizerHealth: OptimizerHealth;
  timeline: DispatchTimelineEvent[];
  routeVersions: Record<string, RouteVersion[]>;
  rerouteHistory: Record<string, RerouteRequest[]>;
};
