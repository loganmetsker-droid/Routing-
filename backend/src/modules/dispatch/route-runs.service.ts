import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../common/audit/audit.service';
import { Route, RouteStatus, RouteWorkflowStatus } from './entities/route.entity';
import { RouteAssignment } from './entities/route-assignment.entity';
import { RouteRunStop } from './entities/route-run-stop.entity';
import { StopEvent } from './entities/stop-event.entity';
import { DispatchException } from './entities/dispatch-exception.entity';
import { ProofArtifact } from './entities/proof-artifact.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Telemetry } from '../tracking/entities/telemetry.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformService } from '../platform/platform.service';
import type {
  DriverManifestResponse,
  PublicTrackingResponse,
  RouteRunsBoardResponse,
  RouteRunsDetailResponse,
  RouteRunsExceptionsResponse,
  RouteRunsListResponse,
  RouteRunShareLinkResponse,
  RouteRunStopProofsResponse,
  RouteRunStopTimelineResponse,
} from './dispatch.types';
import { NotificationDelivery } from '../notifications/entities/notification-delivery.entity';

type Actor = {
  userId?: string;
  organizationId?: string;
  roles?: string[];
  email?: string;
};

@Injectable()
export class RouteRunsService {
  constructor(
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(RouteRunStop)
    private readonly routeRunStops: Repository<RouteRunStop>,
    @InjectRepository(RouteAssignment)
    private readonly routeAssignments: Repository<RouteAssignment>,
    @InjectRepository(StopEvent)
    private readonly stopEvents: Repository<StopEvent>,
    @InjectRepository(DispatchException)
    private readonly exceptions: Repository<DispatchException>,
    @InjectRepository(ProofArtifact)
    private readonly proofs: Repository<ProofArtifact>,
    private readonly audit: AuditService,
    @Optional()
    @InjectRepository(Driver)
    private readonly drivers?: Repository<Driver>,
    @Optional()
    @InjectRepository(Vehicle)
    private readonly vehicles?: Repository<Vehicle>,
    @Optional()
    @InjectRepository(Telemetry)
    private readonly telemetry?: Repository<Telemetry>,
    @Optional()
    @InjectRepository(Organization)
    private readonly organizations?: Repository<Organization>,
    @Optional()
    private readonly jwtService?: JwtService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
    @Optional()
    private readonly platformService?: PlatformService,
  ) {}

  private routeWhere(
    routeId: string,
    organizationId?: string,
  ): FindOptionsWhere<Route> {
    return organizationId ? { id: routeId, organizationId } : { id: routeId };
  }

  private routeListWhere(organizationId?: string): FindOptionsWhere<Route> {
    return organizationId ? { organizationId } : {};
  }

  private stopWhere(
    stopId: string,
    organizationId?: string,
  ): FindOptionsWhere<RouteRunStop> {
    return organizationId ? { id: stopId, organizationId } : { id: stopId };
  }

  private stopListWhere(
    routeId: string,
    organizationId?: string,
  ): FindOptionsWhere<RouteRunStop> {
    return organizationId ? { routeId, organizationId } : { routeId };
  }

  private exceptionRouteWhere(
    routeId: string,
    organizationId?: string,
  ): FindOptionsWhere<DispatchException> {
    return organizationId ? { routeId, organizationId } : { routeId };
  }

  private exceptionListWhere(
    organizationId?: string,
  ): FindOptionsWhere<DispatchException> {
    return organizationId ? { organizationId } : {};
  }

  private normalizeRoles(actor?: Actor) {
    return (actor?.roles ?? []).map((role) => String(role).trim().toUpperCase());
  }

  private isDriverOnlyActor(actor?: Actor) {
    const roles = this.normalizeRoles(actor);
    return roles.includes('DRIVER') && !roles.some((role) => ['OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER'].includes(role));
  }

  private async resolveActorDriver(actor?: Actor) {
    if (!this.isDriverOnlyActor(actor)) {
      return null;
    }
    if (!this.drivers || !actor?.email) {
      throw new BadRequestException('Driver context is unavailable for this workspace');
    }

    const driver = await this.drivers.findOne({
      where: actor.organizationId
        ? { email: actor.email, organizationId: actor.organizationId }
        : { email: actor.email },
    });
    if (!driver) {
      throw new NotFoundException(`Driver record not found for ${actor.email}`);
    }
    return driver;
  }

  private async getRoute(routeId: string, organizationId?: string) {
    const route = await this.routes.findOne({
      where: this.routeWhere(routeId, organizationId),
    });
    if (!route) throw new NotFoundException(`Route run not found: ${routeId}`);
    return route;
  }

  private async getAccessibleRoute(routeId: string, actor?: Actor) {
    const route = await this.getRoute(routeId, actor?.organizationId);
    const driver = await this.resolveActorDriver(actor);
    if (driver && route.driverId !== driver.id) {
      throw new NotFoundException(`Route run not found: ${routeId}`);
    }
    return route;
  }

  private async getStop(stopId: string, actor?: Actor) {
    const stop = await this.routeRunStops.findOne({
      where: this.stopWhere(stopId, actor?.organizationId),
    });
    if (!stop) throw new NotFoundException(`Route run stop not found: ${stopId}`);
    const route = await this.getAccessibleRoute(stop.routeId, actor);
    if (route.id !== stop.routeId) {
      throw new NotFoundException(`Route run stop not found: ${stopId}`);
    }
    return stop;
  }

  private getTrackingBaseUrl() {
    return (process.env.FRONTEND_URL || 'http://127.0.0.1:5184').replace(/\/+$/, '');
  }

  private getTrackingExpiry() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  private async issueTrackingLink(
    route: Route,
    actor?: Actor,
  ): Promise<RouteRunShareLinkResponse> {
    if (!this.jwtService) {
      throw new BadRequestException('JWT signing is unavailable');
    }

    const expiresAt = this.getTrackingExpiry();
    const token = await this.jwtService.signAsync(
      {
        kind: 'public-tracking',
        routeId: route.id,
        organizationId: route.organizationId || actor?.organizationId || null,
      },
      {
        expiresIn: '7d',
      },
    );

    return {
      ok: true,
      token,
      url: `${this.getTrackingBaseUrl()}/track/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async emitWebhookEvent(
    route: Route,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    if (!this.platformService || !route.organizationId) {
      return;
    }

    await this.platformService.dispatchWebhookEvent({
      organizationId: route.organizationId,
      eventType,
      payload,
    });
  }

  private async notifyRouteJobs(
    route: Route,
    eventType:
      | 'assignment'
      | 'en_route'
      | 'arriving_soon'
      | 'delivered'
      | 'failed_delivery'
      | 'exception'
      | 'eta_updated',
    options: {
      routeRunStopId?: string | null;
      jobId?: string | null;
      reason?: string | null;
      eta?: string | null;
    } = {},
    actor?: Actor,
  ) {
    if (!this.notificationsService) {
      return;
    }

    const tracking = await this.issueTrackingLink(route, actor);
    const jobIds = options.jobId
      ? [options.jobId]
      : Array.isArray(route.jobIds)
        ? route.jobIds.filter(Boolean)
        : [];

    await Promise.all(
      jobIds.map((jobId) =>
        this.notificationsService!.notifyCustomer({
          organizationId: route.organizationId || actor?.organizationId || null,
          routeId: route.id,
          routeRunStopId: options.routeRunStopId || null,
          jobId,
          eventType,
          trackingUrl: tracking.url,
          eta:
            options.eta ||
            (route.eta instanceof Date
              ? route.eta.toISOString()
              : route.eta || null),
          reason: options.reason || null,
        }),
      ),
    );
  }

  private getLatestTelemetryForVehicle(vehicleId?: string | null) {
    if (!this.telemetry || !vehicleId) {
      return Promise.resolve(null);
    }

    return this.telemetry.findOne({
      where: { vehicleId },
      order: { timestamp: 'DESC' },
    });
  }

  async board(actor?: Actor): Promise<RouteRunsBoardResponse> {
    const organizationId = actor?.organizationId;
    const routes = await this.routes.find({
      where: this.routeListWhere(organizationId),
      order: { createdAt: 'DESC' },
    });
    const routeIds = routes.map((route) => route.id);
    const stops = routeIds.length
      ? await this.routeRunStops.find({ where: { routeId: In(routeIds) } })
      : [];
    const exceptions = routeIds.length
      ? await this.exceptions.find({
          where: { routeId: In(routeIds), status: 'OPEN' },
        })
      : [];
    return {
      ok: true,
      routes,
      routeRunStops: stops,
      exceptions,
    };
  }

  async list(actor?: Actor): Promise<RouteRunsListResponse> {
    const driver = await this.resolveActorDriver(actor);
    const routes = await this.routes.find({
      where: driver
        ? { organizationId: actor?.organizationId, driverId: driver.id }
        : this.routeListWhere(actor?.organizationId),
      order: { createdAt: 'DESC' },
    });
    return { ok: true, routeRuns: routes };
  }

  async detail(
    routeId: string,
    actor?: Actor,
  ): Promise<RouteRunsDetailResponse> {
    const route = await this.getAccessibleRoute(routeId, actor);
    const stops = await this.routeRunStops.find({
      where: this.stopListWhere(routeId, actor?.organizationId),
      order: { stopSequence: 'ASC' },
    });
    const stopIds = stops.map((stop) => stop.id);
    const exceptions = await this.exceptions.find({
      where: this.exceptionRouteWhere(routeId, actor?.organizationId),
      order: { createdAt: 'DESC' },
    });
    const stopEvents = stopIds.length
      ? await this.stopEvents.find({
          where: { routeRunStopId: In(stopIds) },
          order: { happenedAt: 'ASC' },
        })
      : [];
    const proofArtifacts = stopIds.length
      ? await this.proofs.find({
          where: { routeRunStopId: In(stopIds) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const notificationDeliveries: NotificationDelivery[] =
      this.notificationsService
        ? await this.notificationsService.list(route.organizationId || actor?.organizationId, route.id)
        : [];
    return {
      ok: true,
      routeRun: route,
      stops,
      exceptions,
      stopEvents,
      proofArtifacts,
      notificationDeliveries,
    };
  }

  async dispatchRoute(routeId: string, actor?: Actor) {
    const route = await this.getAccessibleRoute(routeId, actor);
    route.status = RouteStatus.ASSIGNED;
    route.workflowStatus = RouteWorkflowStatus.READY_FOR_DISPATCH;
    await this.routes.save(route);
    this.audit.record({ actorId: actor?.userId || 'system', actorType: 'user', entityType: 'route_run', entityId: routeId, action: 'route-run.dispatched', source: 'user', newValue: { status: route.status }, metadata: { organizationId: actor?.organizationId } });
    await this.notifyRouteJobs(route, 'assignment', {}, actor);
    await this.emitWebhookEvent(route, 'route.published', {
      routeRun: route,
    });
    return { ok: true, routeRun: route };
  }

  async startRoute(routeId: string, actor?: Actor) {
    const route = await this.getAccessibleRoute(routeId, actor);
    route.status = RouteStatus.IN_PROGRESS;
    route.workflowStatus = RouteWorkflowStatus.IN_PROGRESS;
    route.actualStart = new Date();
    await this.routes.save(route);
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_run',
      entityId: routeId,
      action: 'route-run.started',
      source: 'user',
      newValue: { status: route.status, workflowStatus: route.workflowStatus, actualStart: route.actualStart },
      metadata: { organizationId: route.organizationId || actor?.organizationId },
    });
    await this.notifyRouteJobs(route, 'en_route', {}, actor);
    await this.emitWebhookEvent(route, 'route-run.started', {
      routeRun: route,
    });
    return { ok: true, routeRun: route };
  }

  async completeRoute(routeId: string, actor?: Actor) {
    const route = await this.getAccessibleRoute(routeId, actor);
    route.status = RouteStatus.COMPLETED;
    route.workflowStatus = RouteWorkflowStatus.COMPLETED;
    route.completedAt = new Date();
    await this.routes.save(route);
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_run',
      entityId: routeId,
      action: 'route-run.completed',
      source: 'user',
      newValue: { status: route.status, workflowStatus: route.workflowStatus, completedAt: route.completedAt },
      metadata: { organizationId: route.organizationId || actor?.organizationId },
    });
    await this.emitWebhookEvent(route, 'route-run.completed', {
      routeRun: route,
    });
    return { ok: true, routeRun: route };
  }

  async reassign(routeId: string, payload: { driverId?: string; vehicleId?: string; reason?: string }, actor?: Actor) {
    const route = await this.getAccessibleRoute(routeId, actor);
    if (payload.driverId !== undefined) route.driverId = payload.driverId || null;
    if (payload.vehicleId !== undefined && payload.vehicleId) route.vehicleId = payload.vehicleId;
    await this.routes.save(route);
    await this.routeAssignments.save(this.routeAssignments.create({
      organizationId: route.organizationId || actor?.organizationId || null,
      routeId,
      driverId: route.driverId || null,
      vehicleId: route.vehicleId || null,
      assignedByUserId: actor?.userId || null,
      reason: payload.reason || 'manual reassignment',
    }));
    return { ok: true, routeRun: route };
  }

  private async transitionStop(stopId: string, nextStatus: RouteRunStop['status'], actor: Actor | undefined, payload: Record<string, unknown> = {}) {
    const stop = await this.getStop(stopId, actor);
    stop.status = nextStatus;
    if (nextStatus === 'ARRIVED') stop.actualArrival = new Date();
    if (['SERVICED', 'FAILED', 'RESCHEDULED', 'SKIPPED'].includes(nextStatus)) stop.actualDeparture = new Date();
    if (payload.note) stop.notes = String(payload.note);
    await this.routeRunStops.save(stop);
    await this.stopEvents.save(this.stopEvents.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      eventType: nextStatus,
      actorUserId: actor?.userId || null,
      payload,
    }));
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_run_stop',
      entityId: stop.id,
      action: `route-run-stop.${String(nextStatus).toLowerCase()}`,
      source: 'user',
      newValue: {
        status: stop.status,
        routeId: stop.routeId,
        actualArrival: stop.actualArrival,
        actualDeparture: stop.actualDeparture,
        ...payload,
      },
      metadata: { organizationId: stop.organizationId || actor?.organizationId },
    });
    return stop;
  }

  async markArrived(stopId: string, actor?: Actor) {
    const stop = await this.transitionStop(stopId, 'ARRIVED', actor);
    const route = await this.getRoute(
      stop.routeId,
      stop.organizationId || actor?.organizationId || undefined,
    );
    await this.notifyRouteJobs(
      route,
      'arriving_soon',
      { routeRunStopId: stop.id, jobId: stop.jobId },
      actor,
    );
    await this.emitWebhookEvent(route, 'stop.arrived', { stop });
    return { ok: true, stop };
  }

  async markServiced(stopId: string, actor?: Actor) {
    const stop = await this.transitionStop(stopId, 'SERVICED', actor);
    const route = await this.getRoute(
      stop.routeId,
      stop.organizationId || actor?.organizationId || undefined,
    );
    await this.notifyRouteJobs(
      route,
      'delivered',
      { routeRunStopId: stop.id, jobId: stop.jobId },
      actor,
    );
    await this.emitWebhookEvent(route, 'stop.serviced', { stop });
    return { ok: true, stop };
  }
  async addNote(stopId: string, note: string, actor?: Actor) {
    const stop = await this.getStop(stopId, actor);
    stop.notes = note;
    await this.routeRunStops.save(stop);
    await this.stopEvents.save(this.stopEvents.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      eventType: 'NOTE_ADDED',
      actorUserId: actor?.userId || null,
      payload: { note },
    }));
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_run_stop',
      entityId: stop.id,
      action: 'route-run-stop.note-added',
      source: 'user',
      newValue: { routeId: stop.routeId, note },
      metadata: { organizationId: stop.organizationId || actor?.organizationId },
    });
    return { ok: true, stop };
  }

  async failStop(stopId: string, reason: string, actor?: Actor) {
    const stop = await this.transitionStop(stopId, 'FAILED', actor, { reason });
    const exception = await this.exceptions.save(this.exceptions.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeId: stop.routeId,
      routeRunStopId: stop.id,
      code: 'STOP_FAILED',
      message: reason,
      status: 'OPEN',
      details: { reason },
    }));
    const route = await this.getRoute(stop.routeId, stop.organizationId || actor?.organizationId || undefined);
    await this.notifyRouteJobs(
      route,
      'failed_delivery',
      { routeRunStopId: stop.id, jobId: stop.jobId, reason },
      actor,
    );
    await this.emitWebhookEvent(route, 'stop.failed', {
      stop,
      exception,
    });
    return { ok: true, stop, exception };
  }

  async rescheduleStop(stopId: string, reason: string, actor?: Actor) {
    const stop = await this.transitionStop(stopId, 'RESCHEDULED', actor, { reason });
    const exception = await this.exceptions.save(this.exceptions.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeId: stop.routeId,
      routeRunStopId: stop.id,
      code: 'STOP_RESCHEDULED',
      message: reason,
      status: 'OPEN',
      details: { reason },
    }));
    const route = await this.getRoute(stop.routeId, stop.organizationId || actor?.organizationId || undefined);
    await this.notifyRouteJobs(
      route,
      'eta_updated',
      { routeRunStopId: stop.id, jobId: stop.jobId, reason },
      actor,
    );
    await this.emitWebhookEvent(route, 'exception.opened', {
      stop,
      exception,
    });
    return { ok: true, stop, exception };
  }

  async addProof(stopId: string, payload: { type: string; uri: string; metadata?: Record<string, unknown> }, actor?: Actor) {
    const stop = await this.getStop(stopId, actor);
    const proof = await this.proofs.save(this.proofs.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      type: payload.type,
      uri: payload.uri,
      createdByUserId: actor?.userId || null,
      metadata: payload.metadata || {},
    }));
    await this.stopEvents.save(this.stopEvents.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      eventType: 'PROOF_CAPTURED',
      actorUserId: actor?.userId || null,
      payload: { proofId: proof.id, type: proof.type },
    }));
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_run_stop',
      entityId: stop.id,
      action: 'route-run-stop.proof-captured',
      source: 'user',
      newValue: { routeId: stop.routeId, proofId: proof.id, type: proof.type, uri: proof.uri },
      metadata: { organizationId: stop.organizationId || actor?.organizationId },
    });
    const route = await this.getRoute(stop.routeId, stop.organizationId || actor?.organizationId || undefined);
    await this.emitWebhookEvent(route, 'proof.captured', {
      stop,
      proof,
    });
    return { ok: true, proof };
  }

  async getStopTimeline(
    stopId: string,
    actor?: Actor,
  ): Promise<RouteRunStopTimelineResponse> {
    const stop = await this.getStop(stopId, actor);
    const events = await this.stopEvents.find({ where: { routeRunStopId: stop.id }, order: { happenedAt: 'ASC' } });
    return { ok: true, stop, events };
  }

  async getStopProofs(
    stopId: string,
    actor?: Actor,
  ): Promise<RouteRunStopProofsResponse> {
    const stop = await this.getStop(stopId, actor);
    const proofs = await this.proofs.find({ where: { routeRunStopId: stop.id }, order: { createdAt: 'ASC' } });
    return { ok: true, stop, proofs };
  }

  async createException(
    payload: {
      routeId?: string;
      routeRunStopId?: string;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    },
    actor?: Actor,
  ) {
    if (!payload.routeId && !payload.routeRunStopId) {
      throw new BadRequestException('routeId or routeRunStopId is required');
    }
    if (!payload.code || !payload.message) {
      throw new BadRequestException('code and message are required');
    }

    const stop = payload.routeRunStopId
      ? await this.getStop(payload.routeRunStopId, actor)
      : null;
    const routeId = payload.routeId || stop?.routeId;
    if (!routeId) {
      throw new BadRequestException('Unable to resolve route for exception');
    }

    const route = await this.getAccessibleRoute(routeId, actor);
    const exception = await this.exceptions.save(
      this.exceptions.create({
        organizationId: route.organizationId || actor?.organizationId || null,
        routeId: route.id,
        routeRunStopId: stop?.id || payload.routeRunStopId || null,
        code: payload.code,
        message: payload.message,
        status: 'OPEN',
        details: payload.details || {},
      }),
    );

    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'exception',
      entityId: exception.id,
      action: 'exception.created',
      source: 'user',
      newValue: {
        routeId: route.id,
        routeRunStopId: exception.routeRunStopId,
        code: exception.code,
        message: exception.message,
      },
      metadata: { organizationId: route.organizationId || actor?.organizationId },
    });

    await this.notifyRouteJobs(
      route,
      'exception',
      {
        routeRunStopId: exception.routeRunStopId || null,
        jobId: stop?.jobId || null,
        reason: payload.message,
      },
      actor,
    );
    await this.emitWebhookEvent(route, 'exception.opened', {
      exception,
    });

    return { ok: true, exception };
  }

  async listExceptions(
    organizationId?: string,
  ): Promise<RouteRunsExceptionsResponse> {
    return {
      ok: true,
      exceptions: await this.exceptions.find({
        where: this.exceptionListWhere(organizationId),
        order: { createdAt: 'DESC' },
      }),
    };
  }

  async resolveException(exceptionId: string, actor?: Actor, status: 'ACKNOWLEDGED' | 'RESOLVED' = 'RESOLVED') {
    const exception = await this.exceptions.findOne({
      where: actor?.organizationId
        ? { id: exceptionId, organizationId: actor.organizationId }
        : { id: exceptionId },
    });
    if (!exception) throw new NotFoundException(`Exception not found: ${exceptionId}`);
    exception.status = status;
    if (status === 'ACKNOWLEDGED') exception.acknowledgedByUserId = actor?.userId || null;
    if (status === 'RESOLVED') {
      exception.resolvedByUserId = actor?.userId || null;
      exception.resolvedAt = new Date();
    }
    await this.exceptions.save(exception);
    const route = await this.getRoute(
      exception.routeId,
      exception.organizationId || actor?.organizationId || undefined,
    );
    await this.emitWebhookEvent(route, 'exception.resolved', {
      exception,
      status,
    });
    return { ok: true, exception };
  }

  async createPublicTrackingLink(
    routeId: string,
    actor?: Actor,
  ): Promise<RouteRunShareLinkResponse> {
    const route = await this.getAccessibleRoute(routeId, actor);
    return this.issueTrackingLink(route, actor);
  }

  async getPublicTracking(token: string): Promise<PublicTrackingResponse> {
    if (!this.jwtService) {
      throw new BadRequestException('JWT verification is unavailable');
    }

    const payload = await this.jwtService.verifyAsync<{
      kind?: string;
      routeId?: string;
      organizationId?: string | null;
      exp?: number;
    }>(token);
    if (payload.kind !== 'public-tracking' || !payload.routeId) {
      throw new BadRequestException('Invalid tracking token');
    }

    const route = await this.getRoute(
      payload.routeId,
      payload.organizationId || undefined,
    );
    const stops = await this.routeRunStops.find({
      where: this.stopListWhere(route.id, route.organizationId),
      order: { stopSequence: 'ASC' },
    });
    const vehicle = this.vehicles
      ? await this.vehicles.findOne({
          where: route.vehicleId ? { id: route.vehicleId } : { id: '' },
        })
      : null;
    const telemetry = await this.getLatestTelemetryForVehicle(route.vehicleId);
    const organization =
      route.organizationId && this.organizations
        ? await this.organizations.findOne({
            where: { id: route.organizationId },
          })
        : null;
    const branding =
      organization?.settings &&
      typeof organization.settings === 'object' &&
      organization.settings !== null &&
      typeof organization.settings.branding === 'object' &&
      organization.settings.branding !== null &&
      !Array.isArray(organization.settings.branding)
        ? (organization.settings.branding as Record<string, unknown>)
        : {};

    return {
      ok: true,
      organization: {
        id: organization?.id || route.organizationId || 'unknown-org',
        name: organization?.name || 'Trovan Logistics',
        slug: organization?.slug || 'trovan',
        branding: {
          brandName:
            typeof branding.brandName === 'string' ? branding.brandName : undefined,
          primaryColor:
            typeof branding.primaryColor === 'string'
              ? branding.primaryColor
              : undefined,
          accentColor:
            typeof branding.accentColor === 'string'
              ? branding.accentColor
              : undefined,
          supportEmail:
            typeof branding.supportEmail === 'string'
              ? branding.supportEmail
              : undefined,
          supportPhone:
            typeof branding.supportPhone === 'string'
              ? branding.supportPhone
              : undefined,
          trackingHeadline:
            typeof branding.trackingHeadline === 'string'
              ? branding.trackingHeadline
              : undefined,
          trackingSubtitle:
            typeof branding.trackingSubtitle === 'string'
              ? branding.trackingSubtitle
              : undefined,
        },
      },
      routeRun: route,
      stops,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            make: vehicle.make,
            model: vehicle.model,
            licensePlate: vehicle.licensePlate,
            status: vehicle.status,
          }
        : null,
      latestTelemetry: telemetry
        ? {
            latitude: Number(telemetry.location?.lat || 0),
            longitude: Number(telemetry.location?.lng || 0),
            speed:
              telemetry.speed !== undefined ? Number(telemetry.speed) : null,
            heading:
              telemetry.heading !== undefined ? Number(telemetry.heading) : null,
            timestamp: telemetry.timestamp.toISOString(),
          }
        : null,
      expiresAt: new Date((payload.exp || 0) * 1000).toISOString(),
    };
  }

  async getDriverManifest(actor?: Actor): Promise<DriverManifestResponse> {
    const driver = await this.resolveActorDriver(actor);
    const effectiveDriver =
      driver ||
      (actor?.organizationId && this.drivers
        ? await this.drivers.findOne({
            where: { organizationId: actor.organizationId },
            order: { createdAt: 'ASC' },
          })
        : null);

    if (!effectiveDriver) {
      throw new NotFoundException('Driver manifest is unavailable');
    }

    const routes = await this.routes.find({
      where: actor?.organizationId
        ? {
            organizationId: actor.organizationId,
            driverId: effectiveDriver.id,
          }
        : {
            driverId: effectiveDriver.id,
          },
      order: {
        plannedStart: 'ASC',
        createdAt: 'DESC',
      },
    });

    const manifestRoutes = await Promise.all(
      routes.map(async (route) => {
        const stops = await this.routeRunStops.find({
          where: this.stopListWhere(route.id, route.organizationId),
          order: { stopSequence: 'ASC' },
        });
        const completedStops = stops.filter((stop) =>
          ['SERVICED', 'FAILED', 'SKIPPED'].includes(stop.status),
        ).length;
        const nextStop =
          stops.find((stop) => !['SERVICED', 'FAILED', 'SKIPPED'].includes(stop.status)) ||
          null;
        const vehicle = this.vehicles
          ? await this.vehicles.findOne({
              where: route.vehicleId ? { id: route.vehicleId } : { id: '' },
            })
          : null;
        const telemetry = await this.getLatestTelemetryForVehicle(route.vehicleId);

        return {
          routeRun: route,
          stops,
          vehicle: vehicle
            ? {
                id: vehicle.id,
                make: vehicle.make,
                model: vehicle.model,
                licensePlate: vehicle.licensePlate,
                status: vehicle.status,
              }
            : null,
          latestTelemetry: telemetry
            ? {
                latitude: Number(telemetry.location?.lat || 0),
                longitude: Number(telemetry.location?.lng || 0),
                speed:
                  telemetry.speed !== undefined ? Number(telemetry.speed) : null,
                heading:
                  telemetry.heading !== undefined
                    ? Number(telemetry.heading)
                    : null,
                timestamp: telemetry.timestamp.toISOString(),
              }
            : null,
          progress: {
            totalStops: stops.length,
            completedStops,
            remainingStops: Math.max(stops.length - completedStops, 0),
            nextStopId: nextStop?.id || null,
          },
        };
      }),
    );

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      driver: {
        id: effectiveDriver.id,
        firstName: effectiveDriver.firstName,
        lastName: effectiveDriver.lastName,
        email: effectiveDriver.email,
        phone: effectiveDriver.phone,
        currentVehicleId: effectiveDriver.currentVehicleId || null,
      },
      routes: manifestRoutes,
    };
  }
}
