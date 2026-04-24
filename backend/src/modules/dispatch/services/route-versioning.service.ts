import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from '../entities/route.entity';
import { RouteVersion } from '../entities/route-version.entity';
import { DispatchEventsService } from './dispatch-events.service';
import { DispatchPresentationService } from './dispatch-presentation.service';
import type { DispatchActorContext } from '../dispatch.types';

@Injectable()
export class RouteVersioningService {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(RouteVersion)
    private readonly routeVersionRepository: Repository<RouteVersion>,
    private readonly dispatchEvents: DispatchEventsService,
    private readonly routePresentation: DispatchPresentationService,
  ) {}

  private getActorLabel(actor?: DispatchActorContext | null) {
    if (!actor) return null;
    return actor.email || actor.userId || null;
  }

  private getActorUserId(actor?: DispatchActorContext | null) {
    return actor?.userId || null;
  }

  buildRouteVersionMetadata(
    version: Pick<RouteVersion, 'id' | 'versionNumber' | 'status' | 'publishedAt'>,
    extras: Record<string, unknown> = {},
  ) {
    return {
      versionId: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      publishedAt: version.publishedAt?.toISOString() || null,
      ...extras,
    };
  }

  async getNextRouteVersionNumber(routeId: string) {
    const latest = await this.routeVersionRepository.findOne({
      where: { routeId },
      order: { versionNumber: 'DESC' },
    });
    return (latest?.versionNumber || 0) + 1;
  }

  async seedPublishedRouteVersion(
    route: Route,
    actor?: DispatchActorContext,
  ) {
    const existingVersion = await this.routeVersionRepository.findOne({
      where: { routeId: route.id },
      order: { versionNumber: 'DESC' },
    });

    if (existingVersion) {
      return existingVersion;
    }

    const version = this.routeVersionRepository.create({
      routeId: route.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      snapshot: this.routePresentation.buildRouteVersionSnapshot(route),
      createdByUserId: this.getActorUserId(actor),
      publishedByUserId: this.getActorUserId(actor),
      publishedAt: new Date(),
    });
    const saved = await this.routeVersionRepository.save(version);
    route.routeData = {
      ...(route.routeData || {}),
      route_version: this.buildRouteVersionMetadata(saved),
    };
    await this.routeRepository.save(route);
    return saved;
  }

  async ensureRouteVersionBackfill(
    route: Route,
    actor?: DispatchActorContext,
  ): Promise<RouteVersion> {
    const existingVersion = await this.routeVersionRepository.findOne({
      where: { routeId: route.id },
      order: { versionNumber: 'DESC' },
    });

    if (existingVersion) {
      if (!route.routeData?.route_version) {
        route.routeData = {
          ...(route.routeData || {}),
          route_version: this.buildRouteVersionMetadata(existingVersion, {
            lastPublishedVersionId: existingVersion.id,
            lastPublishedVersionNumber: existingVersion.versionNumber,
          }),
        };
        await this.routeRepository.save(route);
      }
      return existingVersion;
    }

    const backfilled = await this.seedPublishedRouteVersion(route, actor);
    await this.dispatchEvents.log({
      routeId: route.id,
      aggregateType: 'ROUTE_VERSION',
      aggregateId: backfilled.id,
      eventType: 'ROUTE_VERSION_BACKFILLED',
      source: 'system',
      code: 'ROUTE_VERSION_BACKFILLED',
      message: 'Published route version backfilled for existing route.',
      actor: this.getActorLabel(actor) || 'system',
      actorUserId: this.getActorUserId(actor),
      payload: {
        routeId: route.id,
        versionId: backfilled.id,
        versionNumber: backfilled.versionNumber,
      },
    });
    return backfilled;
  }

  async ensurePlanningDraftVersion(
    route: Route,
    actor?: DispatchActorContext,
    mutationType?: string,
  ): Promise<RouteVersion> {
    const latestVersion = await this.ensureRouteVersionBackfill(route, actor);

    if (latestVersion.status !== 'PUBLISHED') {
      route.routeData = {
        ...(route.routeData || {}),
        route_version: this.buildRouteVersionMetadata(latestVersion),
      };
      return latestVersion;
    }

    const draftVersion = this.routeVersionRepository.create({
      routeId: route.id,
      versionNumber: await this.getNextRouteVersionNumber(route.id),
      status: 'DRAFT',
      snapshot: this.routePresentation.buildRouteVersionSnapshot(route),
      createdByUserId: this.getActorUserId(actor),
    });
    const savedDraft = await this.routeVersionRepository.save(draftVersion);
    route.routeData = {
      ...(route.routeData || {}),
      route_version: this.buildRouteVersionMetadata(savedDraft, {
        lastPublishedVersionId: latestVersion.id,
        lastPublishedVersionNumber: latestVersion.versionNumber,
        lastPublishedAt: latestVersion.publishedAt?.toISOString() || null,
        forkedFromVersionId: latestVersion.id,
      }),
    };
    await this.dispatchEvents.log({
      routeId: route.id,
      aggregateType: 'ROUTE_VERSION',
      aggregateId: savedDraft.id,
      eventType: 'ROUTE_DRAFT_FORKED_FROM_PUBLISHED',
      source: 'workflow',
      code: 'ROUTE_DRAFT_FORKED_FROM_PUBLISHED',
      message: `Planning draft forked from published route before ${mutationType || 'mutation'}.`,
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        routeId: route.id,
        mutationType: mutationType || 'unknown',
        draftVersionId: savedDraft.id,
        draftVersionNumber: savedDraft.versionNumber,
        publishedVersionId: latestVersion.id,
        publishedVersionNumber: latestVersion.versionNumber,
      },
    });
    return savedDraft;
  }
}
