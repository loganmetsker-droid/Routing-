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
import { RouteRunMessage, RouteRunMessageSenderRole } from './entities/route-run-message.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Telemetry } from '../tracking/entities/telemetry.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobStop } from '../jobs/entities/job-stop.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformService } from '../platform/platform.service';
import { ProofStorageService } from './services/proof-storage.service';
import { resolveProofUploadMimeType } from '../../common/files/proof-file.util';
import { MAX_JWT_BEARER_TOKEN_LENGTH } from '../auth/strategies/jwt.strategy';
import type {
  DriverManifestResponse,
  DispatchReadiness,
  PresentedRouteRunStop,
  PublicTrackingResponse,
  RouteRunMessagesResponse,
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

type DispatchRoutePayload = {
  note?: string | null;
};

type UploadedProofFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

type ProofRequirement = 'required' | 'optional' | 'not_required';

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
    @Optional()
    @InjectRepository(RouteRunMessage)
    private readonly routeRunMessages?: Repository<RouteRunMessage>,
    @Optional()
    @InjectRepository(Job)
    private readonly jobs?: Repository<Job>,
    @Optional()
    @InjectRepository(JobStop)
    private readonly jobStops?: Repository<JobStop>,
    @Optional()
    private readonly proofStorage?: ProofStorageService,
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

  private getMessageSenderRole(actor?: Actor): RouteRunMessageSenderRole {
    return this.isDriverOnlyActor(actor) ? 'DRIVER' : 'DISPATCH';
  }

  private getMessagesRepository() {
    if (!this.routeRunMessages) {
      throw new BadRequestException('Route run messaging is unavailable');
    }
    return this.routeRunMessages;
  }

  private getUnreadMessages(messages: RouteRunMessage[], actor?: Actor) {
    const role = this.getMessageSenderRole(actor);
    if (role === 'DRIVER') {
      return messages.filter((message) => message.senderRole !== 'DRIVER' && !message.readByDriverAt);
    }
    return messages.filter((message) => message.senderRole === 'DRIVER' && !message.readByDispatchAt);
  }

  private normalizeStopLocation(
    value?: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null,
  ) {
    if (!value) return null;
    const latitude = Number(value.latitude ?? value.lat);
    const longitude = Number(value.longitude ?? value.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return { latitude, longitude };
  }

  private async getRouteVehicle(route: Route) {
    if (!this.vehicles || !route.vehicleId) {
      return null;
    }

    if (route.organizationId) {
      const scoped = await this.vehicles.findOne({
        where: { id: route.vehicleId, organizationId: route.organizationId },
      });
      if (scoped) {
        return scoped;
      }

      const fallback = await this.vehicles.findOne({
        where: { id: route.vehicleId },
      });
      if (!fallback) {
        return null;
      }
      if (
        typeof fallback.organizationId === 'string' &&
        fallback.organizationId &&
        fallback.organizationId !== route.organizationId
      ) {
        return null;
      }
      return fallback;
    }

    return this.vehicles.findOne({
      where: { id: route.vehicleId },
    });
  }

  private getStopProofRequirements(stop: RouteRunStop): {
    signature: ProofRequirement;
    bol: ProofRequirement;
    documents: ProofRequirement;
  } {
    return {
      signature: stop.proofRequired ? 'required' : 'not_required',
      bol: 'optional',
      documents: 'optional',
    };
  }

  private getStopProofStatus(stop: RouteRunStop, proofs: ProofArtifact[]) {
    const proofType = (proof: ProofArtifact) => String(proof.type).toUpperCase();
    const signatureProof = proofs.find((proof) => proofType(proof) === 'SIGNATURE');
    const bolProofs = proofs.filter((proof) => proofType(proof) === 'BOL');
    const documentProofs = proofs.filter((proof) => proofType(proof) === 'DOCUMENT');
    const bolSkipped = proofs.some(
      (proof) =>
        proofType(proof) === 'BOL_DECISION' &&
        proof.metadata &&
        proof.metadata.required === false,
    );
    const documentsSkipped = proofs.some(
      (proof) =>
        proofType(proof) === 'DOCUMENTS_DECISION' &&
        proof.metadata &&
        proof.metadata.required === false,
    );
    const capturedProofs = proofs.filter(
      (proof) => !['BOL_DECISION', 'DOCUMENTS_DECISION'].includes(proofType(proof)),
    );
    const requirements = this.getStopProofRequirements(stop);
    const signatureComplete =
      requirements.signature !== 'required' || Boolean(signatureProof);
    const bolComplete = requirements.bol !== 'required' || bolProofs.length > 0;
    const documentsComplete =
      requirements.documents !== 'required' || documentProofs.length > 0;
    return {
      proofRequired: Boolean(stop.proofRequired),
      proofCaptured: capturedProofs.length > 0,
      signatureCaptured: Boolean(signatureProof),
      bolCaptured: bolProofs.length > 0,
      documentsCaptured: documentProofs.length > 0,
      bolSkipped,
      documentsSkipped,
      requiredProofComplete: signatureComplete && bolComplete && documentsComplete,
      proofCount: capturedProofs.length,
      capturedCount: capturedProofs.length,
      skippedCount: Number(bolSkipped) + Number(documentsSkipped),
      signatureProofId: signatureProof?.id || null,
      bolProofIds: bolProofs.map((proof) => proof.id),
      documentProofIds: documentProofs.map((proof) => proof.id),
    };
  }

  private parseProofMetadata(value: unknown) {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('Proof metadata must be a JSON object');
    }
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      throw new BadRequestException('Proof metadata must be valid JSON');
    }
    throw new BadRequestException('Proof metadata must be a JSON object');
  }

  private getProofStorage() {
    if (!this.proofStorage) {
      throw new BadRequestException('Proof file storage is unavailable');
    }
    return this.proofStorage;
  }

  private async enrichStops(
    stops: RouteRunStop[],
    organizationId?: string | null,
  ): Promise<PresentedRouteRunStop[]> {
    if (!stops.length) return [];

    const jobIds = [...new Set(stops.map((stop) => stop.jobId).filter(Boolean))];
    const jobStopIds = [...new Set(stops.map((stop) => stop.jobStopId).filter(Boolean))];
    const stopIds = stops.map((stop) => stop.id);

    const [jobs, jobStops, proofs] = await Promise.all([
      this.jobs && jobIds.length
        ? this.jobs.find({
            where: organizationId
              ? { id: In(jobIds), organizationId }
              : { id: In(jobIds) },
          })
        : Promise.resolve([] as Job[]),
      this.jobStops && jobStopIds.length
        ? this.jobStops.find({
            where: organizationId
              ? { id: In(jobStopIds), organizationId }
              : { id: In(jobStopIds) },
          })
        : Promise.resolve([] as JobStop[]),
      stopIds.length
        ? this.proofs.find({ where: { routeRunStopId: In(stopIds) } })
        : Promise.resolve([] as ProofArtifact[]),
    ]);

    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const jobStopsById = new Map(jobStops.map((stop) => [stop.id, stop]));
    const proofsByStop = proofs.reduce<Record<string, ProofArtifact[]>>((acc, proof) => {
      acc[proof.routeRunStopId] = [...(acc[proof.routeRunStopId] || []), proof];
      return acc;
    }, {});

    return stops.map((stop) => {
      const job = jobsById.get(stop.jobId);
      const jobStop = jobStopsById.get(stop.jobStopId);
      const instructions = [
        jobStop?.notes,
        job?.specialInstructions,
        job?.notes,
      ]
        .filter((item): item is string => Boolean(item && String(item).trim()))
        .map((item) => item.trim())
        .filter((item, index, all) => all.indexOf(item) === index)
        .join('\n');
      const location =
        this.normalizeStopLocation(jobStop?.location) ||
        this.normalizeStopLocation(job?.deliveryLocation) ||
        this.normalizeStopLocation(job?.pickupLocation);
      return {
        ...stop,
        presentation: {
          customerName: job?.customerName || null,
          customerPhone: job?.customerPhone || null,
          customerEmail: job?.customerEmail || null,
          address: jobStop?.address || job?.deliveryAddress || job?.pickupAddress || null,
          location,
          instructions: instructions || null,
          timeWindowStart:
            (jobStop?.timeWindowStart || job?.timeWindowStart)?.toISOString?.() || null,
          timeWindowEnd:
            (jobStop?.timeWindowEnd || job?.timeWindowEnd)?.toISOString?.() || null,
        },
        proofRequirements: this.getStopProofRequirements(stop),
        proofStatus: this.getStopProofStatus(stop, proofsByStop[stop.id] || []),
      };
    });
  }

  private async getRouteMessageSummary(routeId: string, actor?: Actor) {
    if (!this.routeRunMessages) {
      return { unreadCount: 0, lastMessageAt: null };
    }
    const messages = await this.routeRunMessages.find({
      where: actor?.organizationId
        ? { routeId, organizationId: actor.organizationId }
        : { routeId },
      order: { createdAt: 'ASC' },
    });
    return {
      unreadCount: this.getUnreadMessages(messages, actor).length,
      lastMessageAt: messages[messages.length - 1]?.createdAt?.toISOString?.() || null,
    };
  }

  private async assertRequiredProof(stop: RouteRunStop) {
    const requirements = this.getStopProofRequirements(stop);
    const proofs = await this.proofs.find({
      where: { routeRunStopId: stop.id },
    });
    const status = this.getStopProofStatus(stop, proofs);
    const missing: string[] = [];
    if (requirements.signature === 'required' && !status.signatureCaptured) {
      missing.push('Signature');
    }
    if (requirements.bol === 'required' && !status.bolCaptured) {
      missing.push('BOL');
    }
    if (requirements.documents === 'required' && !status.documentsCaptured) {
      missing.push('Documents');
    }
    if (missing.length) {
      throw new BadRequestException(
        `${missing.join(', ')} proof is required before departing this stop`,
      );
    }
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

  private buildDispatchReadiness(
    route: Route,
    stops: RouteRunStop[],
    exceptions: DispatchException[],
  ): DispatchReadiness {
    const blockers: DispatchReadiness['blockers'] = [];
    const routeId = route.id;
    const routeStatus = String(route.status || '').toLowerCase();

    if (['in_progress', 'completed', 'cancelled'].includes(routeStatus)) {
      blockers.push({
        code: 'ROUTE_NOT_EDITABLE',
        message: 'Only planned or ready routes can be sent to a driver.',
        severity: 'blocking',
        routeId,
      });
    }

    if (!route.driverId) {
      blockers.push({
        code: 'MISSING_DRIVER',
        message: 'Assign a driver before dispatch.',
        severity: 'blocking',
        routeId,
      });
    }

    if (!route.vehicleId) {
      blockers.push({
        code: 'MISSING_VEHICLE',
        message: 'Assign a vehicle before dispatch.',
        severity: 'blocking',
        routeId,
      });
    }

    if (stops.length === 0) {
      blockers.push({
        code: 'NO_STOPS',
        message: 'Add at least one stop before dispatch.',
        severity: 'blocking',
        routeId,
      });
    }

    exceptions
      .filter((exception) => String(exception.status || '').toUpperCase() === 'OPEN')
      .forEach((exception) => {
        blockers.push({
          code: 'OPEN_EXCEPTION',
          message: `${exception.code}: ${exception.message}`,
          severity: 'blocking',
          routeId,
          exceptionId: exception.id,
        });
      });

    return {
      ready: blockers.length === 0,
      blockers,
    };
  }

  private async getDispatchReadiness(route: Route, actor?: Actor) {
    const [stops, exceptions] = await Promise.all([
      this.routeRunStops.find({
        where: this.stopListWhere(route.id, route.organizationId || actor?.organizationId),
      }),
      this.exceptions.find({
        where: this.exceptionRouteWhere(route.id, route.organizationId || actor?.organizationId),
      }),
    ]);

    return this.buildDispatchReadiness(route, stops, exceptions);
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

    const organizationId = route.organizationId || actor?.organizationId;
    if (!organizationId) {
      throw new BadRequestException(
        'Notification delivery requires an organization context',
      );
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
          organizationId,
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

  private getLatestTelemetryForVehicle(
    vehicleId?: string | null,
    organizationId?: string | null,
  ) {
    if (!this.telemetry || !vehicleId || !organizationId) {
      return Promise.resolve(null);
    }

    return this.telemetry.findOne({
      where: { vehicleId, vehicle: { organizationId } },
      order: { timestamp: 'DESC' },
      relations: { vehicle: true },
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
    const stopsByRoute = stops.reduce<Record<string, RouteRunStop[]>>((acc, stop) => {
      acc[stop.routeId] = [...(acc[stop.routeId] || []), stop];
      return acc;
    }, {});
    const exceptionsByRoute = exceptions.reduce<Record<string, DispatchException[]>>(
      (acc, exception) => {
        if (!exception.routeId) return acc;
        acc[exception.routeId] = [...(acc[exception.routeId] || []), exception];
        return acc;
      },
      {},
    );
    const dispatchReadiness = Object.fromEntries(
      routes.map((route) => [
        route.id,
        this.buildDispatchReadiness(
          route,
          stopsByRoute[route.id] || [],
          exceptionsByRoute[route.id] || [],
        ),
      ]),
    );
    return {
      ok: true,
      routes,
      routeRunStops: stops,
      exceptions,
      dispatchReadiness,
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
    const organizationId = route.organizationId || actor?.organizationId;
    if (!organizationId) {
      throw new BadRequestException(
        'Route detail requires an organization context',
      );
    }
    const notificationDeliveries: NotificationDelivery[] =
      this.notificationsService
        ? await this.notificationsService.list(organizationId, route.id)
        : [];
    const messages = this.routeRunMessages
      ? await this.routeRunMessages.find({
          where: route.organizationId || actor?.organizationId
            ? {
                routeId: route.id,
                organizationId: route.organizationId || actor?.organizationId,
              }
            : { routeId: route.id },
          order: { createdAt: 'ASC' },
        })
      : [];
    return {
      ok: true,
      routeRun: route,
      stops: await this.enrichStops(stops, route.organizationId || actor?.organizationId || null),
      exceptions,
      stopEvents,
      proofArtifacts,
      notificationDeliveries,
      messages,
      dispatchReadiness: this.buildDispatchReadiness(route, stops, exceptions),
    };
  }

  async dispatchRoute(routeId: string, payload: DispatchRoutePayload = {}, actor?: Actor) {
    const route = await this.getAccessibleRoute(routeId, actor);
    const readiness = await this.getDispatchReadiness(route, actor);
    if (!readiness.ready) {
      throw new BadRequestException({
        message: 'Route is not ready to dispatch',
        blockers: readiness.blockers,
      });
    }
    const note = String(payload.note || '').trim();
    const dispatchedAt = new Date();
    route.status = RouteStatus.ASSIGNED;
    route.workflowStatus = RouteWorkflowStatus.READY_FOR_DISPATCH;
    route.dispatchedAt = dispatchedAt;
    route.dispatchedByUserId = actor?.userId || null;
    route.dispatchNote = note || null;
    await this.routes.save(route);
    if (note) {
      await this.createRouteMessage(route.id, { body: note }, actor);
    }
    this.audit.record({ actorId: actor?.userId || 'system', actorType: 'user', entityType: 'route_run', entityId: routeId, action: 'route-run.dispatched', source: 'user', newValue: { status: route.status, workflowStatus: route.workflowStatus, dispatchedAt, dispatchedByUserId: route.dispatchedByUserId, dispatchNote: route.dispatchNote }, metadata: { organizationId: actor?.organizationId } });
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
    if (payload.driverId !== undefined) {
      route.driverId = payload.driverId || null;
      if (!payload.vehicleId && route.driverId && this.drivers) {
        const driver = await this.drivers.findOne({
          where: route.organizationId || actor?.organizationId
            ? {
                id: route.driverId,
                organizationId: route.organizationId || actor?.organizationId,
              }
            : { id: route.driverId },
        });
        if (driver?.currentVehicleId) {
          route.vehicleId = driver.currentVehicleId;
        }
      }
    }
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
    const currentStop = await this.getStop(stopId, actor);
    await this.assertRequiredProof(currentStop);
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
    const proofType = String(payload.type || '').trim().toUpperCase();
    const metadata = payload.metadata || {};
    if (proofType === 'SIGNATURE') {
      const signerName = typeof metadata.signerName === 'string' ? metadata.signerName.trim() : '';
      if (!signerName) {
        throw new BadRequestException('Signature proof requires signerName metadata');
      }
    }
    const proof = await this.proofs.save(this.proofs.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      type: proofType || payload.type,
      uri: proofType === 'SIGNATURE' ? 'inline-signature' : payload.uri,
      createdByUserId: actor?.userId || null,
      metadata,
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

  async addProofFile(
    stopId: string,
    payload: { type: 'BOL' | 'DOCUMENT'; metadata?: string },
    file: UploadedProofFile | undefined,
    actor?: Actor,
  ) {
    const stop = await this.getStop(stopId, actor);
    const proofType = String(payload.type || '').trim().toUpperCase();
    if (!['BOL', 'DOCUMENT'].includes(proofType)) {
      throw new BadRequestException('Proof file type must be BOL or DOCUMENT');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Proof file is required');
    }
    const resolvedMimeType = resolveProofUploadMimeType(
      file.mimetype,
      file.buffer,
    );
    if (!resolvedMimeType) {
      throw new BadRequestException(
        'Unsupported proof file type. Allowed: JPG, PNG, WEBP, PDF.',
      );
    }
    const userMetadata = this.parseProofMetadata(payload.metadata);
    const capturedAt = new Date().toISOString();
    const stored = await this.getProofStorage().saveProofFile({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      type: proofType as 'BOL' | 'DOCUMENT',
      originalName: file.originalname || 'proof-file',
      mimeType: resolvedMimeType,
      buffer: file.buffer,
    });
    const proof = await this.proofs.save(this.proofs.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      type: proofType,
      uri: stored.uri,
      createdByUserId: actor?.userId || null,
      metadata: {
        ...userMetadata,
        ...stored.metadata,
        capturedAt,
        source:
          typeof userMetadata.source === 'string'
            ? userMetadata.source
            : 'driver-pwa',
      },
    }));
    await this.stopEvents.save(this.stopEvents.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      eventType: 'PROOF_CAPTURED',
      actorUserId: actor?.userId || null,
      payload: {
        proofId: proof.id,
        type: proof.type,
        originalName: stored.metadata.originalName,
        mimeType: stored.metadata.mimeType,
        size: stored.metadata.size,
      },
    }));
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_run_stop',
      entityId: stop.id,
      action: 'route-run-stop.proof-file-captured',
      source: 'user',
      newValue: {
        routeId: stop.routeId,
        proofId: proof.id,
        type: proof.type,
        uri: proof.uri,
        originalName: stored.metadata.originalName,
      },
      metadata: { organizationId: stop.organizationId || actor?.organizationId },
    });
    const route = await this.getRoute(stop.routeId, stop.organizationId || actor?.organizationId || undefined);
    await this.emitWebhookEvent(route, 'proof.captured', {
      stop,
      proof,
    });
    return { ok: true, proof };
  }

  async recordProofDecision(
    stopId: string,
    payload: { type: 'BOL' | 'DOCUMENTS'; required: boolean; reason?: string },
    actor?: Actor,
  ) {
    const stop = await this.getStop(stopId, actor);
    const decisionType = String(payload.type || '').trim().toUpperCase();
    if (!['BOL', 'DOCUMENTS'].includes(decisionType)) {
      throw new BadRequestException('Proof decision type must be BOL or DOCUMENTS');
    }
    if (payload.required !== false) {
      throw new BadRequestException('Only no-proof-needed decisions are supported');
    }

    const proofType = decisionType === 'BOL' ? 'BOL_DECISION' : 'DOCUMENTS_DECISION';
    const metadata = {
      required: false,
      reason: payload.reason || null,
      capturedAt: new Date().toISOString(),
      source: 'driver-pwa',
    };
    const existing = await this.proofs.findOne({
      where: { routeRunStopId: stop.id, type: proofType },
    });
    const proof = await this.proofs.save(this.proofs.create({
      ...(existing || {}),
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      type: proofType,
      uri: 'proof-decision',
      createdByUserId: actor?.userId || existing?.createdByUserId || null,
      metadata,
    }));
    await this.stopEvents.save(this.stopEvents.create({
      organizationId: stop.organizationId || actor?.organizationId || null,
      routeRunStopId: stop.id,
      eventType: 'PROOF_DECISION',
      actorUserId: actor?.userId || null,
      payload: { proofId: proof.id, type: decisionType, required: false },
    }));
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_run_stop',
      entityId: stop.id,
      action: 'route-run-stop.proof-decision',
      source: 'user',
      newValue: { routeId: stop.routeId, proofId: proof.id, type: decisionType, required: false },
      metadata: { organizationId: stop.organizationId || actor?.organizationId },
    });
    return { ok: true, proof };
  }

  async getProofArtifactDownload(proofId: string, actor?: Actor) {
    const proof = await this.proofs.findOne({
      where: actor?.organizationId
        ? { id: proofId, organizationId: actor.organizationId }
        : { id: proofId },
    });
    if (!proof) {
      throw new NotFoundException(`Proof artifact not found: ${proofId}`);
    }
    await this.getStop(proof.routeRunStopId, actor);
    if (proof.uri === 'inline-signature' || proof.uri === 'proof-decision') {
      throw new BadRequestException('This proof artifact does not have a downloadable file');
    }
    return this.getProofStorage().readProofFile(proof.uri, proof.metadata || {});
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

  async listRouteMessages(
    routeId: string,
    actor?: Actor,
  ): Promise<RouteRunMessagesResponse> {
    const route = await this.getAccessibleRoute(routeId, actor);
    const repository = this.getMessagesRepository();
    const messages = await repository.find({
      where: route.organizationId || actor?.organizationId
        ? {
            routeId: route.id,
            organizationId: route.organizationId || actor?.organizationId,
          }
        : { routeId: route.id },
      order: { createdAt: 'ASC' },
    });
    return {
      ok: true,
      messages,
      unreadCount: this.getUnreadMessages(messages, actor).length,
    };
  }

  async createRouteMessage(
    routeId: string,
    payload: { body: string; routeRunStopId?: string },
    actor?: Actor,
  ) {
    const route = await this.getAccessibleRoute(routeId, actor);
    const body = String(payload.body || '').trim();
    if (!body) {
      throw new BadRequestException('Message body is required');
    }
    if (payload.routeRunStopId) {
      const stop = await this.getStop(payload.routeRunStopId, actor);
      if (stop.routeId !== route.id) {
        throw new BadRequestException('Message stop does not belong to this route run');
      }
    }

    const repository = this.getMessagesRepository();
    const senderRole = this.getMessageSenderRole(actor);
    const now = new Date();
    const message = await repository.save(repository.create({
      organizationId: route.organizationId || actor?.organizationId || null,
      routeId: route.id,
      routeRunStopId: payload.routeRunStopId || null,
      senderUserId: actor?.userId || null,
      senderRole,
      body,
      readByDriverAt: senderRole === 'DRIVER' ? now : null,
      readByDispatchAt: senderRole === 'DISPATCH' ? now : null,
    }));

    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_run',
      entityId: route.id,
      action: 'route-run-message.created',
      source: 'user',
      newValue: {
        messageId: message.id,
        routeRunStopId: message.routeRunStopId,
        senderRole: message.senderRole,
      },
      metadata: { organizationId: route.organizationId || actor?.organizationId },
    });

    return {
      ok: true,
      message,
    };
  }

  async markRouteMessagesRead(
    routeId: string,
    actor?: Actor,
  ): Promise<RouteRunMessagesResponse> {
    const route = await this.getAccessibleRoute(routeId, actor);
    const repository = this.getMessagesRepository();
    const messages = await repository.find({
      where: route.organizationId || actor?.organizationId
        ? {
            routeId: route.id,
            organizationId: route.organizationId || actor?.organizationId,
          }
        : { routeId: route.id },
      order: { createdAt: 'ASC' },
    });
    const now = new Date();
    const senderRole = this.getMessageSenderRole(actor);
    const changed = messages.filter((message) => {
      if (senderRole === 'DRIVER') {
        if (message.senderRole === 'DRIVER' || message.readByDriverAt) return false;
        message.readByDriverAt = now;
        return true;
      }
      if (message.senderRole !== 'DRIVER' || message.readByDispatchAt) return false;
      message.readByDispatchAt = now;
      return true;
    });
    if (changed.length) {
      await repository.save(changed);
    }
    return {
      ok: true,
      messages,
      unreadCount: this.getUnreadMessages(messages, actor).length,
    };
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

    const normalized = String(token ?? '').trim();
    if (!normalized || normalized.length > MAX_JWT_BEARER_TOKEN_LENGTH) {
      throw new BadRequestException('Invalid tracking token');
    }

    let payload: {
      kind?: string;
      routeId?: string;
      organizationId?: string | null;
      exp?: number;
    };
    try {
      payload = await this.jwtService.verifyAsync<{
        kind?: string;
        routeId?: string;
        organizationId?: string | null;
        exp?: number;
      }>(normalized);
    } catch {
      throw new BadRequestException('Invalid tracking token');
    }
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
    const vehicle = await this.getRouteVehicle(route);
    const telemetry = await this.getLatestTelemetryForVehicle(
      route.vehicleId,
      route.organizationId,
    );
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

    const toIso = (value?: Date | string | null) =>
      value ? new Date(value).toISOString() : null;

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
      routeRun: {
        id: 'public-route',
        status: route.status,
        workflowStatus: route.workflowStatus || null,
        plannedStart: toIso(route.plannedStart),
        actualStart: toIso(route.actualStart),
        completedAt: toIso(route.completedAt),
        eta: toIso(route.eta),
        jobCount: typeof route.jobCount === 'number' ? route.jobCount : stops.length,
        vehicleId: vehicle ? 'public-vehicle' : null,
      },
      stops: stops.map((stop) => ({
        id: `public-stop-${stop.stopSequence}`,
        stopSequence: stop.stopSequence,
        status: stop.status,
        plannedArrival: toIso(stop.plannedArrival),
        actualArrival: toIso(stop.actualArrival),
        actualDeparture: toIso(stop.actualDeparture),
      })),
      vehicle: vehicle
        ? {
            id: 'public-vehicle',
            make: vehicle.make || 'Vehicle',
            model: vehicle.model || 'Assigned',
            licensePlate: 'Assigned vehicle',
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
        const presentedStops = await this.enrichStops(
          stops,
          route.organizationId || actor?.organizationId || null,
        );
        const completedStops = stops.filter((stop) =>
          ['SERVICED', 'FAILED', 'SKIPPED'].includes(stop.status),
        ).length;
        const nextStop =
          presentedStops.find((stop) => !['SERVICED', 'FAILED', 'SKIPPED'].includes(stop.status)) ||
          null;
        const vehicle = await this.getRouteVehicle(route);
        const telemetry = await this.getLatestTelemetryForVehicle(
          route.vehicleId,
          route.organizationId,
        );

        return {
          routeRun: route,
          stops: presentedStops,
          nextStop,
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
          messageSummary: await this.getRouteMessageSummary(route.id, actor),
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
