import { JobStatus } from './entities/job.entity';
import {
  isJobTransitionAllowed,
  normalizeLifecycleJobStatus,
} from './jobs-workflow';

describe('jobs workflow', () => {
  it('normalizes legacy and canonical aliases', () => {
    expect(normalizeLifecycleJobStatus('unscheduled')).toBe(JobStatus.PENDING);
    expect(normalizeLifecycleJobStatus('scheduled')).toBe(JobStatus.ASSIGNED);
    expect(normalizeLifecycleJobStatus('ready_to_plan')).toBe(JobStatus.PENDING);
    expect(normalizeLifecycleJobStatus('planned')).toBe(JobStatus.ASSIGNED);
    expect(normalizeLifecycleJobStatus('exception')).toBe(JobStatus.FAILED);
  });

  it('allows valid transitions and blocks invalid ones', () => {
    expect(isJobTransitionAllowed(JobStatus.PENDING, JobStatus.ASSIGNED)).toBe(true);
    expect(isJobTransitionAllowed(JobStatus.IN_PROGRESS, JobStatus.COMPLETED)).toBe(true);
    expect(isJobTransitionAllowed(JobStatus.COMPLETED, JobStatus.PENDING)).toBe(false);
  });
});
