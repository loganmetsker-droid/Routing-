import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkosCallbackDto } from './workos-callback.dto';

async function validateDto(input: unknown) {
  const instance = plainToInstance(WorkosCallbackDto, input);
  return validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('WorkosCallbackDto', () => {
  it('accepts a minimal payload', async () => {
    await expect(validateDto({ code: 'abc' })).resolves.toHaveLength(0);
  });

  it('accepts optional state and invitationToken', async () => {
    await expect(
      validateDto({ code: 'abc', state: 'xyz', invitationToken: 'invite' }),
    ).resolves.toHaveLength(0);
  });

  it('rejects missing code', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('code');
  });

  it('rejects non-string code', async () => {
    const errors = await validateDto({ code: 123 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('code');
  });

  it('rejects unknown properties', async () => {
    const errors = await validateDto({ code: 'abc', extra: 'nope' });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('extra');
  });
});
