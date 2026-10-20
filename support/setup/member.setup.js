// Logs in as the test member ONCE and saves the session to .auth/member.json.
// The "customer" test project depends on this and reuses the saved session.
// Mirrors cy.loginByEmail(): it calls the site's own $auth.loginWith('local', ...) rather
// than driving the login form (the form itself is covered by its own spec).

const { test: setup, expect } = require('@playwright/test');
const { MEMBER_STATE, loginAsMember } = require('../auth');

setup('authenticate as member', async ({ page }) => {
  await loginAsMember(page);

  await expect(page.locator('ul.menu_links')).toContainText('Sign Out', { timeout: 20000 });

  await page.context().storageState({ path: MEMBER_STATE });
});
