import { RerouteRequestStatus } from './entities/reroute-request.entity';

export const REROUTE_STATUS_TRANSITIONS: Record<RerouteRequestStatus, RerouteRequestStatus[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['applied', 'cancelled'],
  rejected: [],
  applied: [],
  cancelled: [],
};

export const canTransitionRerouteRequest = (
  from: RerouteRequestStatus,
  to: RerouteRequestStatus,
): boolean => {
  if (from === to) return true;
  return (REROUTE_STATUS_TRANSITIONS[from] || []).includes(to);
};
