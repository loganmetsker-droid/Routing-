import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { DispatchController } from './dispatch.controller';

function rolesFor(methodName: keyof DispatchController) {
  return Reflect.getMetadata(ROLES_KEY, DispatchController.prototype[methodName]);
}

describe('DispatchController lifecycle RBAC', () => {
  it('keeps broad route lifecycle mutations dispatcher/admin scoped', () => {
    expect(rolesFor('startRoute')).toEqual(['OWNER', 'ADMIN', 'DISPATCHER']);
    expect(rolesFor('completeRoute')).toEqual(['OWNER', 'ADMIN', 'DISPATCHER']);
    expect(rolesFor('requestReroute')).toEqual(['OWNER', 'ADMIN', 'DISPATCHER']);
  });
});
