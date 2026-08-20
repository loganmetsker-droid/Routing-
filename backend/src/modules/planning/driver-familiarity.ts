export type FamiliarityLocation = { lat: number; lng: number };

export type DriverHistoricalVisit = {
  driverId: string;
  routeId: string;
  location: FamiliarityLocation;
  completedAt: Date;
};

export type DriverFamiliarityCandidate = {
  driverId: string;
  eligible: boolean;
  bars: 0 | 1 | 2 | 3;
  coveragePercent: number;
  familiarStopCount: number;
  targetStopCount: number;
  nearbyHistoricalVisitCount: number;
  historicalRouteCount: number;
  historicalStopCount: number;
  latestCompletedAt: string | null;
};

export type RouteDriverFamiliarity = {
  groupId: string;
  locatedStopCount: number;
  status: 'supported' | 'insufficient_route_locations' | 'insufficient_driver_history';
  recommendedDriverId: string | null;
  candidates: DriverFamiliarityCandidate[];
};

export const DRIVER_FAMILIARITY_RADIUS_KM = 2;
export const DRIVER_FAMILIARITY_MIN_ROUTES = 2;
export const DRIVER_FAMILIARITY_MIN_STOPS = 5;

function distanceKm(left: FamiliarityLocation, right: FamiliarityLocation) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDelta = radians(right.lat - left.lat);
  const lngDelta = radians(right.lng - left.lng);
  const leftLat = radians(left.lat);
  const rightLat = radians(right.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
function familiarityBars(familiarStopCount: number, targetStopCount: number): 0 | 1 | 2 | 3 {
  if (!targetStopCount || !familiarStopCount) return 0;
  const coverage = familiarStopCount / targetStopCount;
  if (coverage < 1 / 3) return 1;
  if (coverage < 2 / 3) return 2;
  return 3;
}

export function calculateRouteDriverFamiliarity({
  groupId,
  targetLocations,
  driverIds,
  visits,
}: {
  groupId: string;
  targetLocations: FamiliarityLocation[];
  driverIds: string[];
  visits: DriverHistoricalVisit[];
}): RouteDriverFamiliarity {
  const locatedStopCount = targetLocations.length;
  const candidates = driverIds.map((driverId): DriverFamiliarityCandidate => {
    const driverVisits = visits.filter((visit) => visit.driverId === driverId);
    const historicalRouteCount = new Set(driverVisits.map((visit) => visit.routeId)).size;
    const familiarTargets = targetLocations.filter((target) =>
      driverVisits.some((visit) => distanceKm(target, visit.location) <= DRIVER_FAMILIARITY_RADIUS_KM),
    );
    const nearbyHistoricalVisitCount = driverVisits.filter((visit) =>
      targetLocations.some((target) => distanceKm(target, visit.location) <= DRIVER_FAMILIARITY_RADIUS_KM),
    ).length;
    const bars = familiarityBars(familiarTargets.length, locatedStopCount);
    const eligible =
      historicalRouteCount >= DRIVER_FAMILIARITY_MIN_ROUTES &&
      driverVisits.length >= DRIVER_FAMILIARITY_MIN_STOPS;
    const latestCompletedAt = driverVisits.reduce<Date | null>(
      (latest, visit) => (!latest || visit.completedAt > latest ? visit.completedAt : latest),
      null,
    );
    return {
      driverId,
      eligible,
      bars,
      coveragePercent: locatedStopCount
        ? Math.round((familiarTargets.length / locatedStopCount) * 100)
        : 0,
      familiarStopCount: familiarTargets.length,
      targetStopCount: locatedStopCount,
      nearbyHistoricalVisitCount,
      historicalRouteCount,
      historicalStopCount: driverVisits.length,
      latestCompletedAt: latestCompletedAt?.toISOString() || null,
    };
  }).sort((left, right) =>
    Number(right.eligible) - Number(left.eligible) ||
    right.bars - left.bars ||
    right.coveragePercent - left.coveragePercent ||
    right.nearbyHistoricalVisitCount - left.nearbyHistoricalVisitCount ||
    right.historicalRouteCount - left.historicalRouteCount ||
    left.driverId.localeCompare(right.driverId),
  );

  if (!locatedStopCount) {
    return { groupId, locatedStopCount, status: 'insufficient_route_locations', recommendedDriverId: null, candidates };
  }
  const recommendation = candidates.find((candidate) => candidate.eligible && candidate.bars > 0);
  return {
    groupId,
    locatedStopCount,
    status: recommendation ? 'supported' : 'insufficient_driver_history',
    recommendedDriverId: recommendation?.driverId || null,
    candidates,
  };
}
