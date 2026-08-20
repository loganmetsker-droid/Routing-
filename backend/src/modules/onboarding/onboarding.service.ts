import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  getMajorContentVersion,
  getTrainingModulesForRoles,
  trovanTrainingCatalog,
  type OnboardingReadiness,
  type TrainingModule,
  type TrainingProgress,
} from '@shared/contracts';
import { In, Repository } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
import { Depot } from '../depots/entities/depot.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Job } from '../jobs/entities/job.entity';
import { AppUser } from '../organizations/entities/app-user.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { ProofArtifact } from '../dispatch/entities/proof-artifact.entity';
import { Route, RouteWorkflowStatus } from '../dispatch/entities/route.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { SetOnboardingChampionDto } from './dto/set-onboarding-champion.dto';
import { UpdateOnboardingProgressDto } from './dto/update-onboarding-progress.dto';
import { OnboardingProgressEntity } from './entities/onboarding-progress.entity';
import { OnboardingEmailService } from './onboarding-email.service';
import {
  buildOperationalOnboardingSteps,
  buildTrainingOnboardingSteps,
} from './onboarding-readiness';

export type OnboardingActor = {
  userId: string;
  organizationId?: string;
  email?: string;
  role?: string;
  roles?: string[];
};

const actorRoles = (actor: OnboardingActor) =>
  Array.isArray(actor.roles) && actor.roles.length ? actor.roles : actor.role ? [actor.role] : [];

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(OnboardingProgressEntity) private readonly progress: Repository<OnboardingProgressEntity>,
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    @InjectRepository(OrganizationMembership) private readonly memberships: Repository<OrganizationMembership>,
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
    @InjectRepository(Depot) private readonly depots: Repository<Depot>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Route) private readonly routes: Repository<Route>,
    @InjectRepository(ProofArtifact) private readonly proofs: Repository<ProofArtifact>,
    private readonly audit: AuditService,
    private readonly email: OnboardingEmailService,
  ) {}

  getCatalog(actor: OnboardingActor) {
    return getTrainingModulesForRoles(actorRoles(actor));
  }

  private requireOrganization(actor: OnboardingActor) {
    if (!actor.organizationId) throw new BadRequestException('No active organization selected');
    return actor.organizationId;
  }

  private presentProgress(record: OnboardingProgressEntity): TrainingProgress {
    return {
      moduleKey: record.moduleKey,
      contentVersion: record.contentVersion,
      status: record.status,
      score: record.score ?? null,
      signoffAcknowledged: record.signoffAcknowledged,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async getMyProgress(actor: OnboardingActor) {
    const organizationId = this.requireOrganization(actor);
    const records = await this.progress.find({
      where: { organizationId, userId: actor.userId },
      order: { updatedAt: 'DESC' },
    });
    return records.map((record) => this.presentProgress(record));
  }

  private completionMatches(module: TrainingModule, record?: OnboardingProgressEntity) {
    if (!record || record.status !== 'COMPLETED' || (record.score ?? 0) < module.knowledgeCheck.passingScore) return false;
    if (!module.recertifyOnMajorVersion) return true;
    return getMajorContentVersion(record.contentVersion) === getMajorContentVersion(module.contentVersion);
  }

  async updateProgress(moduleKey: string, dto: UpdateOnboardingProgressDto, actor: OnboardingActor) {
    const organizationId = this.requireOrganization(actor);
    const module = this.getCatalog(actor).find((item) => item.key === moduleKey);
    if (!module) throw new NotFoundException('Training module is not available for this role');
    const existing = await this.progress.findOne({
      where: { organizationId, userId: actor.userId, moduleKey, contentVersion: module.contentVersion },
    });
    const firstProgress = (await this.progress.count({ where: { organizationId, userId: actor.userId } })) === 0;
    const passed =
      dto.status === 'COMPLETED' &&
      (dto.score ?? 0) >= module.knowledgeCheck.passingScore &&
      (moduleKey !== 'go-live' || dto.signoffAcknowledged === true);
    const now = new Date();
    const record = existing ?? this.progress.create({
      organizationId,
      userId: actor.userId,
      moduleKey,
      contentVersion: module.contentVersion,
      startedAt: now,
    });
    record.status = passed ? 'COMPLETED' : 'IN_PROGRESS';
    record.score = dto.score ?? record.score ?? null;
    record.signoffAcknowledged = moduleKey === 'go-live' && passed && dto.signoffAcknowledged === true;
    record.completedAt = passed ? record.completedAt ?? now : null;
    const saved = await this.progress.save(record);

    this.audit.record({
      actorId: actor.userId,
      actorType: 'user',
      entityType: 'onboarding_module',
      entityId: moduleKey,
      action: passed ? 'pilot.activation.training-completed' : 'pilot.activation.training-started',
      source: 'user',
      newValue: { status: saved.status, score: saved.score, contentVersion: saved.contentVersion },
      metadata: { organizationId },
    });

    const recipient = actor.email || (await this.users.findOne({ where: { id: actor.userId } }))?.email;
    if (recipient && firstProgress && !saved.welcomeEmailSentAt) {
      const result = await this.email.send({
        to: recipient,
        subject: 'Welcome to Trovan Academy',
        message: 'Your self-guided Trovan launch path is ready. Start with the role-based lesson and complete each workspace task as you go.',
        actionLabel: 'Open Trovan Academy',
        actionUrl: `/academy/${module.key}`,
      });
      if (result.status === 'SENT') saved.welcomeEmailSentAt = new Date();
    }
    if (recipient && passed && !saved.nextStepEmailSentAt) {
      const catalog = this.getCatalog(actor);
      const currentIndex = catalog.findIndex((item) => item.key === moduleKey);
      const next = catalog.slice(currentIndex + 1).find((item) => item.required);
      const result = await this.email.send({
        to: recipient,
        subject: `${module.title} complete - your next Trovan step`,
        message: next
          ? `You completed ${module.title}. Continue with ${next.title} and its workspace task.`
          : `You completed ${module.title}. Open readiness to review the remaining team and workspace evidence.`,
        actionLabel: next ? 'Open next lesson' : 'Review readiness',
        actionUrl: next ? `/academy/${next.key}` : '/academy',
      });
      if (result.status === 'SENT') saved.nextStepEmailSentAt = new Date();
    }
    if (saved.welcomeEmailSentAt || saved.nextStepEmailSentAt) await this.progress.save(saved);
    return this.presentProgress(saved);
  }

  private onboardingSettings(organization: Organization) {
    const settings = organization.settings && typeof organization.settings === 'object' ? organization.settings : {};
    const onboarding = settings.onboarding;
    return onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding)
      ? (onboarding as Record<string, unknown>)
      : {};
  }

  async setChampion(dto: SetOnboardingChampionDto, actor: OnboardingActor) {
    const organizationId = this.requireOrganization(actor);
    const [organization, membership] = await Promise.all([
      this.organizations.findOne({ where: { id: organizationId } }),
      this.memberships.findOne({ where: { organizationId, userId: dto.userId } }),
    ]);
    if (!organization) throw new NotFoundException('Organization not found');
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new BadRequestException('The customer Champion must be an Owner or Admin in this organization');
    }
    const current = this.onboardingSettings(organization);
    organization.settings = {
      ...(organization.settings || {}),
      onboarding: { ...current, championUserId: dto.userId, championAssignedAt: new Date().toISOString() },
    };
    await this.organizations.save(organization);
    this.audit.record({
      actorId: actor.userId,
      actorType: 'user',
      entityType: 'organization_onboarding',
      entityId: organizationId,
      action: 'pilot.activation.champion-assigned',
      source: 'user',
      newValue: { championUserId: dto.userId },
      metadata: { organizationId },
    });
    return { championUserId: dto.userId };
  }

  private async getOperationalCounts(organizationId: string) {
    const [depotCount, activeDriverCount, readyVehicleCount, jobCount, locatedJobCount, providerBackedRouteCount, dispatchedRouteCount, proofCount] = await Promise.all([
      this.depots.count({ where: { organizationId } }),
      this.drivers.createQueryBuilder('driver').where('driver.organization_id = :organizationId', { organizationId }).andWhere('LOWER(driver.employment_status) = :status', { status: 'active' }).getCount(),
      this.vehicles.createQueryBuilder('vehicle').where('vehicle.organization_id = :organizationId', { organizationId }).andWhere('LOWER(vehicle.status) IN (:...statuses)', { statuses: ['available', 'in_route'] }).getCount(),
      this.jobs.count({ where: { organizationId } }),
      this.jobs.createQueryBuilder('job').where('job.organization_id = :organizationId', { organizationId }).andWhere('(job.delivery_location IS NOT NULL OR job.pickup_location IS NOT NULL)').getCount(),
      this.routes.createQueryBuilder('route').where('route.organization_id = :organizationId', { organizationId }).andWhere("((route.route_data ->> 'optimization_status' = 'optimized' AND COALESCE(route.route_data ->> 'data_quality', 'live') = 'live') OR route.workflow_status IN (:...publishedStatuses))", { publishedStatuses: [RouteWorkflowStatus.READY_FOR_DISPATCH, RouteWorkflowStatus.IN_PROGRESS, RouteWorkflowStatus.COMPLETED] }).getCount(),
      this.routes.createQueryBuilder('route').where('route.organization_id = :organizationId', { organizationId }).andWhere('(route.dispatched_at IS NOT NULL OR route.workflow_status IN (:...statuses))', { statuses: [RouteWorkflowStatus.IN_PROGRESS, RouteWorkflowStatus.COMPLETED] }).getCount(),
      this.proofs.count({ where: { organizationId } }),
    ]);
    return { depotCount, activeDriverCount, readyVehicleCount, jobCount, locatedJobCount, providerBackedRouteCount, dispatchedRouteCount, proofCount };
  }

  async getReadiness(actor: OnboardingActor): Promise<OnboardingReadiness> {
    const organizationId = this.requireOrganization(actor);
    const organization = await this.organizations.findOne({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organization not found');
    const championUserId = typeof this.onboardingSettings(organization).championUserId === 'string'
      ? String(this.onboardingSettings(organization).championUserId)
      : null;
    const [counts, allProgress, driverMemberships] = await Promise.all([
      this.getOperationalCounts(organizationId),
      this.progress.find({ where: { organizationId } }),
      this.memberships.find({ where: { organizationId, role: 'DRIVER' } }),
    ]);
    const modules = [...trovanTrainingCatalog];
    const championProgress = allProgress.filter((item) => item.userId === championUserId);
    const completedModuleKeys = new Set(
      modules.filter((module) => championProgress.some((record) => record.moduleKey === module.key && this.completionMatches(module, record))).map((module) => module.key),
    );
    const driverModule = modules.find((module) => module.key === 'driver-quick-start')!;
    const driverIds = new Set(driverMemberships.map((item) => item.userId));
    const driverTrainingComplete = allProgress.some((record) => driverIds.has(record.userId) && record.moduleKey === driverModule.key && this.completionMatches(driverModule, record));
    const signoffComplete = championProgress.some((record) => record.moduleKey === 'go-live' && record.signoffAcknowledged && this.completionMatches(modules.find((item) => item.key === 'go-live')!, record));
    const operationalSteps = buildOperationalOnboardingSteps(counts);
    const championModules = modules.filter((module) => module.audiences.includes('CHAMPION'));
    const trainingSteps = buildTrainingOnboardingSteps(championModules, completedModuleKeys, driverTrainingComplete, Boolean(championUserId));
    const allSteps = [...trainingSteps, ...operationalSteps];
    const nextAction = allSteps.find((step) => !step.complete && !step.blocked) || allSteps.find((step) => !step.complete) || null;
    return {
      championUserId,
      operationalSteps,
      trainingSteps,
      operationalComplete: operationalSteps.filter((step) => step.complete).length,
      trainingComplete: trainingSteps.filter((step) => step.complete).length,
      totalSteps: allSteps.length,
      completedSteps: allSteps.filter((step) => step.complete).length,
      driverTrainingComplete,
      signoffComplete,
      readyForReview: allSteps.every((step) => step.complete) && signoffComplete,
      nextAction,
      generatedAt: new Date().toISOString(),
    };
  }

  async getTeamProgress(actor: OnboardingActor) {
    const organizationId = this.requireOrganization(actor);
    const [memberships, records] = await Promise.all([
      this.memberships.find({ where: { organizationId } }),
      this.progress.find({ where: { organizationId } }),
    ]);
    const users = await this.users.find({ where: { id: In(memberships.map((item) => item.userId)) } });
    const usersById = new Map(users.map((user) => [user.id, user]));
    return memberships.map((membership) => ({
      userId: membership.userId,
      displayName: usersById.get(membership.userId)?.displayName || 'Team member',
      email: usersById.get(membership.userId)?.email || '',
      role: membership.role,
      completedModuleKeys: records.filter((record) => record.userId === membership.userId && record.status === 'COMPLETED').map((record) => record.moduleKey),
    }));
  }
}
