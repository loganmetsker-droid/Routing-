import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addRouteRunStopProof,
  createRouteRunMessage,
  dispatchRouteRun,
  getRouteRunDetail,
  getRouteRunStopTimeline,
  listRouteRunMessages,
  markRouteRunMessagesRead,
  markRouteRunStopServiced,
  reassignRouteRun,
} from './routeRunsApi';
import { previewState } from '../../../services/api.preview';

describe('routeRunsApi driver execution contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes enriched stops, signature proofs, and route messages from detail payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            routeRun: {
              id: 'route-1',
              status: 'in_progress',
              vehicleId: 'vehicle-1',
            },
            stops: [
              {
                id: 'stop-1',
                routeId: 'route-1',
                jobId: 'job-1',
                jobStopId: 'job-stop-1',
                stopSequence: 1,
                status: 'ARRIVED',
                proofRequired: true,
                presentation: {
                  customerName: 'Jordan Receiver',
                  address: '123 Dock St',
                  location: { latitude: 39.75, longitude: -104.99 },
                  instructions: 'Use dock B.',
                  access: {
                    code: '4827',
                    codeRequired: true,
                    gateInstructions: 'Use the black keypad.',
                  },
                },
                proofStatus: {
                  proofRequired: true,
                  proofCaptured: true,
                  signatureCaptured: true,
                  proofCount: 1,
                  signatureProofId: 'proof-1',
                },
              },
            ],
            exceptions: [],
            stopEvents: [],
            proofArtifacts: [
              {
                id: 'proof-1',
                routeRunStopId: 'stop-1',
                type: 'SIGNATURE',
                uri: 'inline-signature',
                metadata: {
                  signerName: 'Jordan Receiver',
                  strokes: [[{ x: 0.1, y: 0.2 }]],
                },
              },
            ],
            notificationDeliveries: [],
            messages: [
              {
                id: 'message-1',
                routeId: 'route-1',
                senderRole: 'DISPATCH',
                body: 'Check in at the dock.',
                createdAt: '2026-05-06T18:15:00.000Z',
              },
            ],
            vehicleOperatingRules: [{
              id: 'rule-1',
              label: 'Glass securement',
              instruction: 'Use E-track straps.',
              severity: 'hard',
              active: true,
            }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const detail = await getRouteRunDetail('route-1');

    expect(detail.stops[0].presentation?.customerName).toBe('Jordan Receiver');
    expect(detail.stops[0].presentation?.location?.latitude).toBe(39.75);
    expect(detail.stops[0].presentation?.access).toMatchObject({
      code: '4827',
      codeRequired: true,
    });
    expect(detail.stops[0].proofStatus?.signatureCaptured).toBe(true);
    expect(detail.proofArtifacts[0].metadata?.signerName).toBe('Jordan Receiver');
    expect(detail.messages?.[0].body).toBe('Check in at the dock.');
    expect(detail.vehicleOperatingRules?.[0].label).toBe('Glass securement');
  });

  it('calls the route message endpoints and read receipt endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              messages: [
                {
                  id: 'message-1',
                  routeId: 'route-1',
                  senderRole: 'DRIVER',
                  body: 'Departing now.',
                },
              ],
              unreadCount: 1,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              message: {
                id: 'message-2',
                routeId: 'route-1',
                senderRole: 'DISPATCH',
                body: 'Copy.',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { messages: [], unreadCount: 0 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const listed = await listRouteRunMessages('route-1');
    const created = await createRouteRunMessage('route-1', { body: 'Copy.' });
    const read = await markRouteRunMessagesRead('route-1');

    expect(listed.unreadCount).toBe(1);
    expect(created.body).toBe('Copy.');
    expect(read.unreadCount).toBe(0);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/route-runs/route-1/messages'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: 'Copy.' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/api/route-runs/route-1/messages/read'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends inline signature proof payloads without an object-storage dependency', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await addRouteRunStopProof('stop-1', {
      type: 'SIGNATURE',
      uri: 'inline-signature',
      metadata: {
        source: 'driver-pwa',
        signerName: 'Jordan Receiver',
        strokes: [[{ x: 0.1, y: 0.2 }]],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/route-run-stops/stop-1/proof'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          type: 'SIGNATURE',
          uri: 'inline-signature',
          metadata: {
            source: 'driver-pwa',
            signerName: 'Jordan Receiver',
            strokes: [[{ x: 0.1, y: 0.2 }]],
          },
        }),
      }),
    );
  });

  it('dispatches and reassigns preview route runs locally without starting the route', async () => {
    vi.stubGlobal('window', {
      location: { hostname: '127.0.0.1', search: '' },
      __TROVAN_LOCAL_DEMO_PREVIEW__: true,
    } as unknown as Window & typeof globalThis);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const route = previewState.routes.find((item) => item.id === 'route-beta-002');
    if (!route) {
      throw new Error('Expected preview route route-beta-002 to exist.');
    }
    const original = {
      status: route.status,
      workflowStatus: route.workflowStatus,
      driverId: route.driverId,
      dispatchedAt: route.dispatchedAt,
      dispatchedByUserId: route.dispatchedByUserId,
      dispatchNote: route.dispatchNote,
    };

    try {
      await reassignRouteRun('route-beta-002', {
        driverId: 'driver-1',
        reason: 'unit test',
      });
      await dispatchRouteRun('route-beta-002', {
        note: 'Preview dispatch note.',
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(route.driverId).toBe('driver-1');
      expect(route.status).toBe('assigned');
      expect(route.workflowStatus).toBe('ready_for_dispatch');
      expect(route.dispatchedAt).toEqual(expect.any(String));
      expect(route.dispatchedByUserId).toBe('preview-user');
      expect(route.dispatchNote).toBe('Preview dispatch note.');
    } finally {
      route.status = original.status;
      route.workflowStatus = original.workflowStatus;
      route.driverId = original.driverId;
      route.dispatchedAt = original.dispatchedAt;
      route.dispatchedByUserId = original.dispatchedByUserId;
      route.dispatchNote = original.dispatchNote;
    }
  });

  it('keeps preview completion-location evidence in route detail and stop timeline', async () => {
    vi.stubGlobal('window', {
      location: { hostname: '127.0.0.1', search: '' },
      __TROVAN_LOCAL_DEMO_PREVIEW__: true,
    } as unknown as Window & typeof globalThis);
    const before = await getRouteRunDetail('route-alpha-001');
    const stop = before.stops[0];

    await markRouteRunStopServiced(stop.id);
    const detail = await getRouteRunDetail('route-alpha-001');
    const timeline = await getRouteRunStopTimeline(stop.id);
    const detailEvidence = detail.stopEvents.find(
      (event) => event.eventType === 'SERVICED',
    )?.payload?.completionLocationEvidence;
    const timelineEvidence = timeline.events.find(
      (event) => event.eventType === 'SERVICED',
    )?.payload?.completionLocationEvidence;

    expect(detailEvidence).toEqual(expect.objectContaining({
      status: 'within_range',
      thresholdMeters: 250,
      varianceMeters: 82,
    }));
    expect(timelineEvidence).toEqual(detailEvidence);
  });
});
