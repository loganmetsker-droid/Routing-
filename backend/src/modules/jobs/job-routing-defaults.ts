import type { JobRoutingRequirements } from '@shared/contracts';
import { JobPriority } from './entities/job.entity';

type JobRoutingSeedInput = {
  customerName?: string | null;
  priority?: string | null;
  quantity?: number | string | null;
  weight?: number | string | null;
  volume?: number | string | null;
  estimatedDuration?: number | string | null;
  routingRequirements?: JobRoutingRequirements | null;
};

const POUNDS_PER_KILOGRAM = 2.2046226218;
const CUBIC_INCHES_PER_CUBIC_METER = 61023.7441;
const STANDARD_PALLET = {
  palletLengthIn: 48,
  palletWidthIn: 40,
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const profileForJob = (input: JobRoutingSeedInput) => {
  const priority = String(input.priority || '').toLowerCase();
  const name = String(input.customerName || '').toLowerCase();

  if (priority === JobPriority.URGENT || name.includes('medical') || name.includes('pharmacy')) {
    return {
      palletCount: 1,
      palletHeightIn: 42,
      palletWeightLb: 650,
      stackable: false,
      handlingRequirement: 'priority handling',
    };
  }

  if (name.includes('cold') || name.includes('produce') || name.includes('foods')) {
    return {
      palletCount: 3,
      palletHeightIn: 54,
      palletWeightLb: 900,
      stackable: true,
      temperatureRequirement: 'refrigerated',
    };
  }

  if (name.includes('distribution') || name.includes('crossdock') || name.includes('fulfillment')) {
    return {
      palletCount: 4,
      palletHeightIn: 60,
      palletWeightLb: 850,
      stackable: true,
      requiredEquipment: ['pallet jack'],
    };
  }

  if (priority === JobPriority.HIGH) {
    return {
      palletCount: 2,
      palletHeightIn: 54,
      palletWeightLb: 800,
      stackable: true,
    };
  }

  return {
    palletCount: 1,
    palletHeightIn: 48,
    palletWeightLb: 600,
    stackable: true,
  };
};

export const buildDefaultJobRoutingRequirements = (
  input: JobRoutingSeedInput,
): JobRoutingRequirements => {
  const existing = input.routingRequirements || {};
  const existingLoad = existing.load || {};
  const profile = profileForJob(input);
  const palletCount =
    toFiniteNumber(existingLoad.palletCount) ||
    toFiniteNumber(input.quantity) ||
    profile.palletCount;
  const palletLengthIn =
    toFiniteNumber(existingLoad.palletLengthIn) || STANDARD_PALLET.palletLengthIn;
  const palletWidthIn =
    toFiniteNumber(existingLoad.palletWidthIn) || STANDARD_PALLET.palletWidthIn;
  const palletHeightIn =
    toFiniteNumber(existingLoad.palletHeightIn) || profile.palletHeightIn;
  const palletWeightLb =
    toFiniteNumber(existingLoad.palletWeightLb) ||
    (toFiniteNumber(input.weight) && palletCount
      ? (toFiniteNumber(input.weight) as number) * POUNDS_PER_KILOGRAM / palletCount
      : undefined) ||
    profile.palletWeightLb;
  const totalWeightKg =
    toFiniteNumber(existingLoad.totalWeightKg) ||
    toFiniteNumber(input.weight) ||
    (palletCount * palletWeightLb) / POUNDS_PER_KILOGRAM;
  const totalVolumeM3 =
    toFiniteNumber(existingLoad.totalVolumeM3) ||
    toFiniteNumber(input.volume) ||
    (palletCount * palletLengthIn * palletWidthIn * palletHeightIn) /
      CUBIC_INCHES_PER_CUBIC_METER;

  return {
    ...existing,
    load: {
      ...existingLoad,
      palletCount,
      palletLengthIn,
      palletWidthIn,
      palletHeightIn,
      palletWeightLb,
      totalWeightKg: Number(totalWeightKg.toFixed(2)),
      totalVolumeM3: Number(totalVolumeM3.toFixed(2)),
      stackable: existingLoad.stackable ?? profile.stackable,
    },
    requiredEquipment:
      existing.requiredEquipment ||
      ('requiredEquipment' in profile ? profile.requiredEquipment : undefined),
    temperatureRequirement:
      existing.temperatureRequirement ||
      ('temperatureRequirement' in profile ? profile.temperatureRequirement : undefined),
    handlingRequirement:
      existing.handlingRequirement ||
      ('handlingRequirement' in profile ? profile.handlingRequirement : undefined),
    site: {
      ...(existing.site || {}),
      contactRequired: existing.site?.contactRequired ?? false,
    },
  };
};
