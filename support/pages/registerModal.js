// Page object for "New Member Registration" (header → My Account → Register) and the screens
// that can follow it:
//   - "Verification Required": enter the 4-digit code emailed to the new address;
//   - "Email already registered": the email already has an account (password or Google/Facebook).
// Based on components/common/auth/BaseFormRegister.vue, BaseVerifyCode.vue and
// components/modals/ModalEmailRegistered.vue in the storefront repo (../Frontend).
//
// The form's <label>s are not linked to their <input>s, so each field is found as the .g-input
// wrapper whose label has that text.

const { expect } = require('@playwright/test');
const { AccountMenu } = require('./accountMenu');

const MESSAGES = {
  firstNameRequired: 'First name is required. Please try again.',
  lastNameRequired: 'Last name is required. Please try again.',
  emailRequired: 'Email address is required. Please try again.',
  emailInvalid: 'Please enter a valid email.',
  emailDisposable: "Sorry, we don't allow disposable email address.",
  passwordRequired: 'Password is required. Please try again.',
  passwordTooShort: 'The Password must be 6 or more characters.',
  wrongCode: 'Please enter the verification code sent to your email.',
};

const FIELDS = ['First Name', 'Last Name', 'Email Address', 'Password'];

class RegisterModal {
  constructor(page) {
    this.page = page;
    this.accountMenu = new AccountMenu(page);

    // The registration form.
    this.form = page.locator('form.register_form');
    this.modal = page.locator('.g-modal', { has: this.form });
    this.heading = this.modal.getByRole('heading', { name: 'New Member Registration' });
    this.marketingCheckbox = this.form.locator('button.g-checkbox');
    this.submitButton = this.form.getByRole('button', { name: 'Register', exact: true });
    this.loginHereLink = this.modal.getByRole('link', { name: 'Login Here' });

    // "Verification Required": the emailed 4-digit code.
    this.verifyForm = page.locator('form.verification_form');
    this.verifyModal = page.locator('.g-modal', { has: this.verifyForm });
    this.verifyTitle = this.verifyModal.locator('.g-modal-header h3');
    this.verifyInfo = this.verifyForm.locator('.verification_info');
    this.codeField = this.verifyForm.locator('.code_fiield');
    this.codeInput = this.codeField.locator('input');
    this.verifyButton = this.verifyForm.getByRole('button', { name: 'Verify Email Address' });
    this.codeError = this.verifyForm.locator('.error_message');

    // "Email already registered".
    this.registeredModal = page.locator('.g-modal', { has: page.locator('.email_registered_info') });
    this.registeredTitle = this.registeredModal.locator('.g-modal-header h3');
    this.registeredInfo = this.registeredModal.locator('.email_registered_info');
    this.registeredGoBack = this.registeredModal.getByRole('link', { name: 'Go Back' });
    this.loginWithGoogleButton = this.registeredModal.getByRole('button', { name: 'Login with Google' });
    this.registeredPassword = this.registeredModal.locator('input[type="password"]');
    this.registeredContinue = this.registeredModal.getByRole('button', { name: 'Continue', exact: true });
  }

  field(label) {
    return this.form
      .locator('.g-input')
      .filter({ has: this.page.locator('label').getByText(label, { exact: true }) });
  }

  // Homepage → My Account → Register.
  async open() {
    await this.page.goto('/');
    await this.accountMenu.openGuestMenu();
    await this.accountMenu.headerRegisterButton.click();
    await expect(this.form).toBeVisible();
    await expect(this.heading).toBeVisible();
  }

  // Fills only the fields given; leave one out (or pass null) to keep it empty.
  async fill({ firstName, lastName, email, password } = {}) {
    const values = { 'First Name': firstName, 'Last Name': lastName, 'Email Address': email, Password: password };
    for (const label of FIELDS) {
      if (values[label] != null) await this.field(label).locator('input').fill(values[label]);
    }
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectFieldError(label, message) {
    await expect(this.field(label).locator('.g-input-error-message')).toHaveText(message, { timeout: 20_000 });
    await expect(this.field(label)).toContainClass('g-input--error');
  }

  async expectNoFieldError(label) {
    await expect(this.field(label)).not.toContainClass('g-input--error');
  }

  // Passing the form moves on to "Verification Required" for that email address.
  async expectVerificationAskedFor(email) {
    await expect(this.verifyForm).toBeVisible({ timeout: 20_000 });
    await expect(this.verifyTitle).toHaveText('Verification Required');
    await expect(this.verifyInfo).toContainText(email);
    await expect(this.form).toHaveCount(0);
  }

  async enterCode(code) {
    await this.codeInput.fill(code);
    await this.verifyButton.click();
  }

  async expectEmailAlreadyRegistered(email) {
    await expect(this.registeredTitle).toHaveText('Email already registered', { timeout: 20_000 });
    await expect(this.registeredInfo).toContainText(email);
  }
}

module.exports = { RegisterModal, MESSAGES };
