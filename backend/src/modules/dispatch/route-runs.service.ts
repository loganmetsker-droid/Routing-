import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { Route, RouteStatus, RouteWorkflowStatus } from './entities/route.entity';
import { RouteAssignment } from './entities/route-assignment.entity';
import { RouteRunStop } from './entities/route-run-stop.entity';
import { StopEvent } from './entities/stop-event.entity';
import { DispatchException } from './entities/dispatch-exception.entity';
import { ProofArtifact } from './entities/proof-artifact.entity';

type Actor = { userId?: string; organizationId?: string; roles?: string[] };

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
  ) {}

  private async getRoute(routeId: string, organizationId?: string) {
    const route = await this.routes.findOne({ where: { id: routeId, ...(organizationId ? { organizationId } : {}) } as any });
    if (!route) throw new NotFoundException(`Route run not found: ${routeId}`);
    return route;
  }

  private async getStop(stopId: string, actor?: Actor) {
    const stop = await this.routeRunStops.findOne({
      where: {
        id: stopId,
        ...(actor?.organizationId ? { organizationId: actor.organizationId } : {}),
      } as any,
    });
    if (!stop) throw new NotFoundException(`Route run stop not found: ${stopId}`);
    return stop;
  }

  async board(organizationId?: string) {
    const routes = await this.routes.find({ where: organizationId ? ({ organizationId } as any) : {}, order: { createdAt: 'DESC' } });
    const routeIds = routes.map((route) => route.id);
    const stops = routeIds.length ? await this.routeRunStops.find({ where: { routeId: In(routeIds) as any } }) : [];
    const exceptions = routeIds.length ? await this.exceptions.find({ where: { routeId: In(routeIds) as any, status: 'OPEN' as any } }) : [];
    return {
      ok: true,
      routes,
      routeRunStops: stops,
      exceptions,
    };
  }

  async list(organizationId?: string) {
    const routes = await this.routes.find({ where: organizationId ? ({ organizationId } as any) : {}, order: { createdAt: 'DESC' } });
    return { ok: true, routeRuns: routes };
  }

  async detail(routeId: string, organizationId?: string) {
    const route = await this.getRoute(routeId, organizationId);
    const stops = await this.routeRunStops.find({
      where: { routeId, ...(organizationId ? { organizationId } : {}) } as any,
      order: { stopSequence: 'ASC' },
    });
    const stopIds = stops.map((stop) => stop.id);
    const exceptions = await this.exceptions.find({
      where: { routeId, ...(organizationId ? { organizationId } : {}) } as any,
      order: { createdAt: 'DESC' },
    });
    const stopEvents = stopIds.length
      ? await this.stopEvents.find({ where: { routeRunStopId: In(stopIds) as any }, order: { happenedAt: 'ASC' } })
      : [];
    const proofArtifacts = stopIds.length
      ? await this.proofs.find({ where: { routeRunStopId: In(stopIds) as any }, order: { createdAt: 'ASC' } })
      : [];
    return { ok: true, routeRun: route, stops, exceptions, stopEvents, proofArtifacts };
  }

  async dispatchRoute(routeId: string, actor?: Actor) {
    const route = await this.getRoute(routeId, actor?.organizationId);
    route.status = RouteStatus.ASSIGNED;
    route.workflowStatus = RouteWorkflowStatus.READY_FOR_DISPATCH;
    await this.routes.save(route);
    this.audit.record({ actorId: actor?.userId || 'system', actorType: 'user', entityType: 'route_run', entityId: routeId, action: 'route-run.dispatched', source: 'user', newValue: { status: route.status }, metadata: { organizationId: actor?.organizationId } });
    return { ok: true, routeRun: route };
  }

  async startRoute(routeId: string, actor?: Actor) {
    const route = await this.getRoute(routeId, actor?.organizationId);
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
    return { ok: true, routeRun: route };
  }

  async completeRoute(routeId: string, actor?: Actor) {
    const route = await this.getRoute(routeId, actor?.organizationId);
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
    return { ok: true, routeRun: route };
  }

  async reassign(routeId: string, payload: { driverId?: string; vehicleId?: string; reason?: string }, actor?: Actor) {
    const route = await this.getRoute(routeId, actor?.organizationId);
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

  async markArrived(stopId: string, actor?: Actor) { return { ok: true, stop: await this.transitionStop(stopId, 'ARRIVED', actor) }; }
  async markServiced(stopId: string, actor?: Actor) { return { ok: true, stop: await this.transitionStop(stopId, 'SERVICED', actor) }; }
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
    return { ok: true, proof };
  }

  async getStopTimeline(stopId: string, actor?: Actor) {
    const stop = await this.getStop(stopId, actor);
    const events = await this.stopEvents.find({ where: { routeRunStopId: stop.id }, order: { happenedAt: 'ASC' } });
    return { ok: true, stop, events };
  }

  async getStopProofs(stopId: string, actor?: Actor) {
    const stop = await this.getStop(stopId, actor);
    const proofs = await this.proofs.find({ where: { routeRunStopId: stop.id }, order: { createdAt: 'ASC' } });
    return { ok: true, stop, proofs };
  }

  async listExceptions(organizationId?: string) {
    return { ok: true, exceptions: await this.exceptions.find({ where: organizationId ? ({ organizationId } as any) : {}, order: { createdAt: 'DESC' } }) };
  }

  async resolveException(exceptionId: string, actor?: Actor, status: 'ACKNOWLEDGED' | 'RESOLVED' = 'RESOLVED') {
    const exception = await this.exceptions.findOne({ where: { id: exceptionId, ...(actor?.organizationId ? { organizationId: actor.organizationId } : {}) } as any });
    if (!exception) throw new NotFoundException(`Exception not found: ${exceptionId}`);
    exception.status = status;
    if (status === 'ACKNOWLEDGED') exception.acknowledgedByUserId = actor?.userId || null;
    if (status === 'RESOLVED') {
      exception.resolvedByUserId = actor?.userId || null;
      exception.resolvedAt = new Date();
    }
    await this.exceptions.save(exception);
    return { ok: true, exception };
  }
}
