// Page object for the desktop top menu in the header (nav.nav_menu):
//   - STICKERS, BUSINESS CARD and BADGES & MAGNETS each open the same dropdown
//     (NavigationModal), filled with that menu's tabs and products;
//   - GET SAMPLES is a plain link to /sample-pack.
// Based on layouts/templates/Header.vue and components/nav/NavigationModal.vue +
// NavigationItemList2.vue in the storefront repo (../Frontend).

const { expect } = require('@playwright/test');

class TopMenu {
  constructor(page) {
    this.page = page;
    this.nav = page.locator('header nav.nav_menu');

    // The dropdown container has zero height (the panel inside is absolutely positioned),
    // so Playwright always sees the container itself as hidden. Check the tab row instead:
    // it is visible only while the dropdown is open.
    this.dropdown = page.locator('.nav_modal_container');
    this.tabRow = this.dropdown.locator('.nav_head');
    this.tabs = this.tabRow.locator('a');
    this.viewAllLink = this.tabRow.getByRole('link', { name: 'View All', exact: true });
    this.closeButton = this.dropdown.locator('a.modal_close');

    // Every product of every menu is always in the page; the ones outside the selected tab
    // are hidden (v-show). allProducts = all of them, products = only the ones on screen.
    this.allProducts = this.dropdown.locator('.nav_sec > a');
    this.products = this.allProducts.filter({ visible: true });
    this.productNames = this.products.locator('.nav_item_heading');
  }

  link(menu) {
    return this.nav.getByRole('link', { name: menu, exact: true });
  }

  tab(name) {
    return this.tabRow.getByRole('link', { name, exact: true });
  }

  // A product card currently on screen, found by its exact name.
  product(name) {
    return this.products.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  async goto() {
    await this.page.goto('/');
    // The menu links are href="javascript:;" and do nothing until the Nuxt app has mounted.
    await this.page.waitForFunction(() => window.$nuxt && window.$nuxt._isMounted);
    await expect(this.nav).toBeVisible();
  }

  async open(menu) {
    await this.link(menu).click();
    await expect(this.tabRow).toBeVisible();
    await expect(this.link(menu)).toContainClass('active');
  }

  async selectTab(name) {
    await this.tab(name).click();
    await expect(this.tab(name)).toContainClass('active');
  }

  async close() {
    await this.closeButton.click();
  }

  async expectClosed() {
    await expect(this.dropdown).not.toContainClass('visible');
    await expect(this.tabRow).toBeHidden();
  }
}

module.exports = { TopMenu };
