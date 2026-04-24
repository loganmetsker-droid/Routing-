import { INestApplication, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { OrganizationsService } from '../organizations/organizations.service';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';
import { DispatchWorker } from './dispatch.worker';
import { AuditService } from '../../common/audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkosService } from '../../common/integrations/workos.service';

describe('Dispatch HTTP integration', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const routeId = '11111111-1111-4111-8111-111111111111';
  const targetRouteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const driverId = '22222222-2222-4222-8222-222222222222';
  const publishedVersionId = '33333333-3333-4333-8333-333333333333';
  const autoDraftVersionId = '44444444-4444-4444-8444-444444444444';
  const draftVersionId = '77777777-7777-4777-8777-777777777777';

  const state = {
    route: {
      id: routeId,
      vehicleId: '55555555-5555-4555-8555-555555555555',
      driverId: null as string | null,
      jobIds: ['66666666-6666-4666-8666-666666666666'],
      status: 'assigned',
      workflowStatus: 'ready_for_dispatch',
      routeData: {
        route_version: {
          versionId: publishedVersionId,
          versionNumber: 1,
          status: 'PUBLISHED',
          publishedAt: '2026-04-10T10:00:00.000Z',
        },
      },
    },
    targetRoute: {
      id: targetRouteId,
      vehicleId: '99999999-9999-4999-8999-999999999999',
      driverId: '88888888-8888-4888-8888-888888888888',
      jobIds: [],
      status: 'assigned',
      workflowStatus: 'ready_for_dispatch',
      routeData: {
        route_version: {
          versionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          versionNumber: 1,
          status: 'PUBLISHED',
          publishedAt: '2026-04-10T10:00:00.000Z',
        },
      },
    },
    versions: [
      {
        id: publishedVersionId,
        routeId,
        versionNumber: 1,
        status: 'PUBLISHED',
        snapshot: {},
        createdAt: '2026-04-10T09:00:00.000Z',
        publishedAt: '2026-04-10T10:00:00.000Z',
      },
    ] as any[],
    actors: [] as Array<{ action: string; actorUserId?: string; role?: string }>,
  };

  const dispatchServiceMock = {
    presentRoute: (route: any) => route,
    getOptimizerHealth: () => ({
      status: 'healthy',
      circuitOpen: false,
      consecutiveFailures: 0,
      lastCheckedAt: '2026-04-10T10:00:00.000Z',
      message: 'ok',
    }),
    findAll: async () => [state.route],
    moveStopToRoute: async (_routeId: string, payload: any, actor: any) => {
      state.route = {
        ...state.route,
        jobIds: state.route.jobIds.filter((jobId) => jobId !== payload.jobId),
      };
      state.targetRoute = {
        ...state.targetRoute,
        jobIds: [
          ...state.targetRoute.jobIds.slice(0, payload.targetSequence),
          payload.jobId,
          ...state.targetRoute.jobIds.slice(payload.targetSequence),
        ],
      };
      state.actors.push({ action: 'moveStop', actorUserId: actor.userId, role: actor.roles?.[0] });
      return {
        sourceRoute: state.route,
        targetRoute: state.targetRoute,
      };
    },
    assignDriver: async (_routeId: string, assignedDriverId: string, actor: any) => {
      state.route = {
        ...state.route,
        driverId: assignedDriverId,
        routeData: {
          ...state.route.routeData,
          route_version: {
            versionId: autoDraftVersionId,
            versionNumber: 2,
            status: 'DRAFT',
            lastPublishedVersionId: publishedVersionId,
            lastPublishedVersionNumber: 1,
          },
        },
      };
      state.versions = [
        {
          id: autoDraftVersionId,
          routeId,
          versionNumber: 2,
          status: 'DRAFT',
          snapshot: {},
          createdAt: '2026-04-10T10:05:00.000Z',
          createdByUserId: actor.userId,
        },
        ...state.versions.map((version) =>
          version.id === publishedVersionId ? { ...version, status: 'SUPERSEDED' } : version,
        ),
      ];
      state.actors.push({ action: 'assignDriver', actorUserId: actor.userId, role: actor.roles?.[0] });
      return state.route;
    },
    listRouteVersions: async () => state.versions,
    createRouteVersionSnapshot: async (_routeId: string, actor: any) => {
      const draft = {
        id: draftVersionId,
        routeId,
        versionNumber: 3,
        status: 'DRAFT',
        snapshot: {},
        createdAt: '2026-04-10T10:05:00.000Z',
        createdByUserId: actor.userId,
      };
      state.versions = [draft, ...state.versions];
      state.actors.push({ action: 'snapshot', actorUserId: actor.userId, role: actor.roles?.[0] });
      return draft;
    },
    approveRouteVersion: async (_routeId: string, versionId: string, actor: any) => {
      state.versions = state.versions.map((version) =>
        version.id === versionId
          ? {
              ...version,
              status: 'APPROVED',
              approvedByUserId: actor.userId,
              approvedAt: '2026-04-10T10:06:00.000Z',
            }
          : version,
      );
      state.actors.push({ action: 'approve', actorUserId: actor.userId, role: actor.roles?.[0] });
      return state.versions.find((version) => version.id === versionId);
    },
    publishRouteVersion: async (_routeId: string, versionId: string, actor: any) => {
      state.versions = state.versions.map((version) => {
        if (version.id === versionId) {
          return {
            ...version,
            status: 'PUBLISHED',
            publishedByUserId: actor.userId,
            publishedAt: '2026-04-10T10:07:00.000Z',
          };
        }
        return version.status === 'PUBLISHED' ? { ...version, status: 'SUPERSEDED' } : version;
      });
      const published = state.versions.find((version) => version.id === versionId);
      state.route = {
        ...state.route,
        routeData: {
          ...state.route.routeData,
          route_version: {
            versionId,
            versionNumber: published?.versionNumber,
            status: 'PUBLISHED',
            publishedAt: published?.publishedAt,
          },
        },
      };
      state.actors.push({ action: 'publish', actorUserId: actor.userId, role: actor.roles?.[0] });
      return published;
    },
    startRoute: async (_routeId: string, actor: any) => {
      state.route = {
        ...state.route,
        status: 'in_progress',
        workflowStatus: 'in_progress',
      };
      state.actors.push({ action: 'start', actorUserId: actor.userId, role: actor.roles?.[0] });
      return state.route;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              AUTH_ADMIN_EMAIL: 'admin@example.com',
              AUTH_ADMIN_PASSWORD: 'ChangeMe123!',
              AUTH_ADMIN_ROLE: 'ADMIN',
              AUTH_ADMIN_ROLES: 'ADMIN,DISPATCHER',
              AUTH_SESSION_ENFORCEMENT: 'false',
              JWT_SECRET: 'integration-secret',
              NODE_ENV: 'test',
            }),
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>('JWT_SECRET'),
            signOptions: { expiresIn: 60 * 60 },
          }),
        }),
      ],
      controllers: [AuthController, DispatchController],
      providers: [
        AuthService,
        JwtStrategy,
        {
          provide: OrganizationsService,
          useValue: {
            ensureBootstrapOrganization: vi.fn(async (email: string, displayName: string, roles: string[]) => ({
              organization: { id: 'org-1', slug: 'default' },
              user: { id: 'user-1', email, displayName },
              membership: { id: 'membership-1', role: roles[0], roles },
            })),
          },
        },
        {
          provide: WorkosService,
          useValue: {
            getConfiguration: vi.fn(() => ({
              preferredProvider: 'local-config',
              localLoginAllowed: true,
              enabled: false,
              configured: false,
              workos: {
                clientIdConfigured: false,
              },
            })),
            isConfigured: vi.fn(() => false),
          },
        },
        {
          provide: getRepositoryToken(AuthSession),
          useValue: {
            create: vi.fn((value) => value),
            save: vi.fn(async (value) => ({
              id: 'session-1',
              ...value,
              createdAt: new Date('2026-04-10T10:00:00.000Z'),
              updatedAt: new Date('2026-04-10T10:00:00.000Z'),
              revokedAt: null,
            })),
            findOne: vi.fn(async () => ({
              id: 'session-1',
              userId: 'user-1',
              revokedAt: null,
              lastSeenAt: new Date(),
            })),
          },
        },
        { provide: DispatchService, useValue: dispatchServiceMock },
        { provide: DispatchWorker, useValue: {} },
        { provide: AuditService, useValue: { record: vi.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    const reflector = app.get(Reflector);
    app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));
    await app.init();
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('supports authenticated dispatch lifecycle and rejects unauthorized mutation', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'ChangeMe123!' })
      .expect(201);

    const adminToken = loginResponse.body.accessToken as string;
    expect(adminToken).toBeTruthy();

    await request(app.getHttpServer())
      .get('/api/dispatch/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.routes).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .post(`/api/dispatch/routes/${routeId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ driverId })
      .expect(201)
      .expect((response) => {
        expect(response.body.route.driverId).toBe(driverId);
        expect(response.body.route.routeData.route_version.status).toBe('DRAFT');
      });

    await request(app.getHttpServer())
      .post(`/api/dispatch/routes/${routeId}/move-stop`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        jobId: '66666666-6666-4666-8666-666666666666',
        targetRouteId,
        targetSequence: 0,
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.sourceRoute.id).toBe(routeId);
        expect(response.body.targetRoute.id).toBe(targetRouteId);
        expect(response.body.targetRoute.jobIds).toContain('66666666-6666-4666-8666-666666666666');
        expect(response.body.optimizerHealth.status).toBe('healthy');
      });

    const snapshotResponse = await request(app.getHttpServer())
      .post(`/api/dispatch/routes/${routeId}/versions/snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(snapshotResponse.body.version.status).toBe('DRAFT');

    const approveResponse = await request(app.getHttpServer())
      .post(`/api/dispatch/routes/${routeId}/versions/${draftVersionId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(approveResponse.body.version.status).toBe('APPROVED');

    const publishResponse = await request(app.getHttpServer())
      .post(`/api/dispatch/routes/${routeId}/versions/${draftVersionId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(publishResponse.body.version.status).toBe('PUBLISHED');

    await request(app.getHttpServer())
      .patch(`/api/dispatch/routes/${routeId}/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.route.status).toBe('in_progress');
      });

    const viewerToken = await jwtService.signAsync({
      sub: 'viewer-user',
      email: 'viewer@example.com',
      role: 'VIEWER',
      roles: ['VIEWER'],
    });

    await request(app.getHttpServer())
      .post(`/api/dispatch/routes/${routeId}/assign`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ driverId })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/dispatch/routes/${routeId}/assign`)
      .send({ driverId })
      .expect(401);

    expect(state.actors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'assignDriver', actorUserId: 'user-1' }),
        expect.objectContaining({ action: 'moveStop', actorUserId: 'user-1' }),
        expect.objectContaining({ action: 'snapshot', actorUserId: 'user-1' }),
        expect.objectContaining({ action: 'approve', actorUserId: 'user-1' }),
        expect.objectContaining({ action: 'publish', actorUserId: 'user-1' }),
        expect.objectContaining({ action: 'start', actorUserId: 'user-1' }),
      ]),
    );
  });
});
