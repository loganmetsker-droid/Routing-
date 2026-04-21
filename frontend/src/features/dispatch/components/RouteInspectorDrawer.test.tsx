import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RouteInspectorDrawer from './RouteInspectorDrawer';

describe('RouteInspectorDrawer', () => {
  it('shows working version, last published version, and publish history', () => {
    const markup = renderToStaticMarkup(
      <RouteInspectorDrawer
        route={{
          id: 'route-1',
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          jobIds: ['job-1', 'job-2'],
          status: 'assigned',
          workflowStatus: 'ready_for_dispatch',
        }}
        versions={[
          {
            id: 'version-3',
            routeId: 'route-1',
            versionNumber: 3,
            status: 'DRAFT',
            snapshot: {},
            createdAt: '2026-04-10T12:00:00.000Z',
          },
          {
            id: 'version-2',
            routeId: 'route-1',
            versionNumber: 2,
            status: 'PUBLISHED',
            snapshot: {},
            createdAt: '2026-04-10T11:00:00.000Z',
            publishedAt: '2026-04-10T11:30:00.000Z',
            publishedByUserId: 'admin-1',
          },
        ]}
        drivers={[]}
        loadingVersions={false}
        mutationError={null}
        rerouteHistoryCount={0}
        onAssign={async () => {}}
        onSnapshot={async () => {}}
        onReview={async () => {}}
        onApprove={async () => {}}
        onPublish={() => {}}
        onStart={async () => {}}
      />,
    );

    expect(markup).toContain('Working Version: v3 DRAFT');
    expect(markup).toContain('Last Published: v2');
    expect(markup).toContain('Publish History');
    expect(markup).toContain('Publisher admin-1');
  });
});
