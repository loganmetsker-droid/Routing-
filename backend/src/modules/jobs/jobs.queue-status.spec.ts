import { JobsService } from './jobs.service';
import { JobPriority, type Job } from './entities/job.entity';

function queuedJob(): Job {
  return {
    id: 'job-queue-status',
    priority: JobPriority.NORMAL,
    timeWindowStart: new Date('2026-07-25T09:00:00.000Z'),
    timeWindowEnd: new Date('2026-07-25T10:00:00.000Z'),
  } as Job;
}

describe('JobsService queue status', () => {
  it('reports that queueing was skipped when Redis is disabled', async () => {
    const service = new JobsService({} as never, {} as never);

    await expect(service.addToQueue(queuedJob())).resolves.toBe(false);
  });

  it('reports successful queueing only after the queue accepts the job', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-queue-status' }),
    };
    const service = new JobsService(
      {} as never,
      {} as never,
      queue as never,
    );

    await expect(service.addToQueue(queuedJob())).resolves.toBe(true);
    expect(queue.add).toHaveBeenCalledWith(
      'process-job',
      expect.objectContaining({ jobId: 'job-queue-status' }),
      expect.objectContaining({ jobId: 'job-queue-status' }),
    );
  });
});
