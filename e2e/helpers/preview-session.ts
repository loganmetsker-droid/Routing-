import type { Page } from '@playwright/test';

export type PreviewSessionRole = 'owner' | 'dispatcher' | 'driver' | 'viewer';

const previewUsers = {
  owner: {
    id: 'preview-owner-user',
    email: 'owner@trovan.local',
    role: 'owner',
    roles: ['OWNER'],
  },
  dispatcher: {
    id: 'preview-user',
    email: 'preview@trovan.local',
    role: 'dispatcher',
    roles: ['DISPATCHER'],
  },
  driver: {
    id: 'preview-driver-user',
    email: 'anna.quinn@trovan.local',
    role: 'driver',
    roles: ['DRIVER'],
  },
  viewer: {
    id: 'preview-viewer-user',
    email: 'viewer@trovan.local',
    role: 'viewer',
    roles: ['VIEWER'],
  },
} as const;

export async function preparePreviewSession(
  page: Page,
  {
    role,
    authToken = '',
    resetPreviewState = true,
  }: {
    role: PreviewSessionRole;
    authToken?: string;
    resetPreviewState?: boolean;
  },
) {
  await page.addInitScript(
    ({ selectedRole, selectedAuthToken, shouldResetPreviewState, users }) => {
      const preservePreviewAuthUser =
        window.sessionStorage.getItem('trovan-preserve-preview-auth-user') === 'true';
      if (shouldResetPreviewState) {
        window.localStorage.removeItem('trovan-preview-state-v2');
      }
      window.localStorage.removeItem('trovan.shell.sidebarCollapsed');
      window.localStorage.removeItem('trovan.theme.mode');
      if (!preservePreviewAuthUser) {
        window.localStorage.removeItem('trovan-preview-auth-user');
      }

      if (selectedAuthToken) {
        window.localStorage.setItem('authToken', selectedAuthToken);
        return;
      }

      if (preservePreviewAuthUser) return;

      const user = users[selectedRole];
      window.localStorage.setItem('authToken', 'preview-auth-bypass');
      window.localStorage.setItem(
        'trovan-preview-auth-user',
        JSON.stringify({
          ...user,
          authProvider: 'local-config',
          organizationId: 'preview-org',
          sessionId: 'preview-session',
        }),
      );
    },
    {
      selectedRole: role,
      selectedAuthToken: authToken,
      shouldResetPreviewState: resetPreviewState,
      users: previewUsers,
    },
  );
}
