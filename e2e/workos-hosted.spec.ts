import { expect, test, type Page } from '@playwright/test';

const backendUrl = String(
  process.env.LAUNCH_AUDIT_API_URL || process.env.STAGING_BACKEND_URL || '',
).replace(/\/+$/, '');
const email = process.env.WORKOS_TEST_EMAIL || '';
const password = process.env.WORKOS_TEST_PASSWORD || '';
const expiredToken = process.env.STAGING_EXPIRED_AUTH_TOKEN || '';
const hostedAuthReady = Boolean(backendUrl && email && password && expiredToken);

async function submitVisibleForm(page: Page) {
  const submit = page
    .getByRole('button', {
      name: /continue|sign in|log in|submit/i,
    })
    .filter({ visible: true })
    .first();
  await expect(submit).toBeVisible({ timeout: 20_000 });
  await submit.click();
}

async function completeWorkosLogin(page: Page) {
  await page.goto('/login');
  const trovanOrigin = new URL(page.url()).origin;
  const continueButton = page.getByRole('button', {
    name: /continue with workos/i,
  });
  await expect(continueButton).toBeVisible({ timeout: 20_000 });
  await continueButton.click();

  await page.waitForURL((url) => url.origin !== trovanOrigin, {
    timeout: 30_000,
  });

  const emailInput = page
    .locator('input[type="email"], input[name="email"], input[autocomplete="username"]')
    .filter({ visible: true })
    .first();
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await emailInput.fill(email);

  const passwordInput = page
    .locator(
      'input[type="password"], input[name="password"], input[autocomplete="current-password"]',
    )
    .filter({ visible: true })
    .first();
  if (!(await passwordInput.isVisible().catch(() => false))) {
    await submitVisibleForm(page);
    await expect(passwordInput).toBeVisible({ timeout: 30_000 });
  }
  await passwordInput.fill(password);
  await submitVisibleForm(page);

  await page.waitForURL(/\/(dashboard|driver)(?:[/?#]|$)/, {
    timeout: 60_000,
  });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('authToken')), {
      timeout: 20_000,
    })
    .toBeTruthy();

  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  if (!token) throw new Error('WorkOS callback did not persist an app token');
  return token;
}

function decodeExpiry(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    return typeof parsed.exp === 'number' ? parsed.exp : null;
  } catch {
    return null;
  }
}

test.describe('hosted WorkOS session lifecycle', () => {
  test.skip(
    !hostedAuthReady,
    'Requires hosted backend, WorkOS test credentials, and an expired staging JWT.',
  );

  test('real login, provider logout, revocation, and expiry all work', async ({
    browser,
    request,
  }) => {
    const expiredAt = decodeExpiry(expiredToken);
    expect(expiredAt, 'STAGING_EXPIRED_AUTH_TOKEN must contain an exp claim').not.toBeNull();
    expect(expiredAt!, 'STAGING_EXPIRED_AUTH_TOKEN must already be expired').toBeLessThan(
      Math.floor(Date.now() / 1000),
    );
    const expiredResponse = await request.get(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(expiredResponse.status()).toBe(401);

    const logoutContext = await browser.newContext();
    const logoutPage = await logoutContext.newPage();
    const logoutToken = await completeWorkosLogin(logoutPage);
    const me = await request.get(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${logoutToken}` },
    });
    expect(me.status()).toBe(200);
    const persistenceKeyResponse = await request.post(
      `${backendUrl}/api/platform/api-keys`,
      {
        headers: { Authorization: `Bearer ${logoutToken}` },
        data: {
          name: `WorkOS fresh-session proof ${Date.now()}`,
          scopes: ['jobs:read'],
        },
      },
    );
    expect(persistenceKeyResponse.status()).toBe(201);
    const persistenceKeyPayload = await persistenceKeyResponse.json();
    const persistenceKeyId =
      persistenceKeyPayload?.data?.apiKey?.id ||
      persistenceKeyPayload?.apiKey?.id;
    expect(persistenceKeyId).toBeTruthy();
    const logoutUrlResponse = await request.get(
      `${backendUrl}/api/auth/logout-url`,
      { headers: { Authorization: `Bearer ${logoutToken}` } },
    );
    expect(logoutUrlResponse.status()).toBe(200);
    const logoutPayload = await logoutUrlResponse.json();
    const logoutUrl = logoutPayload?.data?.url || logoutPayload?.url;
    expect(logoutUrl).toMatch(/^https:\/\//);
    await logoutPage.goto(logoutUrl);
    await logoutPage.waitForURL(/\/login(?:[/?#]|$)/, { timeout: 45_000 });
    await logoutContext.close();

    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    let freshToken = '';
    try {
      freshToken = await completeWorkosLogin(freshPage);
      const persistedKeysResponse = await request.get(
        `${backendUrl}/api/platform/api-keys`,
        { headers: { Authorization: `Bearer ${freshToken}` } },
      );
      expect(persistedKeysResponse.status()).toBe(200);
      const persistedKeysPayload = await persistedKeysResponse.json();
      const persistedKeys =
        persistedKeysPayload?.data?.apiKeys ||
        persistedKeysPayload?.apiKeys ||
        [];
      expect(
        persistedKeys.some(
          (item: { id?: string }) => item.id === persistenceKeyId,
        ),
      ).toBe(true);
      const cleanupResponse = await request.delete(
        `${backendUrl}/api/platform/api-keys/${persistenceKeyId}`,
        { headers: { Authorization: `Bearer ${freshToken}` } },
      );
      expect(cleanupResponse.status()).toBe(200);
    } finally {
      if (persistenceKeyId) {
        await request
          .delete(`${backendUrl}/api/platform/api-keys/${persistenceKeyId}`, {
            headers: {
              Authorization: `Bearer ${freshToken || logoutToken}`,
            },
          })
          .catch(() => undefined);
      }
      await freshContext.close();
    }

    const revocationContext = await browser.newContext();
    const revocationPage = await revocationContext.newPage();
    const revocationToken = await completeWorkosLogin(revocationPage);
    const sessionsResponse = await request.get(`${backendUrl}/api/auth/sessions`, {
      headers: { Authorization: `Bearer ${revocationToken}` },
    });
    expect(sessionsResponse.status()).toBe(200);
    const sessionsPayload = await sessionsResponse.json();
    const sessions = sessionsPayload?.data?.sessions || sessionsPayload?.sessions || [];
    const currentSession = sessions.find(
      (session: { current?: boolean }) => session.current,
    );
    expect(currentSession?.id).toBeTruthy();

    const revokeResponse = await request.delete(
      `${backendUrl}/api/auth/sessions/${currentSession.id}`,
      { headers: { Authorization: `Bearer ${revocationToken}` } },
    );
    expect(revokeResponse.status()).toBe(200);
    const revokedMe = await request.get(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${revocationToken}` },
    });
    expect(revokedMe.status()).toBe(401);
    await revocationContext.close();
  });
});
