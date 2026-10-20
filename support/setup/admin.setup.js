// Logs in to the admin panel ONCE and saves the session to .auth/admin.json.
// The "admin" test project depends on this and reuses the saved session.
// Mirrors cy.loginAsAdmin(): the panel's normal login emails a one-time code (tests can't read
// it), so instead we write the 30-day remember token the same way the panel's own auth module
// does, as the active session token. Renew ADMIN_REMEMBER_TOKEN ~monthly.

const { test: setup, expect } = require('@playwright/test');
const { ADMIN_URL } = require('../config');
const { ADMIN_STATE } = require('../auth');

setup('authenticate as admin', async ({ page }) => {
  const token = process.env.ADMIN_REMEMBER_TOKEN;
  if (!token) {
    throw new Error('admin.setup needs ADMIN_REMEMBER_TOKEN in playwright/.env');
  }

  // "/" is the login page and loads without auth; then write the token through the panel's own
  // $storage (it encodes the cookie + localStorage correctly). Setting it as the active session
  // token avoids the server-side "remember" re-mint, which 500s.
  await page.goto(ADMIN_URL + '/');
  await page.waitForFunction(() => window.$nuxt && window.$nuxt.$auth);

  await page.evaluate((token) => {
    const auth = window.$nuxt.$auth;
    auth.$storage.setUniversal('strategy', 'local');
    auth.$storage.setUniversal('_token.local', 'Bearer ' + token);
    // Far-future so the panel doesn't treat the session as expired; the API decides real expiry.
    auth.$storage.setUniversal('_token_expiration.local', Date.now() + 29 * 24 * 60 * 60 * 1000);
  }, token);

  await page.goto(ADMIN_URL + '/dashboard');
  await expect(page, 'admin should land on /dashboard (if not, ADMIN_REMEMBER_TOKEN has likely expired — renew it)')
    .toHaveURL(/\/dashboard/, { timeout: 30000 });
  await expect(page.locator('input[name="username"]')).toHaveCount(0);

  await page.context().storageState({ path: ADMIN_STATE });
});
