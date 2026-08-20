export type ConstraintSeverity = 'hard' | 'soft' | 'note';

export type RoutingConstraintType =
  | 'LOAD_FIT'
  | 'WEIGHT_LIMIT'
  | 'PALLET_SIZE'
  | 'NON_STACKABLE'
  | 'TIME_WINDOW'
  | 'REQUIRED_DRIVER'
  | 'VEHICLE_EQUIPMENT'
  | 'ACCESS_RESTRICTION'
  | 'TEMP_CONTROL'
  | 'HAZMAT'
  | 'LIFTGATE'
  | 'DOCK_APPOINTMENT'
  | 'CUSTOMER_RULE';

export type TrailerLoadInputs = {
  quantity: number;
  palletLengthIn: number;
  palletWidthIn: number;
  palletHeightIn: number;
  palletWeightLb: number;
  stackable: boolean;
  maxStackLevels: number;
  trailerLengthFt: number;
  trailerWidthIn: number;
  trailerHeightIn: number;
  trailerWeightCapacityLb: number;
};

export type TrailerLoadEstimate = {
  quantity: number;
  stackLevelsUsed: number;
  floorPositionsRequired: number;
  trailerPalletPositions: number;
  floorSpacePercent: number;
  weightPercent: number;
  totalWeightLb: number;
  maxPalletsByFloor: number;
  maxPalletsByWeight: number;
  maxPalletsEstimated: number;
  fits: boolean;
  limitReasons: Array<'height' | 'floor' | 'weight'>;
};

export const routingConstraintOptions: Array<{
  value: RoutingConstraintType;
  label: string;
  description: string;
}> = [
  {
    value: 'LOAD_FIT',
    label: 'Load fit / trailer space',
    description: 'Dimensions, pallet count, stackability, and trailer capacity.',
  },
  {
    value: 'WEIGHT_LIMIT',
    label: 'Weight limit',
    description: 'Shipment, route, bridge, road, or vehicle weight restriction.',
  },
  {
    value: 'PALLET_SIZE',
    label: 'Pallet size',
    description: 'Oversized, non-standard, or mixed pallet footprints.',
  },
  {
    value: 'NON_STACKABLE',
    label: 'Non-stackable freight',
    description: 'Freight that must remain single-level or top-loaded only.',
  },
  {
    value: 'TIME_WINDOW',
    label: 'Time window',
    description: 'Delivery appointment, receiver hours, or hard service window.',
  },
  {
    value: 'REQUIRED_DRIVER',
    label: 'Specific driver',
    description: 'Driver requirement based on customer, credential, or familiarity.',
  },
  {
    value: 'VEHICLE_EQUIPMENT',
    label: 'Vehicle / equipment',
    description: 'Reefer, box truck, flatbed, pallet jack, straps, or dock equipment.',
  },
  {
    value: 'ACCESS_RESTRICTION',
    label: 'Access restriction',
    description: 'Low bridge, narrow street, gate code, dock height, or road rule.',
  },
  {
    value: 'TEMP_CONTROL',
    label: 'Temperature control',
    description: 'Refrigerated, frozen, heated, or temperature-monitoring requirement.',
  },
  {
    value: 'HAZMAT',
    label: 'Hazmat / regulated',
    description: 'Hazmat, food-grade, pharma, bonded, or other regulated handling.',
  },
  {
    value: 'LIFTGATE',
    label: 'Liftgate required',
    description: 'Liftgate, inside delivery, residential, or no-dock receiver.',
  },
  {
    value: 'DOCK_APPOINTMENT',
    label: 'Dock appointment',
    description: 'Appointment number, load sequence, detention risk, or dock rule.',
  },
  {
    value: 'CUSTOMER_RULE',
    label: 'Customer / site rule',
    description: 'Receiver-specific notes the route plan must respect.',
  },
];

const safeNumber = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const roundPercent = (value: number) => Math.round(value * 10) / 10;

export function estimateTrailerLoadFit(inputs: TrailerLoadInputs): TrailerLoadEstimate {
  const quantity = Math.max(0, Math.floor(safeNumber(inputs.quantity, 0)));
  const palletLengthIn = safeNumber(inputs.palletLengthIn, 48);
  const palletWidthIn = safeNumber(inputs.palletWidthIn, 40);
  const palletHeightIn = safeNumber(inputs.palletHeightIn, 48);
  const palletWeightLb = safeNumber(inputs.palletWeightLb, 1);
  const trailerLengthIn = safeNumber(inputs.trailerLengthFt, 53) * 12;
  const trailerWidthIn = safeNumber(inputs.trailerWidthIn, 102);
  const trailerHeightIn = safeNumber(inputs.trailerHeightIn, 110);
  const trailerWeightCapacityLb = safeNumber(inputs.trailerWeightCapacityLb, 1);

  const heightLimitedStackLevels = Math.max(0, Math.floor(trailerHeightIn / palletHeightIn));
  const stackLevelsUsed = inputs.stackable
    ? Math.max(1, Math.min(Math.floor(safeNumber(inputs.maxStackLevels, 1)), heightLimitedStackLevels || 1))
    : 1;
  const floorPositionsRequired = Math.ceil(quantity / stackLevelsUsed);

  const positionsByOrientation = [
    Math.floor(trailerLengthIn / palletLengthIn) * Math.floor(trailerWidthIn / palletWidthIn),
    Math.floor(trailerLengthIn / palletWidthIn) * Math.floor(trailerWidthIn / palletLengthIn),
  ];
  const trailerPalletPositions = Math.max(1, ...positionsByOrientation);
  const maxPalletsByFloor = trailerPalletPositions * stackLevelsUsed;
  const totalWeightLb = quantity * palletWeightLb;
  const maxPalletsByWeight = Math.floor(trailerWeightCapacityLb / palletWeightLb);
  const maxPalletsEstimated = Math.max(0, Math.min(maxPalletsByFloor, maxPalletsByWeight));
  const floorSpacePercent = roundPercent((floorPositionsRequired / trailerPalletPositions) * 100);
  const weightPercent = roundPercent((totalWeightLb / trailerWeightCapacityLb) * 100);

  const limitReasons: TrailerLoadEstimate['limitReasons'] = [];
  if (palletHeightIn > trailerHeightIn || heightLimitedStackLevels < 1) limitReasons.push('height');
  if (floorPositionsRequired > trailerPalletPositions) limitReasons.push('floor');
  if (totalWeightLb > trailerWeightCapacityLb) limitReasons.push('weight');

  return {
    quantity,
    stackLevelsUsed,
    floorPositionsRequired,
    trailerPalletPositions,
    floorSpacePercent,
    weightPercent,
    totalWeightLb,
    maxPalletsByFloor,
    maxPalletsByWeight,
    maxPalletsEstimated,
    fits: limitReasons.length === 0,
    limitReasons,
  };
}

export function formatConstraintLabel(value?: string | null) {
  return (
    routingConstraintOptions.find((option) => option.value === value)?.label ||
    String(value || 'Manual exception').replace(/_/g, ' ').toLowerCase()
  );
}
