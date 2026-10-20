// Page object for the "Forgot Password" modal (Sign In modal → "Forgot Password?").
// Based on components/modals/ModalForgotPassword.vue + components/common/auth/BaseForgotPassword.vue
// in the storefront repo (../Frontend).
//
// The modal has two screens:
//   1. the email form ("Send me reset instructions"), and
//   2. "Check your email", shown after the server accepts the email (POST user/forgot-password).
// Which screen shows is kept app-wide (Vuex auth/forgotPassword/status), not in the modal itself.

const { expect } = require('@playwright/test');
const { LoginModal } = require('./loginModal');

const MESSAGES = {
  intro: 'Please enter your email address and we will email you link to reset your password',
  emailRequired: 'Email address is required. Please try again.',
  emailInvalid: 'Please enter a valid email.',
  notRegistered: 'This email address has not been registered.',
  googleAccount: 'This email address is logged in with a Google account.',
  sent: 'Recovery instructions has been sent to your email.',
  resent: 'Email successfully sent.',
  resentNote: 'A new email has successfully been sent.',
};

class ForgotPasswordModal {
  constructor(page) {
    this.page = page;
    this.loginModal = new LoginModal(page);

    this.modal = page.locator('.g-modal', { has: page.locator('.forgot_pass_section, .check_email_section') });
    this.title = this.modal.locator('.g-modal-header h3');
    this.closeButton = this.modal.locator('.g-modal-close');

    // Screen 1: the email form. Its label isn't linked to the input, so find the field by label text.
    this.form = this.modal.locator('.forgot_pass_section');
    this.emailField = this.form
      .locator('.g-input')
      .filter({ has: page.locator('label').getByText('Email Address', { exact: true }) });
    this.emailError = this.emailField.locator('.g-input-error-message');
    this.sendButton = this.form.getByRole('button', { name: 'Send me reset instructions' });
    this.goBackLink = this.form.getByRole('link', { name: 'Go Back', exact: true });

    // Screen 2: "Check your email".
    this.checkEmail = this.modal.locator('.check_email_section');
    this.checkEmailHeading = this.checkEmail.getByRole('heading', { name: 'Check your email' });
    this.doneButton = this.checkEmail.getByRole('button', { name: 'Done', exact: true });
    this.resendLink = this.checkEmail.getByRole('link', { name: 'resend email instructions' });
    this.resendSuccess = this.checkEmail.locator('.success-msg');
  }

  // Homepage → My Account → Sign in to Account → "Forgot Password?"
  async open() {
    await this.loginModal.open();
    await this.openFromLoginModal();
  }

  // Same, on the current page without reloading it (so the app keeps its state).
  async reopen() {
    await this.loginModal.openFromHeader();
    await this.openFromLoginModal();
  }

  async openFromLoginModal() {
    await this.loginModal.forgotPasswordLink.click();
    await expect(this.modal).toBeVisible();
  }

  async sendResetInstructions(email = '') {
    await this.emailField.locator('input').fill(email);
    await this.sendButton.click();
  }

  async expectFormShown() {
    await expect(this.title).toHaveText('Forgot Password');
    await expect(this.form).toContainText(MESSAGES.intro);
    await expect(this.sendButton).toBeVisible();
    await expect(this.checkEmail).toHaveCount(0);
  }

  async expectEmailError(message) {
    await expect(this.emailError).toHaveText(message, { timeout: 20_000 });
    await expect(this.emailField).toContainClass('g-input--error');
  }

  async expectCheckEmailShown() {
    await expect(this.checkEmailHeading).toBeVisible({ timeout: 20_000 });
    await expect(this.checkEmail).toContainText(MESSAGES.sent);
    await expect(this.resendLink).toBeVisible();
    await expect(this.form).toHaveCount(0);
  }

  async expectClosed() {
    await expect(this.modal).toHaveCount(0);
  }
}

module.exports = { ForgotPasswordModal, MESSAGES };
