import { AppDataSource } from './src/data-source';
import { AuditLog } from './src/common/audit/audit-log.entity';
import { Route, RouteStatus, RouteWorkflowStatus } from './src/modules/dispatch/entities/route.entity';
import { DispatchException } from './src/modules/dispatch/entities/dispatch-exception.entity';
import { ProofArtifact } from './src/modules/dispatch/entities/proof-artifact.entity';
import { RouteAssignment } from './src/modules/dispatch/entities/route-assignment.entity';
import { RouteRunStop } from './src/modules/dispatch/entities/route-run-stop.entity';
import { StopEvent } from './src/modules/dispatch/entities/stop-event.entity';
import { Driver } from './src/modules/drivers/entities/driver.entity';
import { Job, JobPriority } from './src/modules/jobs/entities/job.entity';
import { JobStop } from './src/modules/jobs/entities/job-stop.entity';
import { AppUser } from './src/modules/organizations/entities/app-user.entity';
import { OrganizationMembership } from './src/modules/organizations/entities/organization-membership.entity';
import { Organization } from './src/modules/organizations/entities/organization.entity';
import { Depot } from './src/modules/depots/entities/depot.entity';
import { RoutePlanGroup } from './src/modules/planning/entities/route-plan-group.entity';
import { RoutePlanStop } from './src/modules/planning/entities/route-plan-stop.entity';
import { RoutePlan } from './src/modules/planning/entities/route-plan.entity';
import { Vehicle } from './src/modules/vehicles/entities/vehicle.entity';

async function seed() {
  await AppDataSource.initialize();
  const manager = AppDataSource.manager;

  const orgRepo = manager.getRepository(Organization);
  const userRepo = manager.getRepository(AppUser);
  const membershipRepo = manager.getRepository(OrganizationMembership);
  const depotRepo = manager.getRepository(Depot);
  const driverRepo = manager.getRepository(Driver);
  const vehicleRepo = manager.getRepository(Vehicle);
  const jobRepo = manager.getRepository(Job);
  const jobStopRepo = manager.getRepository(JobStop);
  const routePlanRepo = manager.getRepository(RoutePlan);
  const routePlanGroupRepo = manager.getRepository(RoutePlanGroup);
  const routePlanStopRepo = manager.getRepository(RoutePlanStop);
  const routeRepo = manager.getRepository(Route);
  const routeRunStopRepo = manager.getRepository(RouteRunStop);
  const assignmentRepo = manager.getRepository(RouteAssignment);
  const exceptionRepo = manager.getRepository(DispatchException);
  const proofRepo = manager.getRepository(ProofArtifact);
  const eventRepo = manager.getRepository(StopEvent);
  const auditRepo = manager.getRepository(AuditLog);

  await manager.query('DELETE FROM audit_logs');
  await manager.query('DELETE FROM proof_artifacts');
  await manager.query('DELETE FROM exceptions');
  await manager.query('DELETE FROM stop_events');
  await manager.query('DELETE FROM route_assignments');
  await manager.query('DELETE FROM route_run_stops');
  await manager.query('DELETE FROM route_plan_stops');
  await manager.query('DELETE FROM route_plan_groups');
  await manager.query('DELETE FROM route_plans');
  await manager.query('DELETE FROM job_stops');
  await manager.query('DELETE FROM routes');
  await manager.query('DELETE FROM jobs');
  await manager.query('DELETE FROM vehicles');
  await manager.query('DELETE FROM drivers');
  await manager.query('DELETE FROM depots');
  await manager.query('DELETE FROM organization_memberships');
  await manager.query('DELETE FROM app_users');
  await manager.query('DELETE FROM organizations');

  const organization = await orgRepo.save(orgRepo.create({
    name: 'Default Organization',
    slug: 'default',
    serviceTimezone: 'America/Chicago',
    settings: { serviceDate: new Date().toISOString().slice(0, 10), seeded: true },
  }));

  const user = await userRepo.save(userRepo.create({
    email: 'admin@routing.local',
    displayName: 'Local Admin',
    authProvider: 'local-config',
    isActive: true,
  }));

  await membershipRepo.save(membershipRepo.create({
    organizationId: organization.id,
    userId: user.id,
    role: 'OWNER',
    roles: ['OWNER', 'ADMIN', 'DISPATCHER'],
    isDefault: true,
  }));

  const depot = await depotRepo.save(depotRepo.create({
    organizationId: organization.id,
    name: 'Kansas City Depot',
    address: '100 Dispatch Way, Kansas City, MO 64106',
    location: { lat: 39.0997, lng: -94.5786 },
    isPrimary: true,
  }));

  const drivers = await driverRepo.save([
    driverRepo.create({ organizationId: organization.id, firstName: 'Alice', lastName: 'Johnson', email: 'alice@trovan.test', phone: '555-0101', licenseNumber: 'DL-ALICE-001', licenseExpiryDate: new Date('2027-12-31'), roles: ['DRIVER'] }),
    driverRepo.create({ organizationId: organization.id, firstName: 'Bob', lastName: 'Smith', email: 'bob@trovan.test', phone: '555-0102', licenseNumber: 'DL-BOB-002', licenseExpiryDate: new Date('2027-12-31'), roles: ['DRIVER'] }),
  ]);

  const vehicles = await vehicleRepo.save([
    vehicleRepo.create({ organizationId: organization.id, make: 'Ford', model: 'Transit', year: 2023, licensePlate: 'TRO-101', vehicleType: 'van', fuelType: 'diesel', status: 'available', capacityWeightKg: 1200, capacityVolumeM3: 14 }),
    vehicleRepo.create({ organizationId: organization.id, make: 'Mercedes', model: 'Sprinter', year: 2024, licensePlate: 'TRO-102', vehicleType: 'van', fuelType: 'diesel', status: 'available', capacityWeightKg: 1500, capacityVolumeM3: 16 }),
  ]);

  const serviceDate = new Date().toISOString().slice(0, 10);
  const jobs = await jobRepo.save([
    jobRepo.create({ organizationId: organization.id, customerName: 'Jane Bakery', customerPhone: '555-0201', deliveryAddress: '1425 Market Ave, Kansas City, MO', pickupAddress: '100 Dispatch Way, Kansas City, MO', timeWindowStart: new Date(`${serviceDate}T09:00:00Z`), timeWindowEnd: new Date(`${serviceDate}T11:00:00Z`), weight: 120, volume: 2, priority: JobPriority.HIGH, status: 'pending' as any, estimatedDuration: 20 } as any),
    jobRepo.create({ organizationId: organization.id, customerName: 'Omega Medical', customerPhone: '555-0202', deliveryAddress: '2100 Santa Fe Dr, Kansas City, MO', pickupAddress: '100 Dispatch Way, Kansas City, MO', timeWindowStart: new Date(`${serviceDate}T10:00:00Z`), timeWindowEnd: new Date(`${serviceDate}T12:00:00Z`), weight: 80, volume: 1, priority: JobPriority.URGENT, status: 'pending' as any, estimatedDuration: 15 } as any),
    jobRepo.create({ organizationId: organization.id, customerName: 'Riverfront Catering', customerPhone: '555-0203', deliveryAddress: '870 W Evans Ave, Kansas City, MO', pickupAddress: '100 Dispatch Way, Kansas City, MO', timeWindowStart: new Date(`${serviceDate}T11:00:00Z`), timeWindowEnd: new Date(`${serviceDate}T14:00:00Z`), weight: 50, volume: 1, priority: JobPriority.NORMAL, status: 'pending' as any, estimatedDuration: 12 } as any),
  ] as any);

  const jobStops: JobStop[] = [];
  for (const job of jobs) {
    jobStops.push(jobStopRepo.create({ organizationId: organization.id, jobId: job.id, stopOrder: 1, stopType: 'PICKUP', address: job.pickupAddress || depot.address, location: depot.location, serviceDurationMinutes: 10, timeWindowStart: job.timeWindowStart, timeWindowEnd: job.timeWindowEnd, demandWeightKg: job.weight || null, demandVolumeM3: job.volume || null }));
    jobStops.push(jobStopRepo.create({ organizationId: organization.id, jobId: job.id, stopOrder: 2, stopType: 'DROPOFF', address: job.deliveryAddress, location: { lat: 39.1 + Math.random() * 0.1, lng: -94.5 - Math.random() * 0.1 }, serviceDurationMinutes: 12, timeWindowStart: job.timeWindowStart, timeWindowEnd: job.timeWindowEnd, demandWeightKg: job.weight || null, demandVolumeM3: job.volume || null }));
  }
  const savedJobStops = await jobStopRepo.save(jobStops);

  const routePlan = await routePlanRepo.save(routePlanRepo.create({
    organizationId: organization.id,
    serviceDate,
    depotId: depot.id,
    status: 'DRAFT',
    objective: 'distance',
    metrics: { routeCount: 1 },
    warnings: [],
    createdByUserId: user.id,
  }));

  const routePlanGroup = await routePlanGroupRepo.save(routePlanGroupRepo.create({
    routePlanId: routePlan.id,
    groupIndex: 1,
    label: 'Draft Route 1',
    driverId: drivers[0].id,
    vehicleId: vehicles[0].id,
    totalDistanceKm: 28,
    totalDurationMinutes: 165,
    serviceTimeMinutes: 66,
    totalWeightKg: 250,
    totalVolumeM3: 4,
    warnings: [],
  }));

  const publishedRoute = await routeRepo.save(routeRepo.create({
    organizationId: organization.id,
    vehicleId: vehicles[0].id,
    driverId: drivers[0].id,
    jobIds: jobs.map((job) => job.id),
    jobCount: jobs.length,
    status: RouteStatus.ASSIGNED,
    workflowStatus: RouteWorkflowStatus.READY_FOR_DISPATCH,
    totalDistanceKm: 28,
    totalDurationMinutes: 165,
    plannedStart: new Date(`${serviceDate}T08:00:00Z`),
    routeData: { seed: true, routePlanId: routePlan.id },
    notes: 'Seeded published route run',
  }));

  const planStops = await routePlanStopRepo.save(savedJobStops.map((stop, index) => routePlanStopRepo.create({
    routePlanId: routePlan.id,
    routePlanGroupId: routePlanGroup.id,
    jobId: stop.jobId,
    jobStopId: stop.id,
    stopSequence: index + 1,
    isLocked: index === 0,
    plannedArrival: stop.timeWindowStart,
    plannedDeparture: stop.timeWindowEnd,
    metadata: { stopType: stop.stopType, address: stop.address },
  })));

  const runStops = await routeRunStopRepo.save(planStops.map((stop) => routeRunStopRepo.create({
    organizationId: organization.id,
    routeId: publishedRoute.id,
    jobId: stop.jobId,
    jobStopId: stop.jobStopId,
    stopSequence: stop.stopSequence,
    status: stop.stopSequence === 1 ? 'SERVICED' : 'DISPATCHED',
    plannedArrival: stop.plannedArrival || null,
    actualArrival: stop.stopSequence === 1 ? new Date(`${serviceDate}T09:10:00Z`) : null,
    actualDeparture: stop.stopSequence === 1 ? new Date(`${serviceDate}T09:20:00Z`) : null,
    proofRequired: stop.stopSequence === 1,
    notes: null,
  })));

  await assignmentRepo.save(assignmentRepo.create({ organizationId: organization.id, routeId: publishedRoute.id, routePlanGroupId: routePlanGroup.id, driverId: drivers[0].id, vehicleId: vehicles[0].id, assignedByUserId: user.id, reason: 'Seeded dispatch assignment' }));
  await exceptionRepo.save(exceptionRepo.create({ organizationId: organization.id, routeId: publishedRoute.id, routeRunStopId: runStops[1].id, code: 'STOP_FAILED', message: 'Customer unavailable', status: 'OPEN', details: { reason: 'customer_unavailable' } }));
  await proofRepo.save(proofRepo.create({ organizationId: organization.id, routeRunStopId: runStops[0].id, type: 'signature', uri: 'seed://proof/signature-1', createdByUserId: user.id, metadata: { signer: 'Jane Bakery' } }));
  await eventRepo.save(eventRepo.create({ organizationId: organization.id, routeRunStopId: runStops[0].id, eventType: 'SERVICED', actorUserId: user.id, payload: { note: 'Seeded service complete' } }));
  await auditRepo.save(auditRepo.create({ organizationId: organization.id, actorId: user.id, actorType: 'user', entityType: 'route_plan', entityId: routePlan.id, action: 'seed.route-plan.created', source: 'system', newValue: { routePlanId: routePlan.id } }));

  console.log('Seeded organization, users, depot, drivers, vehicles, jobs, job stops, route plan, route run, exception, and proof artifacts ✅');
  await AppDataSource.destroy();
}

seed().catch(async (error) => {
  console.error('Seeding failed ❌', error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
