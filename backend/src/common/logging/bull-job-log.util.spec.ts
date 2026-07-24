import { describe, expect, it } from 'vitest';
import { summarizeBullJobDataForLog } from './bull-job-log.util';

describe('summarizeBullJobDataForLog', () => {
  it('does not include arbitrary job data values', () => {
    const summary = summarizeBullJobDataForLog({
      jobId: 'job-123',
      organizationId: 'org-1',
      address: '123 Main St',
      lat: 39.1,
      lng: -94.5,
      notes: 'gate code 1234',
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).toContain('job-123');
    expect(serialized).toContain('org-1');
    expect(serialized).not.toContain('123 Main St');
    expect(serialized).not.toContain('gate code 1234');
    expect(serialized).not.toContain('39.1');
    expect(serialized).not.toContain('-94.5');
  });

  it('truncates large key sets to avoid log amplification', () => {
    const input = Object.fromEntries(Array.from({ length: 30 }, (_, idx) => [`key_${idx}`, idx]));
    const summary = summarizeBullJobDataForLog({ jobId: 'job-1', ...input });

    expect(summary.keys.length).toBe(25);
    expect(summary.truncatedKeys).toBe(true);
  });
});
