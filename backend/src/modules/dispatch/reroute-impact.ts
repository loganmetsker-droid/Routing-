export const buildRerouteImpactSummary = (beforeSnapshot: any, afterSnapshot: any) => {
  const beforeJobIds: string[] = Array.isArray(beforeSnapshot?.jobIds)
    ? beforeSnapshot.jobIds
    : [];
  const afterJobIds: string[] = Array.isArray(afterSnapshot?.jobIds)
    ? afterSnapshot.jobIds
    : [];

  const droppedJobs = beforeJobIds.filter((id) => !afterJobIds.includes(id));
  const insertedJobs = afterJobIds.filter((id) => !beforeJobIds.includes(id));

  const stopOrderChanged =
    beforeJobIds.length === afterJobIds.length &&
    beforeJobIds.some((id, idx) => afterJobIds[idx] !== id);

  const distanceDeltaKm =
    (afterSnapshot?.totalDistanceKm || 0) - (beforeSnapshot?.totalDistanceKm || 0);
  const durationDeltaMinutes =
    (afterSnapshot?.totalDurationMinutes || 0) -
    (beforeSnapshot?.totalDurationMinutes || 0);

  return {
    stopOrderChanged,
    droppedJobs,
    insertedJobs,
    distanceDeltaKm: Number(distanceDeltaKm.toFixed(2)),
    durationDeltaMinutes: Number(durationDeltaMinutes.toFixed(2)),
    dataQualityChanged:
      (beforeSnapshot?.dataQuality || 'live') !==
      (afterSnapshot?.dataQuality || 'live'),
    optimizationStatusChanged:
      (beforeSnapshot?.optimizationStatus || 'optimized') !==
      (afterSnapshot?.optimizationStatus || 'optimized'),
    degradedOrSimulated:
      afterSnapshot?.dataQuality === 'degraded' ||
      afterSnapshot?.dataQuality === 'simulated',
  };
};

export const preserveDegradedOrSimulatedQuality = (
  previousQuality: 'live' | 'degraded' | 'simulated',
): 'degraded' | 'simulated' => {
  return previousQuality === 'simulated' ? 'simulated' : 'degraded';
};

export const isDispatchBlockedByRerouteState = (
  rerouteState?: string | null,
): boolean => {
  return rerouteState === 'requested' || rerouteState === 'approved';
};
