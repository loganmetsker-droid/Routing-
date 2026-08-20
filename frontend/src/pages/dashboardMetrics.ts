type RouteMileageSource = {
  id?: string;
  totalDistanceKm?: number | null;
  totalDurationMinutes?: number | null;
};

type JobStatusSource = {
  status?: string | null;
};

type RouteStopStatusSource = {
  status?: string | null;
  actualDeparture?: string | null;
  proofRequired?: boolean | null;
  proofStatus?: {
    proofRequired?: boolean | null;
    requiredProofComplete?: boolean | null;
  } | null;
};

export type DashboardJobStatusMetrics = {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  failed: number;
  completedEnd: number;
  inProgressEnd: number;
  pendingEnd: number;
};

export type DashboardEfficiencyCard = {
  label: 'Miles Saved' | 'Fuel Savings' | 'Labor Savings';
  value: string;
  note: string;
};

export type DashboardEfficiencyMetrics = {
  cards: DashboardEfficiencyCard[];
  roiLabel: string;
};

const KM_TO_MILES = 0.621371;
const BASELINE_DISTANCE_OVERAGE = 0.25;
const BASELINE_DURATION_OVERAGE = 0.12;
const FUEL_SAVINGS_PER_MILE = 0.685;
const LABOR_COST_PER_HOUR = 60;

const sumFinite = (values: Array<number | null | undefined>) =>
  values.reduce<number>((sum, value) => {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) && numeric > 0 ? sum + numeric : sum;
  }, 0);

const money = (value: number) => `$${value.toFixed(2)}`;

const normalizeStatus = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();

export function isDashboardStopComplete(stop: RouteStopStatusSource) {
  const status = normalizeStatus(stop.status);
  if (['serviced', 'completed', 'delivered'].includes(status)) return true;
  if (Boolean(stop.actualDeparture)) return true;
  const proofRequired = Boolean(stop.proofRequired || stop.proofStatus?.proofRequired);
  return proofRequired && Boolean(stop.proofStatus?.requiredProofComplete);
}

export function buildDashboardJobStatusMetrics(
  jobs: JobStatusSource[],
): DashboardJobStatusMetrics {
  const completed = jobs.filter((job) =>
    ['completed', 'delivered'].includes(normalizeStatus(job.status)),
  ).length;
  const inProgress = jobs.filter((job) =>
    ['in_progress', 'en_route', 'arrived'].includes(normalizeStatus(job.status)),
  ).length;
  const failed = jobs.filter((job) =>
    ['failed', 'cancelled', 'canceled', 'exception'].includes(normalizeStatus(job.status)),
  ).length;
  const total = jobs.length;
  const pending = Math.max(0, total - completed - inProgress - failed);
  const percentage = (count: number) => (total > 0 ? (count / total) * 100 : 0);
  const completedEnd = percentage(completed);
  const inProgressEnd = completedEnd + percentage(inProgress);
  const pendingEnd = inProgressEnd + percentage(pending);

  return {
    total,
    completed,
    inProgress,
    pending,
    failed,
    completedEnd,
    inProgressEnd,
    pendingEnd,
  };
}

export function buildDashboardEfficiencyMetrics(
  routes: RouteMileageSource[],
): DashboardEfficiencyMetrics {
  const totalMiles = Number(
    (sumFinite(routes.map((route) => route.totalDistanceKm)) * KM_TO_MILES).toFixed(2),
  );
  const totalMinutes = sumFinite(routes.map((route) => route.totalDurationMinutes));
  const milesSaved = totalMiles * BASELINE_DISTANCE_OVERAGE;
  const minutesSaved = totalMinutes * BASELINE_DURATION_OVERAGE;
  const fuelSavings = milesSaved * FUEL_SAVINGS_PER_MILE;
  const laborSavings = (minutesSaved / 60) * LABOR_COST_PER_HOUR;
  const totalSavings = fuelSavings + laborSavings;
  const estimatedRunCost = totalMiles * FUEL_SAVINGS_PER_MILE + (totalMinutes / 60) * LABOR_COST_PER_HOUR;
  const roi = estimatedRunCost > 0 ? Math.round((totalSavings / estimatedRunCost) * 100) : 0;

  const milesNote =
    totalMiles > 0 ? `Derived from ${totalMiles.toFixed(1)} routed miles` : 'No route miles yet';
  const hoursNote =
    totalMinutes > 0 ? `Derived from ${Math.round(totalMinutes)} routed minutes` : 'No route hours yet';

  return {
    cards: [
      {
        label: 'Miles Saved',
        value: `${milesSaved.toFixed(1)} mi`,
        note: milesNote,
      },
      {
        label: 'Fuel Savings',
        value: money(fuelSavings),
        note: milesNote,
      },
      {
        label: 'Labor Savings',
        value: money(laborSavings),
        note: hoursNote,
      },
    ],
    roiLabel: `${roi}%`,
  };
}
