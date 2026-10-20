// Navigation & general — Top menu: the STICKERS, BUSINESS CARD and BADGES & MAGNETS
// dropdowns, and the GET SAMPLES link.
// Migrated from cypress/e2e/navigation/top-menu.cy.js.
// Run: npx playwright test navigation/top-menu.spec.js
//
// The product lists below mirror the live menu (Oct 2026). Update them when the catalogue
// changes — a failure here means a product was added, removed, renamed or re-linked.
// Each product maps to the page its link opens (the site adds a ?featured=... query on top).

const { test, expect } = require('@playwright/test');
const { TopMenu } = require('../support/pages/topMenu');
const { expectImageLoaded } = require('../support/assertions');

const DROPDOWNS = [
  {
    menu: 'STICKERS',
    viewAll: '/custom/stickers',
    tabs: [
      {
        tab: 'Paper Based',
        products: {
          'Art Paper': '/stickers/paper/art',
          'Classic Paper': '/stickers/paper/classic',
          'Kraft Paper': '/stickers/paper/kraft',
        },
      },
      {
        tab: 'Vinyl Based',
        products: {
          Bumper: '/stickers/vinyl/bumper',
          'Standard Vinyl': '/stickers/vinyl/standard',
          PVC: '/stickers/vinyl/pvc',
          Transparent: '/stickers/vinyl/transparent',
          'Gold Vinyl': '/stickers/vinyl/gold',
          'Silver Vinyl': '/stickers/vinyl/silver',
          'Custom Decals': '/stickers/vinyl/custom-decals',
          'Vinyl Lettering': '/stickers/vinyl/vinyl-lettering',
        },
      },
      {
        tab: 'Special Stickers',
        products: {
          'Foil Paper': '/stickers/special/foil',
          Hologram: '/stickers/special/hologram',
          'Embossed Paper': '/stickers/special/embossed',
          Dome: '/stickers/special/dome',
        },
      },
      {
        tab: 'Supply',
        products: {
          'Die Cut': '/stickers/die-cut',
          'Kiss Cut': '/stickers/kiss-cut',
          Sheet: '/stickers/sheet',
          Roll: '/stickers/roll',
        },
      },
    ],
    clickThrough: { product: 'Art Paper', heading: /Art Paper/i },
  },
  {
    menu: 'BUSINESS CARD',
    viewAll: '/business-cards',
    tabs: [
      {
        tab: 'Type',
        products: {
          Standard: '/business-cards/standard-business-card',
          Premium: '/business-cards/premium-business-card',
          'Hang Tags': '/hang-tags',
        },
      },
      {
        tab: 'Material',
        // Paper stocks, not products you can buy on their own — the site shows no price
        // for this tab (isPriceAvailable() in NavigationItemList2.vue).
        showsPrice: false,
        products: {
          'Standard Matte 250gsm': '/business-cards/standard-matte-250gsm',
          'Royal Extra White 400gsm': '/business-cards/royal-extra-white-400gsm',
          'Vintage Kraft 300gsm': '/business-cards/vintage-kraft-300gsm',
        },
      },
    ],
    clickThrough: { product: 'Premium', heading: /Premium/i },
  },
  {
    menu: 'BADGES & MAGNETS',
    viewAll: '/badges-and-magnets',
    tabs: [
      {
        tab: 'Badges',
        products: {
          'Button Badges': '/badges/button-badge',
          'Mirror Badges': '/badges/mirror-badge',
          'Magnetic Badges': '/badges/magnetic-badge',
        },
      },
      { tab: 'Magnets', products: { 'Custom Magnets': '/magnets/custom-magnet' } },
    ],
    clickThrough: { product: 'Button Badges', heading: /Button Badge/i },
  },
];

const ALL_PRODUCT_COUNT = DROPDOWNS.flatMap((d) => d.tabs).reduce(
  (sum, t) => sum + Object.keys(t.products).length,
  0,
);

// "starts at S$9", "starts at S$1,200" — the amount itself comes from the server.
const STARTING_PRICE = /^starts at S\$\d[\d,]*$/;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Matches a link to `path`, with or without a query string after it.
const linkTo = (path) => new RegExp(`^${escapeRegExp(path)}(\\?|$)`);
const urlOf = (path) => new RegExp(`${escapeRegExp(path)}(\\?|$)`);

test.describe('Navigation & general - Top menu', () => {
  let menu;

  test.beforeEach(async ({ page }) => {
    menu = new TopMenu(page);
    await menu.goto();
  });

  for (const { menu: name, viewAll, tabs, clickThrough } of DROPDOWNS) {
    test.describe(name, () => {
      test('opens a dropdown with its tabs, the first one selected, and a View All link', async () => {
        await menu.open(name);

        await expect(menu.tabs).toHaveText([...tabs.map((t) => t.tab), 'View All']);
        await expect(menu.tab(tabs[0].tab)).toContainClass('active');
        await expect(menu.viewAllLink).toHaveAttribute('href', viewAll);
      });

      test('lists the expected products under each tab, each linking to its product page', async () => {
        await menu.open(name);

        for (const { tab, products } of tabs) {
          await test.step(tab, async () => {
            await menu.selectTab(tab);
            await expect(menu.productNames).toHaveText(Object.keys(products));
            for (const [product, path] of Object.entries(products)) {
              await expect(menu.product(product), `${product} link`).toHaveAttribute('href', linkTo(path));
            }
          });
        }
      });

      test('shows a starting price for each product', async () => {
        await menu.open(name);

        for (const { tab, products, showsPrice = true } of tabs) {
          await test.step(showsPrice ? tab : `${tab} (no prices)`, async () => {
            await menu.selectTab(tab);
            for (const product of Object.keys(products)) {
              const price = menu.product(product).locator('small');
              if (showsPrice) await expect(price, `${product} price`).toHaveText(STARTING_PRICE);
              else await expect(price, `${product} should show no price`).toHaveCount(0);
            }
          });
        }
      });

      test('shows a loaded thumbnail image for each product', async () => {
        await menu.open(name);

        for (const { tab, products } of tabs) {
          await test.step(tab, async () => {
            await menu.selectTab(tab);
            for (const product of Object.keys(products)) {
              await expectImageLoaded(
                menu.product(product).locator('figure img'),
                `${product} thumbnail should have loaded`,
              );
            }
          });
        }
      });

      test(`opens the ${clickThrough.product} page and closes the dropdown when the product is clicked`, async ({ page }) => {
        const path = tabs.find((t) => clickThrough.product in t.products).products[clickThrough.product];
        await menu.open(name);

        await menu.product(clickThrough.product).click();

        await expect(page).toHaveURL(urlOf(path), { timeout: 30_000 });
        await expect(page.locator('h1', { hasText: clickThrough.heading }).first()).toBeVisible({ timeout: 30_000 });
        await menu.expectClosed();
      });

      test('closes the dropdown with the close (X) button', async () => {
        await menu.open(name);

        await menu.close();

        await menu.expectClosed();
        await expect(menu.link(name)).not.toContainClass('active');
      });
    });
  }

  test('switches the dropdown to the other menu when another menu item is clicked', async () => {
    await menu.open('STICKERS');
    await expect(menu.tabs).toHaveText(['Paper Based', 'Vinyl Based', 'Special Stickers', 'Supply', 'View All']);

    await menu.open('BUSINESS CARD');

    await expect(menu.link('STICKERS')).not.toContainClass('active');
    await expect(menu.tabs).toHaveText(['Type', 'Material', 'View All']);
    await expect(menu.viewAllLink).toHaveAttribute('href', '/business-cards');
  });

  test('GET SAMPLES has no dropdown and opens the sample pack page', async ({ page }) => {
    await expect(menu.link('GET SAMPLES')).toHaveAttribute('href', '/sample-pack');

    await menu.link('GET SAMPLES').click();

    await expect(page).toHaveURL(urlOf('/sample-pack'), { timeout: 30_000 });
    await expect(page.locator('h1', { hasText: 'Sticker Sample Pack' })).toBeVisible({ timeout: 30_000 });
    await menu.expectClosed();
  });

  // Checks every link in the menu over HTTP instead of clicking each one through the UI.
  // The site answers 200 for a real page and 404/500 for a broken link.
  test('every link in the menu opens a working page (HTTP 200)', async ({ request }) => {
    await expect(menu.allProducts).toHaveCount(ALL_PRODUCT_COUNT);
    const links = [
      ...(await menu.allProducts.evaluateAll((as) => as.map((a) => a.getAttribute('href')))),
      ...DROPDOWNS.map((d) => d.viewAll),
      '/sample-pack',
    ];

    const statuses = await Promise.all(links.map(async (link) => [link, (await request.get(link)).status()]));

    for (const [link, status] of statuses) {
      expect.soft(status, `${link} should respond 200`).toBe(200);
    }
  });
});
