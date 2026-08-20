export type ConstraintSeverity = 'hard' | 'warning';

export type FleetOperatingRule = {
  id: string;
  label: string;
  instruction: string;
  severity: ConstraintSeverity;
  active?: boolean;
};

export type VehicleCargoProfile = {
  interiorLengthIn?: number | null;
  interiorWidthIn?: number | null;
  interiorHeightIn?: number | null;
  doorHeightIn?: number | null;
  maxPalletPositions?: number | null;
  maxPalletWeightLb?: number | null;
  maxStackHeightIn?: number | null;
  maxStackLevels?: number | null;
};

export type VehicleRoutingProfile = {
  cargo?: VehicleCargoProfile | null;
  features?: string[] | null;
  handlingCapabilities?: string[] | null;
  allowedDriverIds?: string[] | null;
  blockedDriverIds?: string[] | null;
  operatingRules?: FleetOperatingRule[] | null;
};

export type PalletLoadUnit = {
  id?: string | null;
  label?: string | null;
  quantity: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLb: number;
  stackable?: boolean | null;
  maxStackLevels?: number | null;
  fragile?: boolean | null;
  rotationAllowed?: boolean | null;
  compatibilityTags?: string[] | null;
  incompatibleWithTags?: string[] | null;
};

export type VehicleConstraintRequirements = {
  allowedVehicleIds?: string[] | null;
  prohibitedVehicleIds?: string[] | null;
  requiredFeatures?: string[] | null;
};

export type DriverConstraintRequirements = {
  allowedDriverIds?: string[] | null;
  prohibitedDriverIds?: string[] | null;
  requiredCertifications?: string[] | null;
};

export type StopSequenceConstraint = {
  position?: 'any' | 'first' | 'last' | null;
  strict?: boolean | null;
};

export type FleetConstraintIssue = {
  code: string;
  message: string;
  jobId?: string;
};

export type VehicleLoadFitResult = {
  fits: boolean;
  blockers: FleetConstraintIssue[];
  warnings: FleetConstraintIssue[];
  totals: {
    weightKg: number;
    volumeM3: number;
    palletCount: number;
    floorPositionsNeeded: number;
  };
  limits: {
    weightKg: number | null;
    volumeM3: number | null;
    palletPositions: number | null;
  };
  utilization: {
    weightPercent: number | null;
    volumePercent: number | null;
    palletPositionPercent: number | null;
  };
};

type LoadRequirementsLike = {
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

type RoutingRequirementsLike = {
  load?: LoadRequirementsLike | null;
  requiredEquipment?: string[] | null;
  requiredDriverId?: string | null;
  vehicle?: VehicleConstraintRequirements | null;
  driver?: DriverConstraintRequirements | null;
  handlingRequirement?: string | null;
};

export type VehicleFitJob = {
  id: string;
  weight?: number | string | null;
  volume?: number | string | null;
  quantity?: number | string | null;
  routingRequirements?: RoutingRequirementsLike | null;
};

export type VehicleFitVehicle = {
  id: string;
  capacityWeightKg?: number | string | null;
  capacityVolumeM3?: number | string | null;
  routingProfile?: VehicleRoutingProfile | null;
};

export type VehicleFitDriver = {
  id: string;
  certifications?: string[] | null;
};

const POUNDS_PER_KILOGRAM = 2.2046226218;
const CUBIC_INCHES_PER_CUBIC_METER = 61023.7441;
const CUBIC_FEET_PER_CUBIC_METER = 35.3146667;

const finiteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const positiveNumber = (value: unknown): number | null => {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const normalizedSet = (values?: string[] | null) =>
  new Set((values || []).map((value) => value.trim().toLowerCase()).filter(Boolean));

const percent = (value: number, limit: number | null) =>
  limit && limit > 0 ? Number(((value / limit) * 100).toFixed(1)) : null;

const estimateVehiclePalletPositions = (cargo?: VehicleCargoProfile | null) => {
  const explicit = positiveNumber(cargo?.maxPalletPositions);
  if (explicit) return Math.floor(explicit);
  const length = positiveNumber(cargo?.interiorLengthIn);
  const width = positiveNumber(cargo?.interiorWidthIn);
  if (!length || !width) return null;
  const standard = Math.floor(length / 48) * Math.floor(width / 40);
  const rotated = Math.floor(length / 40) * Math.floor(width / 48);
  return Math.max(standard, rotated, 0);
};

const legacyPalletGroup = (
  job: VehicleFitJob,
): PalletLoadUnit | null => {
  const load = job.routingRequirements?.load;
  const quantity = positiveNumber(load?.palletCount) ?? positiveNumber(job.quantity);
  const lengthIn = positiveNumber(load?.palletLengthIn);
  const widthIn = positiveNumber(load?.palletWidthIn);
  const heightIn = positiveNumber(load?.palletHeightIn);
  const weightLb = positiveNumber(load?.palletWeightLb);
  if (!quantity || !lengthIn || !widthIn || !heightIn || !weightLb) return null;
  return {
    id: `${job.id}-legacy-load`,
    quantity,
    lengthIn,
    widthIn,
    heightIn,
    weightLb,
    stackable: load?.stackable,
    maxStackLevels: load?.maxStackLevels,
    fragile: load?.fragile,
  };
};

const palletGroupsForJob = (job: VehicleFitJob) => {
  const groups = job.routingRequirements?.load?.palletGroups;
  if (Array.isArray(groups) && groups.length) {
    return groups.filter((group) =>
      [group.quantity, group.lengthIn, group.widthIn, group.heightIn, group.weightLb]
        .every((value) => positiveNumber(value)),
    );
  }
  const legacy = legacyPalletGroup(job);
  return legacy ? [legacy] : [];
};

const effectiveStackLevels = (
  group: PalletLoadUnit,
  cargo?: VehicleCargoProfile | null,
) => {
  if (group.stackable === false || group.fragile === true) return 1;
  const vehicleHeight = positiveNumber(cargo?.interiorHeightIn);
  const vehicleStackHeight = positiveNumber(cargo?.maxStackHeightIn);
  const jobStackHeight = positiveNumber(group.heightIn);
  const byInterior = vehicleHeight && jobStackHeight
    ? Math.floor(vehicleHeight / jobStackHeight)
    : null;
  const byStackHeight = vehicleStackHeight && jobStackHeight
    ? Math.floor(vehicleStackHeight / jobStackHeight)
    : null;
  const candidates = [
    positiveNumber(group.maxStackLevels),
    positiveNumber(cargo?.maxStackLevels),
    byInterior,
    byStackHeight,
  ].filter((value): value is number => value !== null && value > 0);
  return candidates.length ? Math.max(1, Math.floor(Math.min(...candidates))) : 1;
};

export const evaluateVehicleLoadFit = (input: {
  vehicle: VehicleFitVehicle;
  driver?: VehicleFitDriver | null;
  jobs: VehicleFitJob[];
}): VehicleLoadFitResult => {
  const blockers: FleetConstraintIssue[] = [];
  const warnings: FleetConstraintIssue[] = [];
  const profile = input.vehicle.routingProfile || {};
  const cargo = profile.cargo || {};
  const vehicleFeatures = normalizedSet([
    ...(profile.features || []),
    ...(profile.handlingCapabilities || []),
  ]);
  const weightLimit = positiveNumber(input.vehicle.capacityWeightKg);
  const volumeLimit = positiveNumber(input.vehicle.capacityVolumeM3);
  const palletPositionLimit = estimateVehiclePalletPositions(cargo);
  let weightKg = 0;
  let volumeM3 = 0;
  let palletCount = 0;
  let floorPositionsNeeded = 0;
  const routeCompatibilityTags = new Set<string>();

  const addBlocker = (code: string, message: string, jobId?: string) => {
    if (!blockers.some((issue) => issue.code === code && issue.jobId === jobId)) {
      blockers.push({ code, message, jobId });
    }
  };
  const addWarning = (code: string, message: string, jobId?: string) => {
    if (!warnings.some((issue) => issue.code === code && issue.jobId === jobId)) {
      warnings.push({ code, message, jobId });
    }
  };

  const driverId = input.driver?.id;
  const allowedVehicleDrivers = new Set(profile.allowedDriverIds || []);
  const blockedVehicleDrivers = new Set(profile.blockedDriverIds || []);
  if (driverId && allowedVehicleDrivers.size && !allowedVehicleDrivers.has(driverId)) {
    addBlocker('DRIVER_NOT_ALLOWED_FOR_VEHICLE', 'This driver is not on the vehicle allow list.');
  }
  if (driverId && blockedVehicleDrivers.has(driverId)) {
    addBlocker('DRIVER_BLOCKED_FROM_VEHICLE', 'This driver is blocked from this vehicle.');
  }
  if (!driverId && allowedVehicleDrivers.size) {
    addBlocker(
      'DRIVER_ASSIGNMENT_REQUIRED',
      'Assign a driver from this vehicle’s allow list before dispatch.',
    );
  }

  for (const job of input.jobs) {
    const requirements = job.routingRequirements || {};
    const load = requirements.load || {};
    const groups = palletGroupsForJob(job);
    const explicitWeight = positiveNumber(load.totalWeightKg) ?? positiveNumber(job.weight);
    const explicitVolume = positiveNumber(load.totalVolumeM3) ?? positiveNumber(job.volume);
    const groupWeightKg = groups.reduce(
      (sum, group) => sum + (group.quantity * group.weightLb) / POUNDS_PER_KILOGRAM,
      0,
    );
    const groupVolumeM3 = groups.reduce(
      (sum, group) =>
        sum +
        (group.quantity * group.lengthIn * group.widthIn * group.heightIn) /
          CUBIC_INCHES_PER_CUBIC_METER,
      0,
    );
    weightKg += explicitWeight ?? groupWeightKg;
    volumeM3 += explicitVolume ?? groupVolumeM3;

    for (const group of groups) {
      palletCount += group.quantity;
      floorPositionsNeeded += Math.ceil(
        group.quantity / effectiveStackLevels(group, cargo),
      );
      const maxPalletWeightLb = positiveNumber(cargo.maxPalletWeightLb);
      if (maxPalletWeightLb && group.weightLb > maxPalletWeightLb) {
        addBlocker(
          'PALLET_TOO_HEAVY',
          `${group.label || 'Pallet'} is ${group.weightLb} lb; this vehicle allows ${maxPalletWeightLb} lb per pallet.`,
          job.id,
        );
      }
      const doorHeight = positiveNumber(cargo.doorHeightIn);
      if (doorHeight && group.heightIn > doorHeight) {
        addBlocker(
          'PALLET_TOO_TALL_FOR_DOOR',
          `${group.label || 'Pallet'} is ${group.heightIn} in high; the cargo door is ${doorHeight} in.`,
          job.id,
        );
      }
      const interiorHeight = positiveNumber(cargo.interiorHeightIn);
      if (interiorHeight && group.heightIn > interiorHeight) {
        addBlocker(
          'PALLET_TOO_TALL_FOR_INTERIOR',
          `${group.label || 'Pallet'} is ${group.heightIn} in high; cargo interior height is ${interiorHeight} in.`,
          job.id,
        );
      }
      const maxStackHeight = positiveNumber(cargo.maxStackHeightIn);
      if (maxStackHeight && group.heightIn > maxStackHeight) {
        addBlocker(
          'PALLET_EXCEEDS_STACK_HEIGHT',
          `${group.label || 'Pallet'} is ${group.heightIn} in high; the vehicle stack-height limit is ${maxStackHeight} in.`,
          job.id,
        );
      }
      const interiorLength = positiveNumber(cargo.interiorLengthIn);
      const interiorWidth = positiveNumber(cargo.interiorWidthIn);
      if (interiorLength && interiorWidth) {
        const fitsNormally =
          group.lengthIn <= interiorLength && group.widthIn <= interiorWidth;
        const fitsRotated =
          group.rotationAllowed !== false &&
          group.widthIn <= interiorLength &&
          group.lengthIn <= interiorWidth;
        if (!fitsNormally && !fitsRotated) {
          addBlocker(
            'PALLET_FOOTPRINT_TOO_LARGE',
            `${group.label || 'Pallet'} footprint (${group.lengthIn} × ${group.widthIn} in) does not fit the ${interiorLength} × ${interiorWidth} in cargo floor.`,
            job.id,
          );
        }
      }
      for (const tag of group.compatibilityTags || []) {
        if (tag.trim()) routeCompatibilityTags.add(tag.trim().toLowerCase());
      }
    }

    const vehicleRules = requirements.vehicle || {};
    if (vehicleRules.allowedVehicleIds?.length && !vehicleRules.allowedVehicleIds.includes(input.vehicle.id)) {
      addBlocker('VEHICLE_NOT_ALLOWED', 'This stop is restricted to another vehicle.', job.id);
    }
    if (vehicleRules.prohibitedVehicleIds?.includes(input.vehicle.id)) {
      addBlocker('VEHICLE_PROHIBITED', 'This vehicle is explicitly prohibited for the stop.', job.id);
    }
    for (const feature of [
      ...(requirements.requiredEquipment || []),
      ...(vehicleRules.requiredFeatures || []),
    ]) {
      if (!vehicleFeatures.has(feature.trim().toLowerCase())) {
        addBlocker(
          'VEHICLE_FEATURE_MISSING',
          `Vehicle is missing required feature: ${feature}.`,
          job.id,
        );
      }
    }

    const driverRules = requirements.driver || {};
    if (driverId) {
      if (requirements.requiredDriverId && requirements.requiredDriverId !== driverId) {
        addBlocker('DRIVER_REQUIRED', 'This stop requires a different driver.', job.id);
      }
      if (driverRules.allowedDriverIds?.length && !driverRules.allowedDriverIds.includes(driverId)) {
        addBlocker('DRIVER_NOT_ALLOWED', 'This driver is not allowed for the stop.', job.id);
      }
      if (driverRules.prohibitedDriverIds?.includes(driverId)) {
        addBlocker('DRIVER_PROHIBITED', 'This driver is explicitly prohibited for the stop.', job.id);
      }
      const certifications = normalizedSet(input.driver?.certifications);
      for (const certification of driverRules.requiredCertifications || []) {
        if (!certifications.has(certification.trim().toLowerCase())) {
          addBlocker(
            'DRIVER_CERTIFICATION_MISSING',
            `Driver is missing required certification: ${certification}.`,
            job.id,
          );
        }
      }
    } else if (
      requirements.requiredDriverId ||
      driverRules.allowedDriverIds?.length ||
      driverRules.requiredCertifications?.length
    ) {
      addBlocker('DRIVER_ASSIGNMENT_REQUIRED', 'Assign an eligible driver before dispatch.', job.id);
    }

    if (groups.length === 0 && (positiveNumber(load.palletCount) || positiveNumber(job.quantity))) {
      addWarning('PALLET_DIMENSIONS_MISSING', 'Pallet floor-position fit cannot be estimated without dimensions.', job.id);
    }
    if (requirements.handlingRequirement?.trim()) {
      addWarning('HANDLING_RULE_REVIEW', requirements.handlingRequirement.trim(), job.id);
    }
  }

  for (const job of input.jobs) {
    for (const group of palletGroupsForJob(job)) {
      for (const incompatible of group.incompatibleWithTags || []) {
        if (routeCompatibilityTags.has(incompatible.trim().toLowerCase())) {
          addBlocker(
            'CARGO_COMPATIBILITY_CONFLICT',
            `${group.label || 'Load'} cannot share a vehicle with ${incompatible}.`,
            job.id,
          );
        }
      }
    }
  }

  weightKg = Number(weightKg.toFixed(2));
  volumeM3 = Number(volumeM3.toFixed(2));
  if (weightLimit && weightKg > weightLimit) {
    addBlocker(
      'CAPACITY_WEIGHT_EXCEEDED',
      `Load is ${Math.round(weightKg * POUNDS_PER_KILOGRAM).toLocaleString('en-US')} lb; vehicle limit is ${Math.round(weightLimit * POUNDS_PER_KILOGRAM).toLocaleString('en-US')} lb.`,
    );
  }
  if (volumeLimit && volumeM3 > volumeLimit) {
    addBlocker(
      'CAPACITY_VOLUME_EXCEEDED',
      `Load is ${Math.round(volumeM3 * CUBIC_FEET_PER_CUBIC_METER).toLocaleString('en-US')} cu ft; vehicle limit is ${Math.round(volumeLimit * CUBIC_FEET_PER_CUBIC_METER).toLocaleString('en-US')} cu ft.`,
    );
  }
  if (palletPositionLimit !== null && floorPositionsNeeded > palletPositionLimit) {
    addBlocker(
      'PALLET_POSITIONS_EXCEEDED',
      `Load needs about ${floorPositionsNeeded} floor positions; vehicle has ${palletPositionLimit}.`,
    );
  }
  if (!weightLimit) addWarning('WEIGHT_CAPACITY_UNKNOWN', 'Vehicle weight capacity is not configured.');
  if (!volumeLimit) addWarning('VOLUME_CAPACITY_UNKNOWN', 'Vehicle volume capacity is not configured.');
  if (palletCount > 0 && palletPositionLimit === null) {
    addWarning('PALLET_CAPACITY_UNKNOWN', 'Vehicle pallet positions or cargo dimensions are not configured.');
  }
  for (const rule of profile.operatingRules || []) {
    if (rule.active === false) continue;
    addWarning('VEHICLE_OPERATING_RULE', `${rule.label}: ${rule.instruction}`);
  }

  return {
    fits: blockers.length === 0,
    blockers,
    warnings,
    totals: { weightKg, volumeM3, palletCount, floorPositionsNeeded },
    limits: {
      weightKg: weightLimit,
      volumeM3: volumeLimit,
      palletPositions: palletPositionLimit,
    },
    utilization: {
      weightPercent: percent(weightKg, weightLimit),
      volumePercent: percent(volumeM3, volumeLimit),
      palletPositionPercent: percent(floorPositionsNeeded, palletPositionLimit),
    },
  };
};
