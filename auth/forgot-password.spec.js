// Auth — Forgot password: validation errors, Go Back, and sending reset instructions.
// Migrated from cypress/e2e/auth/forgot-password.cy.js.
// Run: npx playwright test auth/forgot-password.spec.js
//
// Runs in the "public" project: every test starts logged out in a fresh browser.
// The two tests that send for real email reset instructions to MEMBER_EMAIL (3 emails per run).
// Following the emailed reset link is not automated (it needs inbox access).
// The two known-bug tests fake the server's reply with page.route() instead: the bugs are in
// how the page handles the reply, and faking it sends no email.

const { test, expect } = require('@playwright/test');
const { ForgotPasswordModal, MESSAGES } = require('../support/pages/forgotPasswordModal');

const { MEMBER_EMAIL } = process.env;
const NEEDS_MEMBER = 'Set MEMBER_EMAIL in the Playwright .env';

// Registered through Google login - has no site password.
const GOOGLE_EMAIL = 'trainee84.glophics@gmail.com';
const UNREGISTERED_EMAIL = 'trainee84.glophics+not-registered@gmail.com';
// Only used where the server reply is faked, so nothing is sent to it.
const ANY_EMAIL = 'someone@example.com';

// Replace the server's answer to "send me reset instructions" (POST user/forgot-password).
async function fakeForgotPasswordReply(page, { status = 200, body }) {
  await page.route('**/user/forgot-password', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test.describe('Forgot password', () => {
  /** @type {ForgotPasswordModal} */
  let forgot;

  test.beforeEach(async ({ page }) => {
    forgot = new ForgotPasswordModal(page);
    await forgot.open();
    await forgot.expectFormShown();
  });

  test.describe('Validation errors', () => {
    test('requires an email', async () => {
      await forgot.sendResetInstructions();

      await forgot.expectEmailError(MESSAGES.emailRequired);
    });

    for (const badEmail of ['not-an-email', 'qa@', 'qa@domain', '@gmail.com']) {
      test(`rejects an invalid email: "${badEmail}"`, async () => {
        await forgot.sendResetInstructions(badEmail);

        await forgot.expectEmailError(MESSAGES.emailInvalid);
      });
    }

    test('rejects an email that is not registered', async () => {
      await forgot.sendResetInstructions(UNREGISTERED_EMAIL);

      await forgot.expectEmailError(MESSAGES.notRegistered);
      await forgot.expectFormShown();
    });

    test('rejects an email registered through Google login', async () => {
      await forgot.sendResetInstructions(GOOGLE_EMAIL);

      await forgot.expectEmailError(MESSAGES.googleAccount);
      await forgot.expectFormShown();
    });
  });

  test.describe('Navigation', () => {
    test('"Go Back" returns to the Sign In form', async () => {
      await forgot.goBackLink.click();

      await expect(forgot.loginModal.form).toBeVisible();
      await expect(forgot.loginModal.heading).toBeVisible();
      await forgot.expectClosed();
    });

    // KNOWN BUG (dev, Oct 2026): closing "Check your email" with the X keeps that screen.
    // Opening Forgot Password again shows "Check your email" instead of the form, so the user
    // can't request a reset for another email without reloading the page. "Done" resets it;
    // the X doesn't (ModalForgotPassword.vue hide() never calls resetData()).
    // test.fail() keeps the run green while the bug exists and turns this test RED once it
    // is fixed — then delete the test.fail() line.
    test('shows the email form again when reopened after closing "Check your email" with X', async ({ page }) => {
      test.fail(true, 'Known bug: closing "Check your email" with X keeps that screen when reopened');

      await test.step('sends reset instructions (server reply faked) and sees "Check your email"', async () => {
        await fakeForgotPasswordReply(page, { body: { status: 'SUCCESS', message: 'Success', code: 200 } });
        await forgot.sendResetInstructions(ANY_EMAIL);
        await forgot.expectCheckEmailShown();
      });

      await test.step('closes the modal with the X button', async () => {
        await forgot.closeButton.click();
        await forgot.expectClosed();
      });

      await test.step('opens Sign In → Forgot Password again, without reloading the page', async () => {
        await forgot.reopen();
      });

      await test.step('sees the email form, not "Check your email"', async () => {
        await forgot.expectFormShown();
      });
    });
  });

  test.describe('Sending reset instructions', () => {
    test('sends reset instructions to a registered email, then closes with "Done"', async () => {
      test.skip(!MEMBER_EMAIL, NEEDS_MEMBER);

      await test.step('enters the member email and clicks Send me reset instructions', async () => {
        await forgot.sendResetInstructions(MEMBER_EMAIL);
      });

      await test.step('sees "Check your email" with a link to resend', async () => {
        await forgot.expectCheckEmailShown();
      });

      await test.step('clicks Done: the modal closes', async () => {
        await forgot.doneButton.click();
        await forgot.expectClosed();
        await expect(forgot.loginModal.form).toHaveCount(0);
      });
    });

    test('resends the reset instructions', async () => {
      test.skip(!MEMBER_EMAIL, NEEDS_MEMBER);

      await test.step('sends reset instructions to the member email', async () => {
        await forgot.sendResetInstructions(MEMBER_EMAIL);
        await forgot.expectCheckEmailShown();
      });

      await test.step('clicks "resend email instructions" and sees it was sent again', async () => {
        await forgot.resendLink.click();
        await expect(forgot.resendSuccess).toHaveText(MESSAGES.resent, { timeout: 20_000 });
        await expect(forgot.checkEmail).toContainText(MESSAGES.resentNote);
      });
    });

    // KNOWN BUG (dev, Oct 2026): if the server fails, the "Send me reset instructions" button
    // stays disabled for good and no message is shown — the user is stuck until they reload.
    // (BaseForgotPassword.vue submitForgotPassword() has no error handling for a failed request.)
    test('re-enables the Send button when the server fails, so the user can try again', async ({ page }) => {
      test.fail(true, 'Known bug: a server error leaves the Send button disabled with no message');

      await test.step('enters an email and clicks Send — the server fails (faked 500)', async () => {
        await fakeForgotPasswordReply(page, { status: 500, body: { message: 'Server Error' } });
        const failedReply = page.waitForResponse('**/user/forgot-password');
        await forgot.sendResetInstructions(ANY_EMAIL);
        await failedReply;
      });

      await test.step('can click "Send me reset instructions" again', async () => {
        await expect(forgot.sendButton).toBeEnabled();
      });
    });
  });
});
