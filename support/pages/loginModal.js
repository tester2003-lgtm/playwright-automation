// Page object for the customer "Sign In to your account" modal
// (header → My Account → Sign in to Account). Shared by the auth specs.
//
// The form's <label>s are not linked to their <input>s (no for/id), so getByLabel() can't
// find them — each field is located as the .g-input wrapper whose label has that text.

const { expect } = require('@playwright/test');
const { AccountMenu } = require('./accountMenu');

const MESSAGES = {
  emailRequired: 'Email address is required. Please try again.',
  emailInvalid: 'Please enter a valid email.',
  passwordRequired: 'Password is required. Please try again.',
  passwordTooShort: 'The password must be at least 6 characters.',
  noMatch: 'Your email address and password do not match.',
};

class LoginModal {
  constructor(page) {
    this.page = page;
    this.accountMenu = new AccountMenu(page);

    this.form = page.locator('form.login_form');
    this.modal = page.locator('.g-modal', { has: this.form });
    this.closeButton = this.modal.locator('.g-modal-close');
    this.heading = this.modal.locator('h3', { hasText: 'Sign In to your account' });
    this.emailField = this.field('Email Address');
    this.passwordField = this.field('Password');
    this.submitButton = this.form.locator('button[type="submit"]', { hasText: 'Sign In' });
    // Server-side errors (wrong password, unknown email, ...) appear below the password field.
    this.formError = this.form.locator('.error_msg');
    this.forgotPasswordLink = this.form.getByRole('link', { name: 'Forgot Password?', exact: true });
    this.googleButton = this.modal.getByRole('button', { name: 'Login with Google' });
    this.facebookButton = this.modal.getByRole('button', { name: 'Login with Facebook' });
  }

  field(label) {
    return this.form
      .locator('.g-input')
      .filter({ has: this.page.locator('label').getByText(label, { exact: true }) });
  }

  async open() {
    await this.page.goto('/');
    await this.openFromHeader();
  }

  // Opens the modal on the current page, without reloading it.
  async openFromHeader() {
    await this.accountMenu.openGuestMenu();
    await this.accountMenu.headerSignInButton.click();
    await expect(this.form).toBeVisible();
    await expect(this.heading).toBeVisible();
  }

  async login({ email = '', password = '' } = {}) {
    await this.emailField.locator('input').fill(email);
    await this.passwordField.locator('input').fill(password);
    await this.submitButton.click();
  }

  async close() {
    await this.closeButton.click();
    await expect(this.form).toBeHidden();
  }

  async expectFormStillOpen() {
    await expect(this.form).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectFieldError(field, message) {
    await expect(field).toHaveClass(/g-input--error/);
    await expect(field.locator('.g-input-error-message')).toHaveText(message);
  }

  async expectNoFieldError(field) {
    await expect(field).not.toHaveClass(/g-input--error/);
  }

  async expectFormError(message) {
    await expect(this.formError).toHaveText(message, { timeout: 20_000 });
  }

  // Logged in = the modal has closed and the header/footer show the member links.
  async expectLoggedIn() {
    await expect(this.form).toBeHidden({ timeout: 20_000 });
    await this.accountMenu.expectLoggedIn();
  }

  async expectLoggedOut() {
    await this.accountMenu.expectLoggedOut();
  }
}

module.exports = { LoginModal, MESSAGES };
