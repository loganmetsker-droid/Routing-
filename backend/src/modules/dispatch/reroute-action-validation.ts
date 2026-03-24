import { BadRequestException } from '@nestjs/common';
import { Route } from './entities/route.entity';
import { RerouteAction } from './entities/reroute-request.entity';

export const validateRerouteActionPayload = (
  action: RerouteAction,
  payload: Record<string, any> | undefined,
  route: Pick<Route, 'jobIds' | 'driverId' | 'vehicleId'>,
) => {
  const data = payload || {};

  if (action === 'reorder_stops') {
    if (!Array.isArray(data.newJobOrder) || data.newJobOrder.length !== route.jobIds.length) {
      throw new BadRequestException('reorder_stops requires newJobOrder with full route length');
    }
    const invalidJobs = data.newJobOrder.filter((id: string) => !route.jobIds.includes(id));
    if (invalidJobs.length > 0) {
      throw new BadRequestException(`reorder_stops has invalid job ids: ${invalidJobs.join(', ')}`);
    }
    return;
  }

  if (action === 'reassign_stop_to_route' || action === 'remove_stop' || action === 'hold_stop') {
    if (typeof data.jobId !== 'string') {
      throw new BadRequestException(`${action} requires jobId`);
    }
    if (!route.jobIds.includes(data.jobId)) {
      throw new BadRequestException(`${action} jobId must belong to route`);
    }
    if (action === 'reassign_stop_to_route') {
      if (typeof data.targetRouteId !== 'string') {
        throw new BadRequestException('reassign_stop_to_route requires targetRouteId');
      }
    }
    return;
  }

  if (action === 'reassign_driver') {
    if (typeof data.driverId !== 'string') {
      throw new BadRequestException('reassign_driver requires driverId');
    }
    return;
  }

  if (action === 'split_route') {
    if (typeof data.splitAtIndex !== 'number') {
      throw new BadRequestException('split_route requires splitAtIndex');
    }
    if (data.splitAtIndex <= 0 || data.splitAtIndex >= route.jobIds.length) {
      throw new BadRequestException('split_route splitAtIndex must split route into two non-empty segments');
    }
    return;
  }
};
