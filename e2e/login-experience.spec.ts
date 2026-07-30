import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

type AuthConfigOverrides = {
  enabled?: boolean;
  configured?: boolean;
  localLoginAllowed?: boolean;
  preferredProvider?: 'workos' | 'local-config';
  workosReady?: boolean;
  mfaManagedByProvider?: boolean;
};

function authConfig(overrides: AuthConfigOverrides = {}) {
  const workosReady = overrides.workosReady ?? true;
  return {
    auth: {
      enabled: overrides.enabled ?? true,
      configured: overrides.configured ?? true,
      localLoginAllowed: overrides.localLoginAllowed ?? false,
      preferredProvider: overrides.preferredProvider ?? 'workos',
      workos: {
        apiKeyConfigured: workosReady,
        authkitDomain: workosReady ? 'auth.trytrovan.test' : null,
        clientIdConfigured: workosReady,
        connectionIdConfigured: workosReady,
        mfaManagedByProvider: overrides.mfaManagedByProvider ?? workosReady,
        redirectUri: workosReady
          ? 'https://trytrovan.test/auth/callback'
          : null,
        ssoReady: workosReady,
      },
    },
  };
}

async function fulfillAuthConfig(
  route: Route,
  overrides: AuthConfigOverrides = {},
) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(authConfig(overrides)),
  });
}

async function openLiveLogin(
  page: Page,
  overrides: AuthConfigOverrides = {},
) {
  await page.route('**/api/auth/config', (route) =>
    fulfillAuthConfig(route, overrides),
  );
  await page.goto('/login?auth=live', { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'visible' });
}

test.describe('Trovan login experience', () => {
  test('desktop login shows one current product proof and progressively discloses local admin', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openLiveLogin(page, { localLoginAllowed: true });

    await expect(
      page.getByRole('heading', { name: 'Welcome back', level: 1 }),
    ).toHaveCount(1);
    const proof = page.getByTestId('login-product-proof');
    await expect(proof).toBeVisible();
    await expect(proof.locator('video')).toHaveCount(0);
    const productImage = proof.locator(
      'img[src="/marketing/product-routing.png"]',
    );
    await expect(productImage).toHaveCount(1);
    await expect
      .poll(() =>
        productImage.evaluate((image) => {
          const element = image as HTMLImageElement;
          return element.complete && element.naturalWidth > 0;
        }),
      )
      .toBe(true);

    await expect(
      page.getByRole('button', { name: 'Continue with SSO' }),
    ).toBeVisible();
    const localLoginToggle = page.getByRole('button', {
      name: 'Use local admin login',
    });
    await expect(localLoginToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('login-form')).toHaveCount(0);

    await localLoginToggle.click();
    await expect(localLoginToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('login-email')).toHaveAttribute(
      'autocomplete',
      'username',
    );
    await expect(page.getByTestId('login-password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    await page.getByTestId('login-password').fill('pilot-password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(page.getByTestId('login-password')).toHaveAttribute(
      'type',
      'text',
    );
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(page.getByTestId('login-password')).toHaveAttribute(
      'type',
      'password',
    );

    await expect(
      page.getByRole('link', { name: 'Request onboarding' }),
    ).toHaveAttribute('href', '/support');
    await expect(
      page.getByRole('link', { name: 'Contact support' }),
    ).toHaveAttribute('href', '/support');
    await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    );
    await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      '/legal/terms',
    );
    await expect(page).toHaveTitle('Sign in | Trovan');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://trytrovan.com/login',
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
  });

  test('mobile and compact login keep auth first without horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLiveLogin(page);

    await expect(page.getByTestId('login-product-proof')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Continue with SSO' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const buttonHeight = await page
      .getByRole('button', { name: 'Continue with SSO' })
      .evaluate((button) => button.getBoundingClientRect().height);
    expect(buttonHeight).toBeGreaterThanOrEqual(44);

    await page.setViewportSize({ width: 320, height: 568 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('login-product-proof')).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });

  test('failed auth configuration retries into SSO without exposing credentials', async ({
    page,
  }) => {
    let requestCount = 0;
    await page.route('**/api/auth/config', async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Authentication unavailable' }),
        });
        return;
      }
      await fulfillAuthConfig(route);
    });

    await page.goto('/login?auth=live', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('login-unavailable')).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveCount(0);
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByTestId('login-unavailable')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Continue with SSO' }),
    ).toBeVisible();
  });

  test('stalled auth configuration exits the loading state on a bounded deadline', async ({
    page,
  }) => {
    test.setTimeout(20_000);
    let releaseResponse = () => {};
    const stalledResponse = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route('**/api/auth/config', async (route) => {
      await stalledResponse;
      await fulfillAuthConfig(route);
    });

    await page.goto('/login?auth=live', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('login-loading')).toBeVisible();
    await expect(page.getByTestId('login-unavailable')).toBeVisible({
      timeout: 12_000,
    });
    await expect(page.getByTestId('login-loading')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry' })).toBeEnabled();

    releaseResponse();
    await expect(
      page.getByRole('button', { name: 'Continue with SSO' }),
    ).toBeVisible();
  });

  test('locked configuration never falls through to a password form', async ({
    page,
  }) => {
    await openLiveLogin(page, {
      enabled: false,
      configured: false,
      localLoginAllowed: false,
      preferredProvider: 'local-config',
      workosReady: false,
      mfaManagedByProvider: false,
    });

    await expect(page.getByTestId('login-unavailable')).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Continue with SSO' }),
    ).toHaveCount(0);
  });

  test('WorkOS and unavailable variants have no serious accessibility violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await openLiveLogin(page, { localLoginAllowed: true });
    await page.getByRole('button', { name: 'Use local admin login' }).click();

    const workosResults = await new AxeBuilder({ page }).analyze();
    expect(
      workosResults.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact || ''),
      ),
    ).toEqual([]);
  });
});

test.describe('current public product media', () => {
  test('dispatch and demo routes use canonical current media without autoplay duplication', async ({
    page,
  }) => {
    await page.goto('/platform/dispatch', { waitUntil: 'domcontentloaded' });
    await page.locator('#root').waitFor({ state: 'visible' });
    const dispatchSources = await page
      .locator('img[src^="/marketing/"]')
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute('src') || ''),
      );
    expect(dispatchSources).toContain('/marketing/product-jobs.png');
    expect(dispatchSources).toContain('/marketing/product-exceptions.png');
    expect(
      dispatchSources.some((source) =>
        /jobs-queue|dispatch-exceptions|hero-route|routing-workspace/.test(
          source,
        ),
      ),
    ).toBe(false);

    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('video')).toHaveCount(1);
    await expect(page.locator('video')).toHaveAttribute('preload', 'none');
    expect(await page.locator('video').evaluate((video) => video.autoplay)).toBe(
      false,
    );
  });
});
