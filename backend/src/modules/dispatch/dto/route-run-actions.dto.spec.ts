import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RouteRunMessageDto } from './route-run-actions.dto';

async function validateDto(input: unknown) {
  const instance = plainToInstance(RouteRunMessageDto, input);
  return {
    instance,
    errors: await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  };
}

describe('RouteRunMessageDto', () => {
  it('trims body values', async () => {
    const { instance, errors } = await validateDto({ body: '  hello  ' });
    expect(errors).toHaveLength(0);
    expect(instance.body).toBe('hello');
  });

  it('rejects blank bodies', async () => {
    const { errors } = await validateDto({ body: '   ' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('body');
  });

  it('accepts an optional stop id', async () => {
    const { errors } = await validateDto({
      body: 'note',
      routeRunStopId: '4d1f1b8a-84bf-4ea0-a6bc-9116300df06a',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid stop ids', async () => {
    const { errors } = await validateDto({
      body: 'note',
      routeRunStopId: 'not-a-uuid',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('routeRunStopId');
  });

  it('rejects unknown properties', async () => {
    const { errors } = await validateDto({
      body: 'hello',
      extra: 'nope',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('extra');
  });
});
