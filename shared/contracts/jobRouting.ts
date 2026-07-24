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
};

export type JobSiteRequirements = {
  accessNotes?: string | null;
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

const estimateLoad = (input: JobRoutingReadinessInput) => {
  const load = input.routingRequirements?.load || {};
  const palletCount = toFiniteNumber(load.palletCount) ?? toFiniteNumber(input.quantity);
  const palletLengthIn = toFiniteNumber(load.palletLengthIn);
  const palletWidthIn = toFiniteNumber(load.palletWidthIn);
  const palletHeightIn = toFiniteNumber(load.palletHeightIn);
  const palletWeightLb = toFiniteNumber(load.palletWeightLb);
  const totalWeightKg =
    toFiniteNumber(load.totalWeightKg) ??
    toFiniteNumber(input.weight) ??
    (palletCount && palletWeightLb
      ? (palletCount * palletWeightLb) / POUNDS_PER_KILOGRAM
      : undefined);
  const totalVolumeM3 =
    toFiniteNumber(load.totalVolumeM3) ??
    toFiniteNumber(input.volume) ??
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
    stackable: load.stackable,
  };
};

export const evaluateJobRoutingReadiness = (
  input: JobRoutingReadinessInput,
): JobRoutingReadiness => {
  const reasonCodes: string[] = [];
  const load = estimateLoad(input);
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
    site.liftgateRequired ||
    site.insideDelivery ||
    site.contactRequired ||
    requiredEquipment.length > 0 ||
    hasText(input.routingRequirements?.requiredDriverId) ||
    hasText(input.routingRequirements?.requiredDriverName) ||
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
