import type {
  DriverConstraintRequirements,
  PalletLoadUnit,
  StopSequenceConstraint,
  VehicleConstraintRequirements,
} from './fleetConstraints';

export type JobRoutingReadinessStatus =
  | 'routable'
  | 'missing_data'
  | 'capacity_risk'
  | 'access_risk'
  | 'appointment_risk';

export type JobRoutingReadinessSeverity = 'ok' | 'warning' | 'blocked';

export type JobLoadRequirements = {
  palletCount?: number | null;
  palletLengthIn?: number | null;
  palletWidthIn?: number | null;
  palletHeightIn?: number | null;
  palletWeightLb?: number | null;
  totalWeightKg?: number | null;
  totalVolumeM3?: number | null;
  stackable?: boolean | null;
  maxStackLevels?: number | null;
  fragile?: boolean | null;
  maxStackHeightIn?: number | null;
  palletGroups?: PalletLoadUnit[] | null;
};

export type JobSiteRequirements = {
  accessNotes?: string | null;
  accessCode?: string | null;
  accessCodeConfigured?: boolean | null;
  accessCodeEncrypted?: {
    version: 1;
    keyVersion: string;
    algorithm: 'aes-256-gcm';
    iv: string;
    tag: string;
    ciphertext: string;
  } | null;
  accessCodeRequired?: boolean | null;
  gateInstructions?: string | null;
  dockAppointment?: boolean | null;
  liftgateRequired?: boolean | null;
  insideDelivery?: boolean | null;
  contactRequired?: boolean | null;
};

export type JobRoutingRequirements = {
  load?: JobLoadRequirements | null;
  requiredEquipment?: string[] | null;
  requiredDriverId?: string | null;
  requiredDriverName?: string | null;
  vehicle?: VehicleConstraintRequirements | null;
  driver?: DriverConstraintRequirements | null;
  sequence?: StopSequenceConstraint | null;
  site?: JobSiteRequirements | null;
  hazmatClass?: string | null;
  temperatureRequirement?: string | null;
  handlingRequirement?: string | null;
};

export type JobRoutingReadiness = {
  status: JobRoutingReadinessStatus;
  severity: JobRoutingReadinessSeverity;
  routable: boolean;
  reasonCodes: string[];
  summary: string;
  loadSummary?: {
    palletCount?: number;
    totalWeightKg?: number;
    totalVolumeM3?: number;
    stackable?: boolean;
  };
};

export type JobRoutingReadinessInput = {
  deliveryAddress?: string | null;
  timeWindowStart?: string | Date | null;
  timeWindowEnd?: string | Date | null;
  estimatedDuration?: number | string | null;
  weight?: number | string | null;
  volume?: number | string | null;
  quantity?: number | string | null;
  routingRequirements?: JobRoutingRequirements | null;
};

const DEFAULT_MAX_WEIGHT_KG = 10000;
const DEFAULT_MAX_VOLUME_M3 = 50;
const DEFAULT_TRAILER_STANDARD_PALLETS = 26;
const CUBIC_INCHES_PER_CUBIC_METER = 61023.7441;
const POUNDS_PER_KILOGRAM = 2.2046226218;

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const hasText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const hasDateValue = (value: unknown): boolean => {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string' && value.trim()) {
    return !Number.isNaN(new Date(value).getTime());
  }
  return false;
};

const pushUnique = (items: string[], item: string) => {
  if (!items.includes(item)) items.push(item);
};

export type JobLoadEstimate = {
  palletCount?: number;
  palletLengthIn?: number;
  palletWidthIn?: number;
  palletHeightIn?: number;
  palletWeightLb?: number;
  totalWeightKg?: number;
  totalVolumeM3?: number;
  stackable?: boolean | null;
};

export const estimateJobLoad = (
  input: Pick<JobRoutingReadinessInput, 'weight' | 'volume' | 'quantity' | 'routingRequirements'>,
): JobLoadEstimate => {
  const load = input.routingRequirements?.load || {};
  const palletGroups = (load.palletGroups || []).filter((group) =>
    [group.quantity, group.lengthIn, group.widthIn, group.heightIn, group.weightLb]
      .every((value) => (toFiniteNumber(value) || 0) > 0),
  );
  const firstGroup = palletGroups[0];
  const groupedPalletCount = palletGroups.reduce(
    (sum, group) => sum + (toFiniteNumber(group.quantity) || 0),
    0,
  );
  const groupedWeightKg = palletGroups.reduce(
    (sum, group) =>
      sum +
      ((toFiniteNumber(group.quantity) || 0) *
        (toFiniteNumber(group.weightLb) || 0)) /
        POUNDS_PER_KILOGRAM,
    0,
  );
  const groupedVolumeM3 = palletGroups.reduce(
    (sum, group) =>
      sum +
      ((toFiniteNumber(group.quantity) || 0) *
        (toFiniteNumber(group.lengthIn) || 0) *
        (toFiniteNumber(group.widthIn) || 0) *
        (toFiniteNumber(group.heightIn) || 0)) /
        CUBIC_INCHES_PER_CUBIC_METER,
    0,
  );
  const palletCount =
    toFiniteNumber(load.palletCount) ??
    (groupedPalletCount > 0 ? groupedPalletCount : undefined) ??
    toFiniteNumber(input.quantity);
  const palletLengthIn =
    toFiniteNumber(load.palletLengthIn) ?? toFiniteNumber(firstGroup?.lengthIn);
  const palletWidthIn =
    toFiniteNumber(load.palletWidthIn) ?? toFiniteNumber(firstGroup?.widthIn);
  const palletHeightIn =
    toFiniteNumber(load.palletHeightIn) ?? toFiniteNumber(firstGroup?.heightIn);
  const palletWeightLb =
    toFiniteNumber(load.palletWeightLb) ?? toFiniteNumber(firstGroup?.weightLb);
  const totalWeightKg =
    toFiniteNumber(load.totalWeightKg) ??
    toFiniteNumber(input.weight) ??
    (groupedWeightKg > 0 ? groupedWeightKg : undefined) ??
    (palletCount && palletWeightLb
      ? (palletCount * palletWeightLb) / POUNDS_PER_KILOGRAM
      : undefined);
  const totalVolumeM3 =
    toFiniteNumber(load.totalVolumeM3) ??
    toFiniteNumber(input.volume) ??
    (groupedVolumeM3 > 0 ? groupedVolumeM3 : undefined) ??
    (palletCount && palletLengthIn && palletWidthIn && palletHeightIn
      ? (palletCount * palletLengthIn * palletWidthIn * palletHeightIn) /
        CUBIC_INCHES_PER_CUBIC_METER
      : undefined);

  return {
    palletCount,
    palletLengthIn,
    palletWidthIn,
    palletHeightIn,
    palletWeightLb,
    totalWeightKg,
    totalVolumeM3,
    stackable:
      load.stackable ??
      (palletGroups.length
        ? palletGroups.every(
            (group) => group.stackable !== false && group.fragile !== true,
          )
        : undefined),
  };
};

export const evaluateJobRoutingReadiness = (
  input: JobRoutingReadinessInput,
): JobRoutingReadiness => {
  const reasonCodes: string[] = [];
  const load = estimateJobLoad(input);
  const site = input.routingRequirements?.site || {};
  const requiredEquipment = input.routingRequirements?.requiredEquipment || [];

  if (!hasText(input.deliveryAddress)) pushUnique(reasonCodes, 'MISSING_DELIVERY_ADDRESS');
  if (!hasDateValue(input.timeWindowStart) || !hasDateValue(input.timeWindowEnd)) {
    pushUnique(reasonCodes, 'MISSING_TIME_WINDOW');
  }
  if (!toFiniteNumber(input.estimatedDuration)) {
    pushUnique(reasonCodes, 'MISSING_SERVICE_DURATION');
  }
  if (!load.palletCount) {
    pushUnique(reasonCodes, 'MISSING_PALLET_COUNT');
  }
  if (
    load.palletCount &&
    (!load.palletLengthIn || !load.palletWidthIn || !load.palletHeightIn)
  ) {
    pushUnique(reasonCodes, 'MISSING_PALLET_DIMENSIONS');
  }
  if (load.palletCount && !load.totalWeightKg) {
    pushUnique(reasonCodes, 'MISSING_LOAD_WEIGHT');
  }

  const missingData = reasonCodes.some((code) => code.startsWith('MISSING_'));
  if (missingData) {
    return {
      status: 'missing_data',
      severity: 'blocked',
      routable: false,
      reasonCodes,
      summary: 'Missing routing-critical job data',
      loadSummary: {
        palletCount: load.palletCount,
        totalWeightKg: load.totalWeightKg,
        totalVolumeM3: load.totalVolumeM3,
        stackable: load.stackable ?? undefined,
      },
    };
  }

  if (
    (load.totalWeightKg && load.totalWeightKg > DEFAULT_MAX_WEIGHT_KG) ||
    (load.totalVolumeM3 && load.totalVolumeM3 > DEFAULT_MAX_VOLUME_M3) ||
    (load.stackable === false &&
      load.palletCount &&
      load.palletCount > DEFAULT_TRAILER_STANDARD_PALLETS)
  ) {
    pushUnique(reasonCodes, 'LOAD_EXCEEDS_DEFAULT_TRAILER');
    return {
      status: 'capacity_risk',
      severity: 'blocked',
      routable: false,
      reasonCodes,
      summary: 'Load fit requires capacity review',
      loadSummary: {
        palletCount: load.palletCount,
        totalWeightKg: load.totalWeightKg,
        totalVolumeM3: load.totalVolumeM3,
        stackable: load.stackable ?? undefined,
      },
    };
  }

  if (site.dockAppointment) {
    pushUnique(reasonCodes, 'DOCK_APPOINTMENT_REQUIRED');
    return {
      status: 'appointment_risk',
      severity: 'warning',
      routable: true,
      reasonCodes,
      summary: 'Appointment must be honored during planning',
      loadSummary: {
        palletCount: load.palletCount,
        totalWeightKg: load.totalWeightKg,
        totalVolumeM3: load.totalVolumeM3,
        stackable: load.stackable ?? undefined,
      },
    };
  }

  if (
    hasText(site.accessNotes) ||
    hasText(site.accessCode) ||
    site.accessCodeConfigured ||
    Boolean(site.accessCodeEncrypted) ||
    site.accessCodeRequired ||
    hasText(site.gateInstructions) ||
    site.liftgateRequired ||
    site.insideDelivery ||
    site.contactRequired ||
    requiredEquipment.length > 0 ||
    hasText(input.routingRequirements?.requiredDriverId) ||
    hasText(input.routingRequirements?.requiredDriverName) ||
    Boolean(input.routingRequirements?.vehicle?.allowedVehicleIds?.length) ||
    Boolean(input.routingRequirements?.vehicle?.prohibitedVehicleIds?.length) ||
    Boolean(input.routingRequirements?.vehicle?.requiredFeatures?.length) ||
    Boolean(input.routingRequirements?.driver?.allowedDriverIds?.length) ||
    Boolean(input.routingRequirements?.driver?.prohibitedDriverIds?.length) ||
    Boolean(input.routingRequirements?.driver?.requiredCertifications?.length) ||
    ['first', 'last'].includes(input.routingRequirements?.sequence?.position || '') ||
    hasText(input.routingRequirements?.hazmatClass) ||
    hasText(input.routingRequirements?.temperatureRequirement) ||
    hasText(input.routingRequirements?.handlingRequirement)
  ) {
    pushUnique(reasonCodes, 'ROUTING_CONSTRAINTS_PRESENT');
    return {
      status: 'access_risk',
      severity: 'warning',
      routable: true,
      reasonCodes,
      summary: 'Constraints must match driver, vehicle, and site rules',
      loadSummary: {
        palletCount: load.palletCount,
        totalWeightKg: load.totalWeightKg,
        totalVolumeM3: load.totalVolumeM3,
        stackable: load.stackable ?? undefined,
      },
    };
  }

  return {
    status: 'routable',
    severity: 'ok',
    routable: true,
    reasonCodes: [],
    summary: 'Ready for routing',
    loadSummary: {
      palletCount: load.palletCount,
      totalWeightKg: load.totalWeightKg,
      totalVolumeM3: load.totalVolumeM3,
      stackable: load.stackable ?? undefined,
    },
  };
};
