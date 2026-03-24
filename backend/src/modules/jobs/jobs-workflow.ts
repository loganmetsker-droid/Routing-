import { JobStatus } from './entities/job.entity';

const JOB_STATUS_ALIASES: Record<string, JobStatus> = {
  draft: JobStatus.UNSCHEDULED,
  ready_to_plan: JobStatus.PENDING,
  planned: JobStatus.ASSIGNED,
  dispatched: JobStatus.ASSIGNED,
  exception: JobStatus.FAILED,
  unscheduled: JobStatus.PENDING,
  scheduled: JobStatus.ASSIGNED,
};

export const normalizeLifecycleJobStatus = (
  status: string | JobStatus,
): JobStatus => {
  const key = String(status || '').toLowerCase();
  if (JOB_STATUS_ALIASES[key]) {
    return JOB_STATUS_ALIASES[key];
  }
  return status as JobStatus;
};

export const JOB_ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [
    JobStatus.ASSIGNED,
    JobStatus.IN_PROGRESS,
    JobStatus.CANCELLED,
    JobStatus.ARCHIVED,
    JobStatus.FAILED,
  ],
  [JobStatus.ASSIGNED]: [
    JobStatus.IN_PROGRESS,
    JobStatus.CANCELLED,
    JobStatus.ARCHIVED,
    JobStatus.FAILED,
  ],
  [JobStatus.IN_PROGRESS]: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED],
  [JobStatus.COMPLETED]: [JobStatus.ARCHIVED],
  [JobStatus.ARCHIVED]: [],
  [JobStatus.CANCELLED]: [JobStatus.PENDING, JobStatus.ARCHIVED],
  [JobStatus.FAILED]: [
    JobStatus.PENDING,
    JobStatus.ASSIGNED,
    JobStatus.CANCELLED,
    JobStatus.ARCHIVED,
  ],
  [JobStatus.UNSCHEDULED]: [JobStatus.PENDING],
  [JobStatus.SCHEDULED]: [JobStatus.ASSIGNED],
};

export const isJobTransitionAllowed = (
  current: string | JobStatus,
  next: string | JobStatus,
): boolean => {
  const normalizedCurrent = normalizeLifecycleJobStatus(current);
  const normalizedNext = normalizeLifecycleJobStatus(next);
  if (normalizedCurrent === normalizedNext) return true;
  return (JOB_ALLOWED_TRANSITIONS[normalizedCurrent] || []).includes(normalizedNext);
};
