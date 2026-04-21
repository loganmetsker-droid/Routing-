import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { DispatchController } from './dispatch.controller';

describe('DispatchController RBAC metadata', () => {
  it('protects dispatch mutations with non-viewer roles', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, DispatchController.prototype.create),
    ).toEqual(['OWNER', 'ADMIN', 'DISPATCHER']);

    expect(
      Reflect.getMetadata(ROLES_KEY, DispatchController.prototype.assignDriver),
    ).toEqual(['OWNER', 'ADMIN', 'DISPATCHER']);

    expect(
      Reflect.getMetadata(ROLES_KEY, DispatchController.prototype.startRoute),
    ).toEqual(['OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER']);
  });

  it('protects read endpoints with viewer-safe roles', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, DispatchController.prototype.findAll),
    ).toEqual(['OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER']);

    expect(
      Reflect.getMetadata(ROLES_KEY, DispatchController.prototype.listRouteVersions),
    ).toEqual(['OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER']);
  });
});
