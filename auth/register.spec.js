// Auth — Register a new account: form validation, existing accounts, and email verification.
// Migrated from cypress/e2e/auth/register.cy.js.
// Run: npx playwright test auth/register.spec.js
//
// Runs in the "public" project: every test starts logged out in a fresh browser.
// Passing the form emails a 4-digit verification code to the new address. New addresses use
// Gmail "+" addressing (trainee84.glophics+reg<timestamp>@gmail.com): the site sees a brand new
// email every run, while every code lands in the trainee84 inbox (2 emails per run).
// Finishing a registration needs that emailed code, which the tests can't read yet — see the
// test.fixme() at the bottom.

const { test, expect } = require('@playwright/test');
const { RegisterModal, MESSAGES } = require('../support/pages/registerModal');
const { LoginModal } = require('../support/pages/loginModal');

const { MEMBER_EMAIL, MEMBER_PASSWORD } = process.env;
const NEEDS_MEMBER = 'Set MEMBER_EMAIL and MEMBER_PASSWORD in the Playwright .env';

const newEmail = () => `trainee84.glophics+reg${Date.now()}@gmail.com`;
// Registered through Google login - has no site password.
const GOOGLE_EMAIL = 'trainee84.glophics@gmail.com';
const DISPOSABLE_EMAIL = 'qa.automation@mailinator.com';

const VALID = { firstName: 'QA', lastName: 'Automation', password: 'Test1234!' };

test.describe('Register a new account', () => {
  /** @type {RegisterModal} */
  let register;

  test.beforeEach(async ({ page }) => {
    register = new RegisterModal(page);
    await register.open();
  });

  test.describe('Validation errors', () => {
    test('shows required errors when the form is empty', async () => {
      await register.submit();

      await register.expectFieldError('First Name', MESSAGES.firstNameRequired);
      await register.expectFieldError('Last Name', MESSAGES.lastNameRequired);
      await register.expectFieldError('Email Address', MESSAGES.emailRequired);
      await register.expectFieldError('Password', MESSAGES.passwordRequired);
    });

    test('shows a required error only for the missing field', async () => {
      await register.fill({ ...VALID, email: newEmail(), firstName: null });
      await register.submit();

      await register.expectFieldError('First Name', MESSAGES.firstNameRequired);
      await register.expectNoFieldError('Last Name');
      await register.expectNoFieldError('Email Address');
      await register.expectNoFieldError('Password');
    });

    for (const badEmail of ['not-an-email', 'qa@', 'qa@domain', '@gmail.com', 'qa automation@gmail.com']) {
      test(`rejects an invalid email: "${badEmail}"`, async () => {
        await register.fill({ ...VALID, email: badEmail });
        await register.submit();

        await register.expectFieldError('Email Address', MESSAGES.emailInvalid);
      });
    }

    test('rejects a password shorter than 6 characters', async () => {
      await register.fill({ ...VALID, email: newEmail(), password: '12345' });
      await register.submit();

      await register.expectFieldError('Password', MESSAGES.passwordTooShort);
    });

    // KNOWN BUG (dev, Oct 2026): the server rejects disposable addresses (422 "Sorry, we don't
    // allow disposable email address.") but the form shows nothing — clicking Register just does
    // nothing. BaseFormRegister.vue sets the message but never marks the field as in error, so
    // it stays hidden. test.fail() turns RED once it's fixed — then delete the test.fail() line.
    test('rejects a disposable email address with a message', async () => {
      test.fail(true, 'Known bug: no message is shown for a disposable email address');

      await register.fill({ ...VALID, email: DISPOSABLE_EMAIL });
      await register.submit();

      await register.expectFieldError('Email Address', MESSAGES.emailDisposable);
    });
  });

  test.describe('Email already registered', () => {
    test('tells a Google-login user to continue with Google', async () => {
      await register.fill({ ...VALID, email: GOOGLE_EMAIL });
      await register.submit();

      await register.expectEmailAlreadyRegistered(GOOGLE_EMAIL);
      await expect(register.registeredInfo).toContainText('registered in our system through social media login');
      await expect(register.loginWithGoogleButton).toBeVisible();
    });

    test('"Go Back" returns to the registration form', async () => {
      await register.fill({ ...VALID, email: GOOGLE_EMAIL });
      await register.submit();
      await register.expectEmailAlreadyRegistered(GOOGLE_EMAIL);

      await register.registeredGoBack.click();

      await expect(register.form).toBeVisible();
      await expect(register.registeredModal).toHaveCount(0);
    });

    // Signs in with a NEW session of its own (it never signs out), so the shared saved member
    // session is not affected.
    test('lets an existing member sign in with their password instead', async () => {
      test.skip(!MEMBER_EMAIL || !MEMBER_PASSWORD, NEEDS_MEMBER);

      await test.step('fills the form with an email that already has an account', async () => {
        await register.fill({ ...VALID, email: MEMBER_EMAIL });
        await register.submit();
      });

      await test.step('sees "Email already registered" asking for the password', async () => {
        await register.expectEmailAlreadyRegistered(MEMBER_EMAIL);
        await expect(register.registeredPassword).toBeVisible();
      });

      await test.step('enters the password, clicks Continue and is signed in', async () => {
        await register.registeredPassword.fill(MEMBER_PASSWORD);
        await register.registeredContinue.click();
        await expect(register.registeredModal).toHaveCount(0, { timeout: 20_000 });
        await register.accountMenu.expectLoggedIn();
      });
    });
  });

  test.describe('Email verification', () => {
    test('accepts a password of exactly 6 characters and asks for the emailed code', async () => {
      const email = newEmail();
      await register.fill({ ...VALID, email, password: '123456' });
      await register.submit();

      await register.expectVerificationAskedFor(email);
    });

    // Codes are 1000-9999, so "0000" can never be right (it can't match by chance).
    test('rejects a wrong verification code', async () => {
      const email = newEmail();

      await test.step('fills the form with a new email and asks for the code', async () => {
        await register.fill({ ...VALID, email });
        await register.submit();
        await register.expectVerificationAskedFor(email);
      });

      await test.step('enters a wrong code and sees an error', async () => {
        await register.enterCode('0000');
        await expect(register.codeError).toHaveText(MESSAGES.wrongCode, { timeout: 20_000 });
        await expect(register.codeField).toContainClass('error_field');
        await expect(register.verifyForm).toBeVisible();
      });
    });

    // Needs the code from the email: blocked until the tests can read the trainee84 inbox
    // (or the dev team adds a test hook). Shows as "fixme" in the report so the gap stays visible.
    test.fixme('registers a new account after entering the emailed code', async () => {});
  });

  test('"Login Here" switches to the Sign In form', async ({ page }) => {
    const loginModal = new LoginModal(page);

    await register.loginHereLink.click();

    await expect(loginModal.form).toBeVisible();
    await expect(loginModal.heading).toBeVisible();
    await expect(register.form).toHaveCount(0);
  });
});
