import { BadRequestException } from '@nestjs/common';

export const splitRouteJobIds = (jobIds: string[], splitAtIndex: number) => {
  if (!Array.isArray(jobIds) || jobIds.length < 2) {
    throw new BadRequestException('Route must contain at least 2 jobs to split');
  }
  if (splitAtIndex <= 0 || splitAtIndex >= jobIds.length) {
    throw new BadRequestException('splitAtIndex must split route into non-empty groups');
  }
  return {
    parentJobIds: jobIds.slice(0, splitAtIndex),
    childJobIds: jobIds.slice(splitAtIndex),
  };
};

export const assertSplitRouteConsistency = (
  originalJobIds: string[],
  parentJobIds: string[],
  childJobIds: string[],
) => {
  const originalSet = new Set(originalJobIds);
  const parentSet = new Set(parentJobIds);
  const childSet = new Set(childJobIds);
  const recombined = [...parentJobIds, ...childJobIds];
  const recombinedSet = new Set(recombined);

  if (recombined.length !== originalJobIds.length) {
    throw new BadRequestException('split_route produced duplicate or missing jobs');
  }
  if (recombinedSet.size !== originalSet.size) {
    throw new BadRequestException('split_route job identity mismatch');
  }
  if (parentSet.size !== parentJobIds.length || childSet.size !== childJobIds.length) {
    throw new BadRequestException('split_route contains duplicate job IDs');
  }
  for (const jobId of originalSet) {
    if (!recombinedSet.has(jobId)) {
      throw new BadRequestException(`split_route lost job ${jobId}`);
    }
  }
};
