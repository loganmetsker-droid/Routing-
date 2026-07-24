import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportJobsDto } from './import-jobs.dto';

async function validateDto(input: unknown) {
  const instance = plainToInstance(ImportJobsDto, input);
  return validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('ImportJobsDto', () => {
  it('accepts an empty payload (backwards compatible) and returns no errors', async () => {
    await expect(validateDto({})).resolves.toHaveLength(0);
  });

  it('rejects non-array jobs', async () => {
    const errors = await validateDto({ jobs: 'not-an-array' });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('jobs');
  });

  it('validates nested CreateJobDto payloads', async () => {
    const errors = await validateDto({
      jobs: [
        {
          customerName: 'Acme Co',
        },
      ],
    });

    expect(errors).toHaveLength(1);
    const jobsError = errors[0];
    expect(jobsError?.property).toBe('jobs');
    expect(jobsError?.children?.[0]?.children?.length).toBeGreaterThan(0);
  });

  it('accepts a minimal valid job', async () => {
    await expect(
      validateDto({
        jobs: [
          {
            customerName: 'Acme Co',
            deliveryAddress: '100 Main St, Austin, TX',
          },
        ],
      }),
    ).resolves.toHaveLength(0);
  });
});
