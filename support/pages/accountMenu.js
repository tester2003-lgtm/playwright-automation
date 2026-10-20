// Page object for the two places the customer site shows the member's account links:
//   - the header My Account icon (dropdown), and
//   - the footer "My Account" column.
// Used to sign out and to check whether the visitor is logged in or out.

const { expect } = require('@playwright/test');

class AccountMenu {
  constructor(page) {
    this.page = page;

    // Header. Logged in, the member menu (ul.menu_links) is in the page and opens on hover.
    // Logged out, the Sign in / Register items only render after the icon is clicked.
    this.headerIcon = page.locator('a.icon_myaccount[aria-label="My Account"]');
    this.headerMemberMenu = page.locator('ul.menu_links');
    this.headerSignInButton = page.locator('.dropdown-item button', { hasText: 'Sign in to Account' });
    this.headerRegisterButton = page.locator('.dropdown-item button', { hasText: 'Register' });

    // Footer: the link list right after the "My Account" heading.
    this.footerLinks = page.locator('footer .sitemap_left h3:text-is("My Account") + .product_links');
  }

  async openGuestMenu() {
    await this.headerIcon.click();
  }

  async signOutViaHeader() {
    await this.headerIcon.hover();
    await this.headerMemberMenu.getByText('Sign Out', { exact: true }).click();
  }

  async signOutViaFooter() {
    await this.footerLinks.getByText('Sign Out', { exact: true }).click();
  }

  async expectLoggedIn() {
    await this.headerIcon.hover();
    for (const item of ['Profile', 'My Orders', 'Sign Out']) {
      await expect(this.headerMemberMenu.getByText(item, { exact: true })).toBeVisible({ timeout: 20_000 });
    }

    await expect(this.footerLinks.getByText('Sign Out', { exact: true })).toBeVisible();
    await expect(this.footerLinks.getByText('Sign In', { exact: true })).toHaveCount(0);
  }

  async expectLoggedOut() {
    // Header: the member menu is gone; the icon offers Sign in / Register again.
    await expect(this.headerMemberMenu).toHaveCount(0, { timeout: 20_000 });
    await this.openGuestMenu();
    await expect(this.headerSignInButton).toBeVisible();
    await expect(this.headerRegisterButton).toBeVisible();

    // Footer: My Account shows Sign In / Register instead of the member links.
    await expect(this.footerLinks.getByText('Sign In', { exact: true })).toBeVisible();
    await expect(this.footerLinks.getByText('Register', { exact: true })).toBeVisible();
    await expect(this.footerLinks.getByText('Sign Out', { exact: true })).toHaveCount(0);
    await expect(this.footerLinks.getByText('My Orders', { exact: true })).toHaveCount(0);
  }
}

module.exports = { AccountMenu };
