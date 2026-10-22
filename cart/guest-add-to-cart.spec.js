// Cart — Add to cart as a guest (not logged in): add Art Paper Stickers, change the quantity,
// open the cart page, and upload artwork with a special instruction.
// Migrated from cypress/e2e/cart/guest-add-to-cart.cy.js.
// Run: npx playwright test cart/guest-add-to-cart.spec.js
//
// Runs in the "public" project (files named guest-*.spec.js): a fresh browser, so a brand-new
// guest with an empty cart every run. Each step is a test.step(): the report shows which step
// failed, and the test stops there.
// Writes to dev: a guest cart item, and the artwork file uploaded to the dev site's storage.
// No order is placed.

const { test, expect } = require('@playwright/test');
const path = require('path');
const { ProductPage } = require('../support/pages/productPage');
const { CartDrawer } = require('../support/pages/cartDrawer');
const { CartPage } = require('../support/pages/cartPage');
const { TEST_FILES } = require('../support/testData');

const PRODUCT = { name: 'Art Paper Stickers', path: '/stickers/paper/art' };
const NEW_QUANTITY = '200';
const ARTWORK = {
  file: TEST_FILES.images[0],
  fileName: path.basename(TEST_FILES.images[0]), // Test-image-1.png
  // Kept short: the cart page cuts long instructions off with "...".
  instruction: 'FOR TESTING PURPOSES ONLY',
};
const PRICE = /^S\$[\d,]+\.\d{2}$/;

test('Add to cart as a guest: add an item, change its quantity and upload artwork', async ({ page }) => {
  const product = new ProductPage(page);
  const cart = new CartDrawer(page);
  const cartPage = new CartPage(page);
  let productPrice;
  let cartPrice;

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
    cartPrice = productPrice;
  });

  await test.step(`changes the quantity to ${NEW_QUANTITY} and the price updates`, async () => {
    const item = cart.item(PRODUCT.name);
    await cart.changeQuantity(item, NEW_QUANTITY);
    await expect(cart.price(item)).toHaveText(PRICE);
    await expect(cart.price(item)).not.toHaveText(cartPrice);
  });

  await test.step('opens the cart page, continuing as a guest', async () => {
    await cart.viewCartButton.click();
    await cart.continueAsGuestLink.click();
    await cartPage.expectOnCartPage();
    await expect(cartPage.row(PRODUCT.name)).toContainText(`Quantity : ${NEW_QUANTITY}`);
  });

  await test.step('uploads artwork with a special instruction', async () => {
    await cartPage.openArtworkUpload(cartPage.row(PRODUCT.name));
    await cartPage.artworkModal.upload(ARTWORK);
  });

  await test.step('sees the artwork and the instruction on the cart item', async () => {
    await cartPage.expectArtworkAttached(cartPage.row(PRODUCT.name), ARTWORK);
  });
});
