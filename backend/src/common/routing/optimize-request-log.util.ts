type OptimizeRequestLike = {
  plan_date?: string;
  depot_id?: string | null;
  objective?: unknown;
  vehicles?: Array<{ id?: string }>;
  stops?: Array<{ id?: string }>;
};

export type OptimizeRequestLogSummary = {
  plan_date: string | null;
  depot_id: string | null;
  objective: string | null;
  vehicle_count: number;
  stop_count: number;
  vehicle_ids_sample: string[];
  stop_ids_sample: string[];
  truncated: boolean;
};

const MAX_IDS = 25;
const MAX_ID_LENGTH = 128;
const MAX_OBJECTIVE_LENGTH = 64;

type SafeTextResult = { value: string | null; truncated: boolean };

function safeText(value: unknown, maxLength: number): SafeTextResult {
  if (value === null || value === undefined) return { value: null, truncated: false };
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return { value: null, truncated: false };
  }

  const raw = String(value).trim();
  if (!raw) return { value: null, truncated: false };

  if (raw.length <= maxLength) return { value: raw, truncated: false };
  return { value: raw.slice(0, maxLength), truncated: true };
}

export function summarizeOptimizeRequestForLog(
  request: OptimizeRequestLike,
): OptimizeRequestLogSummary {
  let truncatedValues = false;

  const vehicleIds: string[] = [];
  for (const vehicle of request.vehicles || []) {
    const result = safeText(vehicle?.id, MAX_ID_LENGTH);
    if (result.truncated) truncatedValues = true;
    if (result.value) vehicleIds.push(result.value);
  }

  const stopIds: string[] = [];
  for (const stop of request.stops || []) {
    const result = safeText(stop?.id, MAX_ID_LENGTH);
    if (result.truncated) truncatedValues = true;
    if (result.value) stopIds.push(result.value);
  }

  const objectiveResult = safeText(request.objective, MAX_OBJECTIVE_LENGTH);
  if (objectiveResult.truncated) truncatedValues = true;

  const planDateResult = safeText(request.plan_date, MAX_ID_LENGTH);
  if (planDateResult.truncated) truncatedValues = true;

  const depotIdResult = safeText(request.depot_id, MAX_ID_LENGTH);
  if (depotIdResult.truncated) truncatedValues = true;

  return {
    plan_date: planDateResult.value,
    depot_id: depotIdResult.value,
    objective: objectiveResult.value,
    vehicle_count: vehicleIds.length,
    stop_count: stopIds.length,
    vehicle_ids_sample: vehicleIds.slice(0, MAX_IDS),
    stop_ids_sample: stopIds.slice(0, MAX_IDS),
    truncated:
      truncatedValues || vehicleIds.length > MAX_IDS || stopIds.length > MAX_IDS,
  };
}
