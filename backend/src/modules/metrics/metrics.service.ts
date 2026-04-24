import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Registry, Gauge, Counter, Histogram, collectDefaultMetrics } from 'prom-client';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Telemetry } from '../tracking/entities/telemetry.entity';
import { Shift } from '../drivers/entities/shift.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Route, RouteStatus } from '../dispatch/entities/route.entity';
import { RouteRunStop } from '../dispatch/entities/route-run-stop.entity';
import { DispatchException } from '../dispatch/entities/dispatch-exception.entity';
import { ProofArtifact } from '../dispatch/entities/proof-artifact.entity';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register: Registry;

  // Gauges for current state metrics
  private readonly avgDistancePerVehicle: Gauge;
  private readonly fuelConsumptionTrend: Gauge;
  private readonly onTimeRate: Gauge;
  private readonly activeVehiclesGauge: Gauge;
  private readonly totalVehiclesGauge: Gauge;

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Telemetry)
    private readonly telemetryRepository: Repository<Telemetry>,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(RouteRunStop)
    private readonly routeRunStopRepository: Repository<RouteRunStop>,
    @InjectRepository(DispatchException)
    private readonly exceptionRepository: Repository<DispatchException>,
    @InjectRepository(ProofArtifact)
    private readonly proofRepository: Repository<ProofArtifact>,
  ) {
    this.register = new Registry();

    // Collect default Node.js metrics (memory, CPU, etc.)
    collectDefaultMetrics({ register: this.register });

    // Define custom metrics
    this.avgDistancePerVehicle = new Gauge({
      name: 'fleet_avg_distance_per_vehicle_km',
      help: 'Average distance traveled per vehicle (km) in the last 24 hours',
      labelNames: ['vehicle_id', 'vehicle_type'],
      registers: [this.register],
    });

    this.fuelConsumptionTrend = new Gauge({
      name: 'fleet_fuel_consumption_liters_per_100km',
      help: 'Fuel consumption trend (L/100km) in the last 24 hours',
      labelNames: ['vehicle_id', 'fuel_type'],
      registers: [this.register],
    });

    this.onTimeRate = new Gauge({
      name: 'fleet_ontime_delivery_rate_percent',
      help: 'On-time delivery rate (percentage) in the last 24 hours',
      registers: [this.register],
    });

    this.activeVehiclesGauge = new Gauge({
      name: 'fleet_active_vehicles_count',
      help: 'Number of currently active vehicles',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.totalVehiclesGauge = new Gauge({
      name: 'fleet_total_vehicles_count',
      help: 'Total number of vehicles in the fleet',
      registers: [this.register],
    });
  }

  async onModuleInit() {
    // Initial metrics update on startup
    await this.updateMetrics();
  }

  /**
   * Update all Prometheus metrics by querying TimescaleDB
   */
  async updateMetrics(): Promise<void> {
    await Promise.all([
      this.updateDistanceMetrics(),
      this.updateFuelConsumptionMetrics(),
      this.updateOnTimeRateMetrics(),
      this.updateVehicleCountMetrics(),
    ]);
  }

  /**
   * Query TimescaleDB for average distance per vehicle (last 24h)
   * Uses the telemetry_daily continuous aggregate
   */
  private async updateDistanceMetrics(): Promise<void> {
    const query = `
      WITH vehicle_distance AS (
        SELECT
          t.vehicle_id,
          v.vehicle_type,
          COALESCE(MAX(t.odometer) - MIN(t.odometer), 0) AS distance_km
        FROM telemetry t
        INNER JOIN vehicles v ON v.id = t.vehicle_id
        WHERE t.timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY t.vehicle_id, v.vehicle_type
      )
      SELECT
        vehicle_id,
        vehicle_type,
        distance_km
      FROM vehicle_distance
      WHERE distance_km > 0
    `;

    try {
      const results = await this.telemetryRepository.query(query);

      // Reset gauge before updating
      this.avgDistancePerVehicle.reset();

      for (const row of results) {
        this.avgDistancePerVehicle.set(
          {
            vehicle_id: row.vehicle_id,
            vehicle_type: row.vehicle_type
          },
          parseFloat(row.distance_km)
        );
      }
    } catch (error) {
      console.error('Error updating distance metrics:', error);
    }
  }

  /**
   * Query TimescaleDB for fuel consumption trend (last 24h)
   * Calculates L/100km based on odometer and fuel level changes
   */
  private async updateFuelConsumptionMetrics(): Promise<void> {
    const query = `
      WITH fuel_data AS (
        SELECT
          t.vehicle_id,
          v.fuel_type,
          MAX(t.odometer) - MIN(t.odometer) AS distance_km,
          (
            SELECT t1."fuelLevel"
            FROM telemetry t1
            WHERE t1.vehicle_id = t.vehicle_id
              AND t1.timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY t1.timestamp ASC
            LIMIT 1
          ) AS initial_fuel,
          (
            SELECT t2."fuelLevel"
            FROM telemetry t2
            WHERE t2.vehicle_id = t.vehicle_id
              AND t2.timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY t2.timestamp DESC
            LIMIT 1
          ) AS final_fuel
        FROM telemetry t
        INNER JOIN vehicles v ON v.id = t.vehicle_id
        WHERE t.timestamp >= NOW() - INTERVAL '24 hours'
          AND t."fuelLevel" IS NOT NULL
        GROUP BY t.vehicle_id, v.fuel_type
      )
      SELECT
        vehicle_id,
        fuel_type,
        CASE
          WHEN distance_km > 0 AND initial_fuel > final_fuel
          THEN ((initial_fuel - final_fuel) / distance_km) * 100
          ELSE 0
        END AS fuel_consumption_per_100km
      FROM fuel_data
      WHERE distance_km > 0
    `;

    try {
      const results = await this.telemetryRepository.query(query);

      // Reset gauge before updating
      this.fuelConsumptionTrend.reset();

      for (const row of results) {
        const consumption = parseFloat(row.fuel_consumption_per_100km);
        if (consumption > 0 && consumption < 100) { // Sanity check
          this.fuelConsumptionTrend.set(
            {
              vehicle_id: row.vehicle_id,
              fuel_type: row.fuel_type || 'unknown'
            },
            consumption
          );
        }
      }
    } catch (error) {
      console.error('Error updating fuel consumption metrics:', error);
    }
  }

  /**
   * Query TimescaleDB for on-time delivery rate (last 24h)
   * Uses shift completion data and scheduled times
   */
  private async updateOnTimeRateMetrics(): Promise<void> {
    const query = `
      WITH shift_performance AS (
        SELECT
          COUNT(*) AS total_shifts,
          COUNT(*) FILTER (
            WHERE status = 'completed'
            AND actual_end <= scheduled_end
          ) AS ontime_shifts
        FROM shifts
        WHERE actual_end >= NOW() - INTERVAL '24 hours'
          AND status = 'completed'
      )
      SELECT
        CASE
          WHEN total_shifts > 0
          THEN (ontime_shifts::NUMERIC / total_shifts::NUMERIC) * 100
          ELSE 0
        END AS ontime_rate_percent
      FROM shift_performance
    `;

    try {
      const results = await this.shiftRepository.query(query);

      if (results && results.length > 0) {
        const onTimePercent = parseFloat(results[0].ontime_rate_percent) || 0;
        this.onTimeRate.set(onTimePercent);
      } else {
        this.onTimeRate.set(0);
      }
    } catch (error) {
      console.error('Error updating on-time rate metrics:', error);
    }
  }

  /**
   * Query vehicle counts by status
   */
  private async updateVehicleCountMetrics(): Promise<void> {
    try {
      const statusCounts = await this.vehicleRepository
        .createQueryBuilder('vehicle')
        .select('vehicle.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('vehicle.status')
        .getRawMany();

      // Reset gauges
      this.activeVehiclesGauge.reset();

      for (const row of statusCounts) {
        this.activeVehiclesGauge.set(
          { status: row.status },
          parseInt(row.count, 10)
        );
      }

      // Total vehicles
      const totalCount = await this.vehicleRepository.count();
      this.totalVehiclesGauge.set(totalCount);
    } catch (error) {
      console.error('Error updating vehicle count metrics:', error);
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    // Update metrics before serving them
    await this.updateMetrics();
    return this.register.metrics();
  }

  /**
   * Get the Prometheus registry
   */
  getRegistry(): Registry {
    return this.register;
  }

  async getAnalyticsOverview(organizationId?: string) {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const reportingCutoff = new Date(now.getTime() - 15 * 60 * 1000);

    const routeWhere = organizationId ? { organizationId } : {};
    const stopWhere = organizationId ? { organizationId } : {};
    const vehicleWhere = organizationId ? { organizationId } : {};
    const driverWhere = organizationId ? { organizationId } : {};
    const exceptionWhere = organizationId ? { organizationId } : {};

    const [
      totalRoutes,
      activeRoutes,
      plannedRoutes,
      completedRoutesLast7Days,
      totalVehicles,
      activeVehicles,
      totalDrivers,
      activeDrivers,
      totalStops,
      servicedStops,
      openExceptions,
      totalExceptions,
      routeStatusBreakdown,
      exceptionStatusBreakdown,
      avgRouteMetrics,
      onTimeCounts,
      proofCounts,
      vehiclesReportingRecently,
    ] = await Promise.all([
      this.routeRepository.count({ where: routeWhere }),
      this.routeRepository.count({
        where: {
          ...routeWhere,
          status: In(['assigned', 'in_progress']),
        },
      }),
      this.routeRepository.count({
        where: {
          ...routeWhere,
          status: RouteStatus.PLANNED,
        },
      }),
      this.routeRepository
        .createQueryBuilder('route')
        .where(organizationId ? 'route.organizationId = :organizationId' : '1=1', {
          organizationId,
        })
        .andWhere('route.completedAt >= :last7Days', { last7Days })
        .getCount(),
      this.vehicleRepository.count({ where: vehicleWhere }),
      this.vehicleRepository.count({
        where: {
          ...vehicleWhere,
          status: In(['available', 'in_use', 'active']),
        },
      }),
      this.driverRepository.count({ where: driverWhere }),
      this.driverRepository.count({
        where: {
          ...driverWhere,
          status: In(['active', 'on_duty', 'on_route']),
        },
      }),
      this.routeRunStopRepository.count({ where: stopWhere }),
      this.routeRunStopRepository.count({
        where: {
          ...stopWhere,
          status: 'SERVICED',
        },
      }),
      this.exceptionRepository.count({
        where: {
          ...exceptionWhere,
          status: 'OPEN',
        },
      }),
      this.exceptionRepository.count({ where: exceptionWhere }),
      this.routeRepository
        .createQueryBuilder('route')
        .select('route.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where(organizationId ? 'route.organizationId = :organizationId' : '1=1', {
          organizationId,
        })
        .groupBy('route.status')
        .orderBy('COUNT(*)', 'DESC')
        .getRawMany<{ status: string; count: string }>(),
      this.exceptionRepository
        .createQueryBuilder('exception')
        .select('exception.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where(
          organizationId ? 'exception.organizationId = :organizationId' : '1=1',
          { organizationId },
        )
        .groupBy('exception.status')
        .orderBy('COUNT(*)', 'DESC')
        .getRawMany<{ status: string; count: string }>(),
      this.routeRepository
        .createQueryBuilder('route')
        .select('AVG(route.totalDistanceKm)', 'avgDistanceKm')
        .addSelect('AVG(route.totalDurationMinutes)', 'avgDurationMinutes')
        .where(organizationId ? 'route.organizationId = :organizationId' : '1=1', {
          organizationId,
        })
        .getRawOne<{ avgDistanceKm: string | null; avgDurationMinutes: string | null }>(),
      this.routeRunStopRepository
        .createQueryBuilder('stop')
        .select(
          'COUNT(*) FILTER (WHERE stop.actualArrival IS NOT NULL)',
          'eligibleCount',
        )
        .addSelect(
          'COUNT(*) FILTER (WHERE stop.actualArrival IS NOT NULL AND stop.plannedArrival IS NOT NULL AND stop.actualArrival <= stop.plannedArrival)',
          'onTimeCount',
        )
        .where(organizationId ? 'stop.organizationId = :organizationId' : '1=1', {
          organizationId,
        })
        .getRawOne<{ eligibleCount: string | null; onTimeCount: string | null }>(),
      this.proofRepository
        .createQueryBuilder('proof')
        .innerJoin(RouteRunStop, 'stop', 'stop.id = proof.routeRunStopId')
        .select('COUNT(DISTINCT proof.routeRunStopId)', 'proofedStops')
        .addSelect(
          'COUNT(DISTINCT stop.id) FILTER (WHERE stop.status = :status)',
          'servicedStops',
        )
        .where(organizationId ? 'stop.organizationId = :organizationId' : '1=1', {
          organizationId,
        })
        .setParameter('status', 'SERVICED')
        .getRawOne<{ proofedStops: string | null; servicedStops: string | null }>(),
      this.telemetryRepository
        .createQueryBuilder('telemetry')
        .innerJoin(Vehicle, 'vehicle', 'vehicle.id = telemetry.vehicleId')
        .select('COUNT(DISTINCT telemetry.vehicleId)', 'count')
        .where('telemetry.timestamp >= :reportingCutoff', { reportingCutoff })
        .andWhere(
          organizationId ? 'vehicle.organizationId = :organizationId' : '1=1',
          { organizationId },
        )
        .getRawOne<{ count: string | null }>(),
    ]);

    const eligibleOnTimeCount = Number(onTimeCounts?.eligibleCount || 0);
    const onTimeCount = Number(onTimeCounts?.onTimeCount || 0);
    const proofedStops = Number(proofCounts?.proofedStops || 0);
    const servicedStopsWithProofScope = Number(proofCounts?.servicedStops || servicedStops || 0);

    const percent = (numerator: number, denominator: number) =>
      denominator > 0
        ? Number(((numerator / denominator) * 100).toFixed(1))
        : 0;

    return {
      generatedAt: now.toISOString(),
      serviceLevel: {
        onTimeRate: percent(onTimeCount, eligibleOnTimeCount),
        proofCaptureRate: percent(proofedStops, servicedStopsWithProofScope),
        exceptionRate: percent(totalExceptions, totalRoutes || 0),
        completedRouteRunsLast7Days: completedRoutesLast7Days,
      },
      operations: {
        totalRouteRuns: totalRoutes,
        activeRouteRuns: activeRoutes,
        plannedRouteRuns: plannedRoutes,
        averageRouteDistanceKm: Number(
          Number(avgRouteMetrics?.avgDistanceKm || 0).toFixed(1),
        ),
        averageRouteDurationMinutes: Number(
          Number(avgRouteMetrics?.avgDurationMinutes || 0).toFixed(1),
        ),
      },
      fleet: {
        totalVehicles,
        activeVehicles,
        vehiclesReportingRecently: Number(vehiclesReportingRecently?.count || 0),
        totalDrivers,
        activeDrivers,
      },
      workload: {
        totalStops,
        servicedStops,
        openExceptions,
      },
      routeStatusBreakdown: routeStatusBreakdown.map((item) => ({
        status: item.status,
        count: Number(item.count || 0),
      })),
      exceptionStatusBreakdown: exceptionStatusBreakdown.map((item) => ({
        status: item.status,
        count: Number(item.count || 0),
      })),
    };
  }
}
