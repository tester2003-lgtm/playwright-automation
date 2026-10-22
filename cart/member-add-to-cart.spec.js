// Cart — Add to cart as a logged-in member: add Art Paper Stickers, change the quantity, open
// the cart page, upload artwork with a special instruction, then check the cart is kept on the
// account (seen again after logging in from another browser).
// Migrated from cypress/e2e/cart/member-add-to-cart.cy.js.
// Run: npx playwright test cart/member-add-to-cart.spec.js
//
// Runs in the "customer" project (files named member-*.spec.js): starts logged in with the
// saved member session (support/setup/member.setup.js) — the login form is tested in auth/.
// The member's cart is emptied through the API before and after the test (rule 4: no UI for
// setup), so leftovers from earlier runs can't affect it and none are left behind.
// Writes to dev: a cart item on the member account (removed afterwards) and the artwork file
// uploaded to the dev site's storage. No order is placed.

const { test, expect, devices } = require('@playwright/test');
const path = require('path');
const { ProductPage } = require('../support/pages/productPage');
const { CartDrawer } = require('../support/pages/cartDrawer');
const { CartPage } = require('../support/pages/cartPage');
const { TEST_FILES } = require('../support/testData');
const { customerApi, cartItemCount, emptyCart } = require('../support/api');
const { loginAsMember } = require('../support/auth');

const PRODUCT = { name: 'Art Paper Stickers', path: '/stickers/paper/art' };
const NEW_QUANTITY = '200';
const ARTWORK = {
  file: TEST_FILES.images[0],
  fileName: path.basename(TEST_FILES.images[0]), // Test-image-1.png
  // Kept short: the cart page cuts long instructions off with "...".
  instruction: 'FOR TESTING PURPOSES ONLY',
};
const PRICE = /^S\$[\d,]+\.\d{2}$/;

test.describe('Add to cart as a member', () => {
  let api;

  test.beforeEach(async ({ context }) => {
    api = await customerApi(context);
    await emptyCart(api);
    expect(await cartItemCount(api), 'member cart is empty before the test').toBe(0);
  });

  test.afterEach(async () => {
    await emptyCart(api);
    await api.dispose();
  });

  test('add an item, change its quantity and upload artwork; the cart is kept on the account', async ({ page, browser, baseURL }) => {
    const product = new ProductPage(page);
    const cart = new CartDrawer(page);
    const cartPage = new CartPage(page);
    let productPrice;

    await test.step(`opens ${PRODUCT.name} and waits for the price`, async () => {
      await product.goto(PRODUCT.path);
      await expect(product.title).toContainText(PRODUCT.name);
      productPrice = await product.loadedPrice();
    });

    await test.step('clicks Add to Cart and skips the artwork upload for now', async () => {
      await product.addToCart();
      await product.artworkModal.skip();
    });

    await test.step('sees 1 item in the cart, at the price shown on the product page', async () => {
      await expect(cart.itemCount).toHaveText('1');
      await expect(cart.items).toHaveCount(1);
      await expect(cart.item(PRODUCT.name)).toHaveCount(1);
      await expect(cart.price(cart.item(PRODUCT.name))).toHaveText(productPrice);
    });

    await test.step(`changes the quantity to ${NEW_QUANTITY} and the price updates`, async () => {
      const item = cart.item(PRODUCT.name);
      await cart.changeQuantity(item, NEW_QUANTITY);
      await expect(cart.price(item)).toHaveText(PRICE);
      await expect(cart.price(item)).not.toHaveText(productPrice);
    });

    await test.step('opens the cart page straight away (no guest sign-in box)', async () => {
      await cart.viewCartButton.click();
      await cartPage.expectOnCartPage();
      await expect(cart.continueAsGuestLink).toHaveCount(0);
      await expect(cartPage.row(PRODUCT.name)).toContainText(`Quantity : ${NEW_QUANTITY}`);
    });

    await test.step('uploads artwork with a special instruction', async () => {
      await cartPage.openArtworkUpload(cartPage.row(PRODUCT.name));
      await cartPage.artworkModal.upload(ARTWORK);
    });

    await test.step('sees the artwork and the instruction on the cart item', async () => {
      await cartPage.expectArtworkAttached(cartPage.row(PRODUCT.name), ARTWORK);
    });

    // Like opening the site on another computer: a new browser with nothing saved, logged in
    // with its own new session (the shared saved session is not touched or signed out).
    await test.step('logs in from another browser and finds the same single item, with its changes', async () => {
      const otherContext = await browser.newContext({ ...devices['Desktop Chrome'], baseURL });
      try {
        const otherPage = await otherContext.newPage();
        await loginAsMember(otherPage);

        // Only the item this test added. Cypress saw an extra, unedited copy (quantity 100, no
        // artwork) in ~2 of 16 runs in Oct 2026 — if this fails with 2, report it.
        const otherApi = await customerApi(otherContext);
        try {
          expect(await cartItemCount(otherApi), 'items in the member cart').toBe(1);
        } finally {
          await otherApi.dispose();
        }

        const otherCartPage = new CartPage(otherPage);
        await otherCartPage.goto();
        const row = otherCartPage.row(ARTWORK.fileName);
        await expect(row).toContainText(PRODUCT.name, { timeout: 30_000 });
        await expect(row).toContainText(`Quantity : ${NEW_QUANTITY}`);
        await expect(row.locator('.text_edit')).toContainText(ARTWORK.instruction);
      } finally {
        await otherContext.close();
      }
    });
  });
});
