import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillRouteVersionsForExistingRoutes1741900100000
  implements MigrationInterface
{
  name = 'BackfillRouteVersionsForExistingRoutes1741900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO route_versions (
        route_id,
        version_number,
        status,
        snapshot,
        created_by_user_id,
        published_by_user_id,
        published_at,
        created_at,
        updated_at
      )
      SELECT
        r.id,
        1,
        'PUBLISHED',
        jsonb_build_object(
          'route',
          jsonb_build_object(
            'routeId', r.id,
            'status', r.status,
            'workflowStatus', r.workflow_status,
            'jobIds', COALESCE(r.job_ids, '[]'::jsonb),
            'totalDistanceKm', r.total_distance_km,
            'totalDurationMinutes', r.total_duration_minutes,
            'eta', CASE WHEN r.eta IS NULL THEN NULL ELSE to_jsonb(r.eta) END,
            'dataQuality', COALESCE(r.route_data->>'data_quality', 'live'),
            'optimizationStatus', COALESCE(r.route_data->>'optimization_status', 'optimized'),
            'droppedJobIds', COALESCE(r.route_data->'dropped_jobs', '[]'::jsonb)
          ),
          'driverId', r.driver_id,
          'vehicleId', r.vehicle_id,
          'polyline', COALESCE(r.polyline, 'null'::jsonb),
          'routeData', COALESCE(r.route_data, '{}'::jsonb),
          'notes', r.notes,
          'plannedStart', CASE WHEN r.planned_start IS NULL THEN NULL ELSE to_jsonb(r.planned_start) END
        ),
        NULL,
        NULL,
        COALESCE(r.updated_at, r.created_at, now()),
        COALESCE(r.created_at, now()),
        COALESCE(r.updated_at, r.created_at, now())
      FROM routes r
      WHERE NOT EXISTS (
        SELECT 1
        FROM route_versions rv
        WHERE rv.route_id = r.id
      );
    `);

    await queryRunner.query(`
      UPDATE routes r
      SET route_data = jsonb_set(
        COALESCE(r.route_data, '{}'::jsonb),
        '{route_version}',
        jsonb_build_object(
          'versionId', rv.id,
          'versionNumber', rv.version_number,
          'status', rv.status,
          'publishedAt', rv.published_at
        ),
        true
      )
      FROM (
        SELECT DISTINCT ON (route_id)
          id,
          route_id,
          version_number,
          status,
          published_at
        FROM route_versions
        ORDER BY route_id, version_number DESC
      ) rv
      WHERE rv.route_id = r.id
        AND (r.route_data IS NULL OR r.route_data->'route_version' IS NULL);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE routes
      SET route_data = route_data - 'route_version'
      WHERE route_data ? 'route_version';
    `);

    await queryRunner.query(`
      DELETE FROM route_versions
      WHERE version_number = 1
        AND status = 'PUBLISHED'
        AND created_by_user_id IS NULL
        AND published_by_user_id IS NULL;
    `);
  }
}
