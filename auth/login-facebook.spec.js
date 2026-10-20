// Auth — Login with Facebook: the hand-off from the site to Facebook, and what happens when the
// user comes back without signing in.
// Migrated from cypress/e2e/auth/login-facebook.cy.js.
// Run: npx playwright test auth/login-facebook.spec.js
//
// "Login with Facebook" opens a popup at /login/facebook?app_id=…, which sends it to
// https://facebook.com/v2.12/dialog/oauth. Facebook's pages are never loaded: every request to
// facebook.com gets a stand-in page (support/socialLogin.js explains how).
//
// MANUAL CHECK before a release or after auth changes (not automatable without a Facebook test
// user — see the test.fixme() at the bottom):
//   [ ] "Login with Facebook" → sign in with a Facebook account → the popup closes and the menu
//       shows Profile / My Orders / Sign Out; still logged in after a reload; Sign Out works.

const { test, expect } = require('@playwright/test');
const { LoginModal } = require('../support/pages/loginModal');
const { BASE_URL } = require('../support/config');
const { PROVIDERS, interceptProvider, openPopup } = require('../support/socialLogin');

test.describe('Login with Facebook', () => {
  /** @type {LoginModal} */
  let loginModal;

  test.beforeEach(async ({ page }) => {
    loginModal = new LoginModal(page);
    await loginModal.open();
  });

  test('shows a "Login with Facebook" button on the Sign In form', async () => {
    await expect(loginModal.facebookButton).toBeVisible();
  });

  test('opens the Facebook sign-in popup', async ({ page, context }) => {
    await interceptProvider(context, 'facebook');

    const popup = await openPopup(page, loginModal.facebookButton);

    expect(popup.url()).toMatch(new RegExp(`^${BASE_URL}/login/facebook\\?app_id=\\w+`));
  });

  test("sends the user to Facebook's sign-in with the site's settings", async ({ page, context }) => {
    const facebookRequests = await interceptProvider(context, 'facebook');

    const popup = await openPopup(page, loginModal.facebookButton);
    await popup.waitForURL(PROVIDERS.facebook);

    expect(facebookRequests).toHaveLength(1);
    const facebook = facebookRequests[0];
    const params = facebook.searchParams;
    expect(facebook.pathname, 'Facebook sign-in address').toMatch(/^(\/v[\d.]+)?\/dialog\/oauth$/);
    expect(params.get('client_id'), 'client_id: the site\'s Facebook app ID').toMatch(/^\d+$/);
    expect(params.get('redirect_uri'), 'redirect_uri: Facebook sends the user back here').toBe(`${BASE_URL}/`);
    expect(params.get('response_type'), 'response_type').toBe('token');
    expect(params.get('scope').split(' '), 'scope').toEqual(expect.arrayContaining(['public_profile', 'email']));
    // state protects the round trip against forged replies.
    expect(params.get('state'), 'state').toBeTruthy();
  });

  test('stays logged out when the user cancels on Facebook', async ({ page, context }) => {
    // Facebook's answer when the user clicks Cancel: back to redirect_uri with error=access_denied.
    await interceptProvider(context, 'facebook', (url) => {
      const back = new URL(url.searchParams.get('redirect_uri'));
      back.search = new URLSearchParams({
        error_reason: 'user_denied',
        error: 'access_denied',
        error_description: 'Permissions error.',
        state: url.searchParams.get('state'),
      });
      return `<script>location.replace(${JSON.stringify(back.href)})</script>`;
    });

    await test.step('clicks "Login with Facebook" and cancels on Facebook', async () => {
      const popup = await openPopup(page, loginModal.facebookButton);
      await popup.waitForURL((url) => url.href.startsWith(`${BASE_URL}/`) && url.searchParams.get('error') === 'access_denied');
    });

    await test.step('is still logged out on the site', async () => {
      await page.reload();
      await loginModal.expectLoggedOut();
    });
  });

  // Signing in for real needs a Facebook test user (Meta app ID + app secret, or a test user's
  // access token), which were never set up for Cypress either: its programmatic login tests
  // were pending. Shows as "fixme" in the report so the gap stays visible; covered by the manual
  // check above. After sign-in a Facebook member is the same as any member, so the menu, cart
  // and sign-out are covered by login-email, cart/ and sign-out.
  test.fixme('signs in as a Facebook member after Facebook sends them back', async () => {});
});
