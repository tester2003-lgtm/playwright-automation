// Navigation & general — Homepage loads (banner, menu, footer).
// Migrated from cypress/e2e/navigation/homepage.cy.js.
// Run: npx playwright test navigation/homepage.spec.js
// baseURL comes from playwright.config.js (BASE_URL in .env).

const { test, expect } = require('@playwright/test');
const { expectImageLoaded } = require('../support/assertions');

const NAV_LINKS = [
  { text: 'STICKERS' },
  { text: 'BUSINESS CARD' },
  { text: 'BADGES & MAGNETS' },
  { text: 'GET SAMPLES', href: '/sample-pack' },
];

const BANNER_USPS = [
  'Lowest Price Guarantee',
  'Free Shipping Singapore Wide',
  'Fast Turnaround Time',
];

const FOOTER_HEADINGS = ['My Account', 'Support', 'User Guide', 'Tools', 'Products'];

const FOOTER_LEGAL_LINKS = [
  { text: 'Terms of Service', href: '/terms-and-condition' },
  { text: 'Privacy Policy', href: '/privacy-policy' },
  { text: 'Site Map', href: '/sitemap' },
];

test.describe('Navigation & general - Homepage', () => {
  test('responds with HTTP 200 and has the expected page title', async ({ page, request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);

    await page.goto('/');
    await expect(page).toHaveTitle(/Sticker Printing/);
  });

  test('shows the header menu: logo, nav links, search, account and cart', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header.header--');
    await expect(header).toBeVisible();

    const logo = header.locator('a.logo_holder');
    await expect(logo).toHaveAttribute('href', '/');
    const logoImg = logo.locator('img[alt="SingaPrinting"]');
    await expect(logoImg).toBeVisible();
    await expectImageLoaded(logoImg);

    await expect(header.locator('nav.nav_menu')).toBeVisible();
    for (const { text, href } of NAV_LINKS) {
      const link = header.locator('nav.nav_menu a.nav_link', { hasText: text }).first();
      await expect(link).toBeVisible();
      if (href) await expect(link).toHaveAttribute('href', href);
    }

    await expect(header.locator('a.icon_search[aria-label="Search"]')).toBeVisible();
    await expect(header.locator('a.icon_myaccount[aria-label="My Account"]')).toBeVisible();
    await expect(header.locator('#view_cart_item[aria-label="View Cart"]')).toBeVisible();
  });

  // Slides change with promotions (text templates, image-only sale banners, ...), so this
  // only checks that the hero banner is displaying something — a visible slide, whatever it is.
  test('shows the hero banner with a slide displayed', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('section.banner_container')).toBeVisible();
    await expect(page.locator('.banner_container .carousel_item.active')).toBeVisible();

    for (const usp of BANNER_USPS) {
      await expect(page.locator('.banner_bottom .bnr_content_title', { hasText: usp })).toBeVisible();
    }
  });

  test('shows the footer: logo, contact details, sitemap sections and legal links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer.footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();

    const footerLogo = footer.locator('.logo_container img[alt="SingaPrinting"]');
    await expect(footerLogo).toBeVisible();
    await expectImageLoaded(footerLogo);

    const address = footer.locator('.address_container');
    await expect(address).toContainText('+65 3158 2800');
    await expect(address).toContainText('Singapore 486066');
    await expect(footer.locator('.address_container a[href="mailto:info@singaprinting.com"]')).toBeVisible();

    for (const heading of FOOTER_HEADINGS) {
      await expect(footer.locator('.sitemap h3', { hasText: heading })).toBeVisible();
    }
    expect(await footer.locator('.sitemap .product_links a').count()).toBeGreaterThanOrEqual(10);

    const copyright = footer.locator('.copyright');
    await expect(copyright).toContainText('GLOPHICS LIMITED');
    await expect(copyright).toContainText('All Rights Reserved');
    for (const { text, href } of FOOTER_LEGAL_LINKS) {
      await expect(footer.locator('.copyright_links a', { hasText: text })).toHaveAttribute('href', href);
    }
  });
});
