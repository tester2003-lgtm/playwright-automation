// Auth — Login with email and password (valid and invalid).
// Migrated from cypress/e2e/auth/login-email.cy.js.
// Run: npx playwright test auth/login-email.spec.js
//
// Runs in the "public" project: every test starts logged out in a fresh browser context.
// The valid-login tests use MEMBER_EMAIL / MEMBER_PASSWORD from playwright/.env.

const { test } = require('@playwright/test');
const { LoginModal, MESSAGES } = require('../support/pages/loginModal');

const { MEMBER_EMAIL, MEMBER_PASSWORD } = process.env;
const NEEDS_MEMBER = 'Set MEMBER_EMAIL and MEMBER_PASSWORD in playwright/.env';

// Registered through Google login - has no site password.
const GOOGLE_EMAIL = 'trainee84.glophics@gmail.com';
const UNREGISTERED_EMAIL = 'trainee84.glophics+not-registered@gmail.com';
const SOME_PASSWORD = 'Test1234!';

test.describe('Login with email and password', () => {
  /** @type {LoginModal} */
  let loginModal;

  test.beforeEach(async ({ page }) => {
    loginModal = new LoginModal(page);
    await loginModal.open();
  });

  test.describe('Invalid login', () => {
    test('shows required errors when the form is empty', async () => {
      await loginModal.login();

      await loginModal.expectFieldError(loginModal.emailField, MESSAGES.emailRequired);
      await loginModal.expectFieldError(loginModal.passwordField, MESSAGES.passwordRequired);
    });

    test('requires a password', async () => {
      await loginModal.login({ email: UNREGISTERED_EMAIL });

      await loginModal.expectFieldError(loginModal.passwordField, MESSAGES.passwordRequired);
      await loginModal.expectNoFieldError(loginModal.emailField);
    });

    test('requires an email', async () => {
      await loginModal.login({ password: SOME_PASSWORD });

      await loginModal.expectFieldError(loginModal.emailField, MESSAGES.emailRequired);
      await loginModal.expectNoFieldError(loginModal.passwordField);
    });

    for (const badEmail of ['not-an-email', 'qa@', 'qa@domain', '@gmail.com']) {
      test(`rejects an invalid email: "${badEmail}"`, async () => {
        await loginModal.login({ email: badEmail, password: SOME_PASSWORD });

        await loginModal.expectFieldError(loginModal.emailField, MESSAGES.emailInvalid);
      });
    }

    test('rejects a password shorter than 6 characters', async () => {
      await loginModal.login({ email: UNREGISTERED_EMAIL, password: '12345' });

      await loginModal.expectFormError(MESSAGES.passwordTooShort);
    });

    test('rejects an email that is not registered', async () => {
      await loginModal.login({ email: UNREGISTERED_EMAIL, password: SOME_PASSWORD });

      await loginModal.expectFormError(MESSAGES.noMatch);
      await loginModal.expectFormStillOpen();
    });

    test('rejects a password login for a Google-only account', async () => {
      await loginModal.login({ email: GOOGLE_EMAIL, password: SOME_PASSWORD });

      await loginModal.expectFormError(MESSAGES.noMatch);
    });

    test('rejects a wrong password for a registered account', async () => {
      test.skip(!MEMBER_EMAIL, NEEDS_MEMBER);

      await loginModal.login({ email: MEMBER_EMAIL, password: 'Wrong-Password-123' });

      await loginModal.expectFormError(MESSAGES.noMatch);
    });

    test('stays logged out after a failed login', async () => {
      await loginModal.login({ email: UNREGISTERED_EMAIL, password: SOME_PASSWORD });
      await loginModal.expectFormError(MESSAGES.noMatch);

      await loginModal.close();
      await loginModal.expectLoggedOut();
    });
  });

  test.describe('Valid login', () => {
    test.skip(!MEMBER_EMAIL || !MEMBER_PASSWORD, NEEDS_MEMBER);

    // test.step() shows each step as its own line in the report, and the test stops at the
    // step that fails — while the test itself still runs on its own.
    test('logs in with a registered email and password', async ({ page }) => {
      await test.step('enters the member email and password and clicks Sign In', async () => {
        await loginModal.login({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD });
      });

      await test.step('sees the member menu: Profile, My Orders, Sign Out', async () => {
        await loginModal.expectLoggedIn();
      });

      await test.step('is still logged in after reloading the page', async () => {
        await page.reload();
        await loginModal.expectLoggedIn();
      });
    });

    test('accepts the email in upper case', async () => {
      await loginModal.login({ email: MEMBER_EMAIL.toUpperCase(), password: MEMBER_PASSWORD });

      await loginModal.expectLoggedIn();
    });
  });
});
