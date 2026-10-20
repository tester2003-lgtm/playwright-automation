// Auth — Login with Google: the hand-off from the site to Google, and what happens when the
// user comes back without signing in.
// Migrated from cypress/e2e/auth/login-google.cy.js.
// Run: npx playwright test auth/login-google.spec.js
//
// "Login with Google" opens a popup at /login/google?app_id=…, which sends it to
// https://accounts.google.com/o/oauth2/auth. Google's pages are never loaded: every request to
// accounts.google.com gets a stand-in page (support/socialLogin.js explains how).
//
// MANUAL CHECK before a release or after auth changes (not automatable without Google test
// credentials — see the test.fixme() at the bottom):
//   [ ] "Login with Google" → sign in with the test Google account → the popup closes and the
//       menu shows Profile / My Orders / Sign Out; still logged in after a reload.

const { test, expect } = require('@playwright/test');
const { LoginModal } = require('../support/pages/loginModal');
const { RegisterModal } = require('../support/pages/registerModal');
const { BASE_URL } = require('../support/config');
const { PROVIDERS, interceptProvider, openPopup } = require('../support/socialLogin');

// Registered through Google login - has no site password.
const GOOGLE_EMAIL = 'trainee84.glophics@gmail.com';
const VALID = { firstName: 'QA', lastName: 'Automation', password: 'Test1234!' };

test.describe('Login with Google', () => {
  /** @type {LoginModal} */
  let loginModal;

  test.beforeEach(async ({ page }) => {
    loginModal = new LoginModal(page);
    await loginModal.open();
  });

  test('shows a "Login with Google" button on the Sign In form', async () => {
    await expect(loginModal.googleButton).toBeVisible();
  });

  test('opens the Google sign-in popup', async ({ page, context }) => {
    await interceptProvider(context, 'google');

    const popup = await openPopup(page, loginModal.googleButton);

    expect(popup.url()).toMatch(new RegExp(`^${BASE_URL}/login/google\\?app_id=\\w+`));
  });

  test("sends the user to Google's sign-in with the site's settings", async ({ page, context }) => {
    const googleRequests = await interceptProvider(context, 'google');

    const popup = await openPopup(page, loginModal.googleButton);
    await popup.waitForURL(PROVIDERS.google);

    expect(googleRequests).toHaveLength(1);
    const google = googleRequests[0];
    const params = google.searchParams;
    expect(google.pathname, 'Google sign-in address').toBe('/o/oauth2/auth');
    expect(params.get('client_id'), 'client_id').toMatch(/^[\w-]+\.apps\.googleusercontent\.com$/);
    expect(params.get('redirect_uri'), 'redirect_uri: Google sends the user back here').toBe(`${BASE_URL}/`);
    expect(params.get('response_type').split(' '), 'response_type').toEqual(expect.arrayContaining(['token', 'id_token']));
    expect(params.get('scope').split(' '), 'scope').toEqual(expect.arrayContaining(['openid', 'profile', 'email']));
    // state and nonce protect the round trip against forged replies.
    expect(params.get('state'), 'state').toBeTruthy();
    expect(params.get('nonce'), 'nonce').toBeTruthy();
  });

  test('stays logged out when the user cancels on Google', async ({ page, context }) => {
    // Google's answer when the user clicks Cancel: back to redirect_uri with error=access_denied.
    await interceptProvider(context, 'google', (url) => {
      const back = `${url.searchParams.get('redirect_uri')}#error=access_denied&state=${url.searchParams.get('state')}`;
      return `<script>location.replace(${JSON.stringify(back)})</script>`;
    });

    await test.step('clicks "Login with Google" and cancels on Google', async () => {
      const popup = await openPopup(page, loginModal.googleButton);
      await popup.waitForURL((url) => url.href.startsWith(`${BASE_URL}/`) && url.hash.includes('access_denied'));
    });

    await test.step('is still logged out on the site', async () => {
      await page.reload();
      await loginModal.expectLoggedOut();
    });
  });

  test('"Login with Google" on "Email already registered" opens the Google sign-in popup', async ({ page, context }) => {
    await interceptProvider(context, 'google');
    const register = new RegisterModal(page);

    await test.step('tries to register with an email that signs in with Google', async () => {
      await register.open();
      await register.fill({ ...VALID, email: GOOGLE_EMAIL });
      await register.submit();
      await register.expectEmailAlreadyRegistered(GOOGLE_EMAIL);
    });

    await test.step('clicks "Login with Google" and the Google popup opens', async () => {
      const popup = await openPopup(page, register.loginWithGoogleButton);
      expect(popup.url()).toMatch(new RegExp(`^${BASE_URL}/login/google\\?app_id=\\w+`));
    });
  });

  // Signing in for real needs a Google token for the test Google account (OAuth client ID,
  // client secret and refresh token, which were never set up for Cypress either). Shows as
  // "fixme" in the report so the gap stays visible; covered by the manual check above.
  test.fixme('signs in as the Google member after Google sends them back', async () => {});
});
