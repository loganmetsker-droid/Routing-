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
    resetRouteState = true,
    preservePreviewIdentityOnNavigation = false,
  }: {
    role: PreviewSessionRole;
    authToken?: string;
    resetPreviewState?: boolean;
    resetRouteState?: boolean;
    preservePreviewIdentityOnNavigation?: boolean;
  },
) {
  await page.addInitScript(
    ({
      selectedRole,
      selectedAuthToken,
      shouldResetPreviewState,
      shouldResetRouteState,
      shouldPreservePreviewIdentity,
      users,
    }) => {
      if (shouldResetPreviewState) {
        window.localStorage.removeItem('trovan-preview-state-v2');
      }
      if (shouldResetRouteState) {
        for (const key of Object.keys(window.localStorage)) {
          if (key.startsWith('trovan-routing-workspace-preferences:')) {
            window.localStorage.removeItem(key);
          }
        }
        window.localStorage.removeItem('trovan.map.baseStyle');
      }
      window.localStorage.removeItem('trovan.shell.sidebarCollapsed');
      window.localStorage.removeItem('trovan.theme.mode');

      if (selectedAuthToken) {
        window.localStorage.removeItem('trovan-preview-auth-user');
        window.localStorage.setItem('authToken', selectedAuthToken);
        return;
      }

      let user = users[selectedRole] as Record<string, unknown>;
      if (shouldPreservePreviewIdentity) {
        try {
          const existingUser = JSON.parse(
            window.localStorage.getItem('trovan-preview-auth-user') || 'null',
          );
          if (existingUser && typeof existingUser === 'object') {
            user = existingUser;
          }
        } catch {
          // Invalid test state is replaced with the explicitly selected role.
        }
      }
      window.localStorage.removeItem('trovan-preview-auth-user');
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
      shouldResetRouteState: resetRouteState,
      shouldPreservePreviewIdentity: preservePreviewIdentityOnNavigation,
      users: previewUsers,
    },
  );
}
