import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentOrganization,
  updateCurrentOrganizationSettings,
} from './organizationsApi';

describe('organizationsApi notification settings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('normalizes timing and completion-evidence controls from the organization', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => 'token-123',
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          data: {
            organization: {
              id: 'org-1',
              name: 'Acme Fleet',
              slug: 'acme-fleet',
              settings: {
                branding: {},
                notifications: {
                  emailEnabled: true,
                  smsEnabled: false,
                  defaultChannel: 'email',
                  scheduledEnabled: true,
                  onTheWayEnabled: true,
                  onTheWayMinutesBefore: 45,
                  onTheWayRequirePreviousCompletion: true,
                  completionEnabled: true,
                  failureEnabled: false,
                  completionVarianceThresholdMeters: 300,
                },
              },
            },
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const organization = await getCurrentOrganization();

    expect(organization?.settings?.notifications).toEqual(expect.objectContaining({
      defaultChannel: 'email',
      onTheWayMinutesBefore: 45,
      onTheWayRequirePreviousCompletion: true,
      failureEnabled: false,
      completionVarianceThresholdMeters: 300,
    }));
  });

  it('sends the canonical notification-control payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { organization: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: () => 'token-123',
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    });

    await updateCurrentOrganizationSettings({
      notificationEmailEnabled: true,
      notificationSmsEnabled: false,
      defaultNotificationChannel: 'email',
      notificationScheduledEnabled: true,
      notificationOnTheWayEnabled: true,
      notificationOnTheWayMinutesBefore: 30,
      notificationOnTheWayRequirePreviousCompletion: true,
      notificationCompletionEnabled: true,
      notificationFailureEnabled: true,
      completionVarianceThresholdMeters: 250,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/organizations/current/settings'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          notificationEmailEnabled: true,
          notificationSmsEnabled: false,
          defaultNotificationChannel: 'email',
          notificationScheduledEnabled: true,
          notificationOnTheWayEnabled: true,
          notificationOnTheWayMinutesBefore: 30,
          notificationOnTheWayRequirePreviousCompletion: true,
          notificationCompletionEnabled: true,
          notificationFailureEnabled: true,
          completionVarianceThresholdMeters: 250,
        }),
      }),
    );
  });
});
