import type { Page } from '@playwright/test';

export type PreviewSessionRole = 'dispatcher' | 'driver';

const previewUsers = {
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
      if (shouldResetPreviewState) {
        window.localStorage.removeItem('trovan-preview-state-v2');
      }
      window.localStorage.removeItem('trovan.shell.sidebarCollapsed');
      window.localStorage.removeItem('trovan.theme.mode');
      window.localStorage.removeItem('trovan-preview-auth-user');

      if (selectedAuthToken) {
        window.localStorage.setItem('authToken', selectedAuthToken);
        return;
      }

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
