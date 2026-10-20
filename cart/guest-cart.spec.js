// Cart — guest (not logged in): empty cart, adding items and the cart count, editing the
// quantity, and deleting items (Yes / No).
// Migrated from the "Guest" half of cypress/e2e/cart/cart.cy.js (the member half is
// cart/member-cart.spec.js).
// Run: npx playwright test cart/guest-cart.spec.js
//
// Runs in the "public" project (guest-*.spec.js): every test is a new guest with an empty cart.
// Writes to dev: guest cart items. No order is placed.

const { test, expect } = require('@playwright/test');
const { ProductPage } = require('../support/pages/productPage');
const { CartDrawer } = require('../support/pages/cartDrawer');

const ART_PAPER = { name: 'Art Paper Stickers', path: '/stickers/paper/art' };
const CLASSIC_PAPER = { name: 'Classic Paper Stickers', path: '/stickers/paper/classic' };
const KRAFT_PAPER = { name: 'Kraft Paper Stickers', path: '/stickers/paper/kraft' };
const PRICE = /^S\$[\d,]+\.\d{2}$/;

test.describe('Cart - guest', () => {
  /** @type {ProductPage} */
  let product;
  /** @type {CartDrawer} */
  let cart;

  test.beforeEach(async ({ page }) => {
    product = new ProductPage(page);
    cart = new CartDrawer(page);
  });

  test('shows the empty-cart message for a new visitor', async ({ page }) => {
    await page.goto('/');
    await expect(cart.itemCount).toHaveText('0');

    await cart.open();

    await cart.expectEmpty();
  });

  test.describe('Add to cart', () => {
    test('adds one product and the cart count becomes 1', async () => {
      await product.addWithDefaultOptions(ART_PAPER);

      await cart.expectItemCount(1);
      await expect(cart.addedToast).toContainText('Item added to Cart');
      const item = cart.item(ART_PAPER.name);
      await expect(item).toContainText('Quantity : ');
      await expect(cart.price(item)).toHaveText(PRICE);
      await cart.expectSubtotalMatchesItems();
    });

    test('adds several products and the count goes up with each one', async () => {
      await test.step(`adds ${ART_PAPER.name}: count 1`, async () => {
        await product.addWithDefaultOptions(ART_PAPER);
        await cart.expectItemCount(1);
      });

      await test.step(`adds ${CLASSIC_PAPER.name}: count 2`, async () => {
        await product.addWithDefaultOptions(CLASSIC_PAPER);
        await cart.expectItemCount(2);
      });

      await test.step(`adds ${KRAFT_PAPER.name}: count 3`, async () => {
        await product.addWithDefaultOptions(KRAFT_PAPER);
        await cart.expectItemCount(3);
      });

      await test.step('all three are listed and the subtotal adds up', async () => {
        for (const { name } of [ART_PAPER, CLASSIC_PAPER, KRAFT_PAPER]) {
          await expect(cart.item(name)).toHaveCount(1);
        }
        await cart.expectSubtotalMatchesItems();
      });
    });

    test('keeps the cart after a page reload', async ({ page }) => {
      await product.addWithDefaultOptions(ART_PAPER);
      await product.addWithDefaultOptions(CLASSIC_PAPER);

      await page.reload();

      await expect(cart.itemCount).toHaveText('2', { timeout: 20_000 });
      await cart.open();
      await cart.expectItemCount(2);
    });
  });

  test('changes the quantity of an item and the price updates', async () => {
    const price = await product.addWithDefaultOptions(ART_PAPER);
    const item = cart.item(ART_PAPER.name);

    await cart.changeQuantity(item, '200');

    await expect(cart.price(item)).toHaveText(PRICE);
    await expect(cart.price(item)).not.toHaveText(price);
    // Still one item: editing doesn't add a new line.
    await cart.expectItemCount(1);
    await cart.expectSubtotalMatchesItems();
  });

  test.describe('Delete item', () => {
    test('"No, Keep Item" keeps the item in the cart', async () => {
      await product.addWithDefaultOptions(ART_PAPER);
      const item = cart.item(ART_PAPER.name);

      await cart.askToDelete(item);
      await expect(cart.deleteConfirm).toContainText('Confirmation');
      await expect(cart.deleteConfirm).toContainText('Are you sure you want to delete this item in your cart?');
      await cart.keepItem();

      await expect(cart.deleteConfirm).toHaveCount(0);
      await expect(item).toHaveCount(1);
      await cart.expectItemCount(1);
    });

    test('"Yes, Delete Item" removes the item and shows the empty cart, also after a reload', async ({ page }) => {
      await product.addWithDefaultOptions(ART_PAPER);

      await cart.deleteItem(cart.item(ART_PAPER.name));

      await cart.expectEmpty();
      await page.reload();
      await cart.open();
      await cart.expectEmpty();
    });

    test('deletes only the chosen item when there are several', async () => {
      await product.addWithDefaultOptions(ART_PAPER);
      await product.addWithDefaultOptions(CLASSIC_PAPER);
      await cart.expectItemCount(2);

      await cart.deleteItem(cart.item(ART_PAPER.name));

      await cart.expectItemCount(1);
      await expect(cart.item(ART_PAPER.name)).toHaveCount(0);
      await expect(cart.item(CLASSIC_PAPER.name)).toHaveCount(1);
      await cart.expectSubtotalMatchesItems();
    });
  });
});
