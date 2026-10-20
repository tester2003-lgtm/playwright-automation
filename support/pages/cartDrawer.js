// Page object for the header cart: the cart icon with its item count, and the cart drawer
// that slides open from it (layouts/templates/Header.vue + components/cart/Cart2.vue in the
// storefront repo, ../Frontend). Changing a quantity is PATCH cart-items/update/{id};
// deleting is DELETE cart-items/delete/{id}.

const { expect } = require('@playwright/test');

const EMPTY_CART_MESSAGE = 'There are no items in the cart.';

// "S$1,234.50" → 1234.5
const toNumber = (text) => Number(text.replace(/[^\d.]/g, ''));

class CartDrawer {
  constructor(page) {
    this.page = page;
    this.cartIcon = page.locator('#view_cart_item');
    this.itemCount = this.cartIcon.locator('.cart_number');
    this.drawer = page.locator('.cart_dropdown.active');
    this.items = this.drawer.locator('figure.cart_drop_item:not(.no_cart_items)');
    this.emptyMessage = this.drawer.locator('.no_cart_items');
    this.addedToast = this.drawer.locator('.cart_drop_toast');
    this.subtotal = this.drawer.locator('.cart_drop_fees li', { hasText: 'Subtotal' }).locator('span');
    this.viewCartButton = this.drawer.locator('.cart_drop_buttons').getByRole('button', { name: /^View Cart/ });
    this.checkoutButton = this.drawer.locator('.cart_drop_buttons').getByRole('button', { name: 'Checkout', exact: true });
    // "Delete this item?" box that opens next to the item's delete icon.
    this.deleteConfirm = this.drawer.locator('.custom_popover').filter({ visible: true });
    // Guests get a "Sign In" box first, with a link to carry on without an account.
    this.continueAsGuestLink = page.locator('a.nonm_link', { hasText: 'Continue as guest' });
  }

  item(productName) {
    return this.items.filter({ has: this.page.locator('.h5_heading', { hasText: productName }) });
  }

  price(item) {
    return item.locator('.cart_drop_price');
  }

  quantity(item) {
    return item.locator('.dropdown_quantity p');
  }

  async open() {
    await this.cartIcon.click();
    await expect(this.drawer).toBeVisible();
  }

  // The icon's count, the number of items listed, and the "View Cart (n)" button all agree.
  async expectItemCount(count) {
    await expect(this.itemCount).toHaveText(String(count), { timeout: 20_000 });
    await expect(this.items).toHaveCount(count);
    await expect(this.viewCartButton).toHaveText(`View Cart (${count})`);
  }

  async expectEmpty() {
    await expect(this.itemCount).toHaveText('0', { timeout: 20_000 });
    await expect(this.emptyMessage).toBeVisible();
    await expect(this.emptyMessage).toContainText(EMPTY_CART_MESSAGE);
    await expect(this.items).toHaveCount(0);
  }

  // The Subtotal equals the sum of the item prices. It updates a moment after the items do,
  // so this keeps checking until they match (or times out).
  async expectSubtotalMatchesItems() {
    await expect
      .poll(
        async () => {
          const prices = await this.items.locator('.cart_drop_price').allInnerTexts();
          const subtotal = await this.subtotal.innerText();
          const sum = prices.reduce((total, price) => total + toNumber(price), 0);
          return prices.length > 0 && Math.abs(toNumber(subtotal) - sum) < 0.001;
        },
        { message: 'Subtotal should equal the sum of the item prices', timeout: 20_000 },
      )
      .toBe(true);
  }

  // Edit → pick the quantity from the list, and wait for the server to save it.
  async changeQuantity(item, quantity) {
    await item.locator('.dropdown_quantity').getByRole('button', { name: 'Edit' }).click();
    const saved = this.page.waitForResponse(
      (res) => res.url().includes('cart-items/update/') && res.request().method() === 'PATCH',
    );
    await item
      .locator('.app-dropdown-list button.app-dropdown__button')
      .filter({ hasText: new RegExp(`^\\s*${quantity}\\s*$`) })
      .click();
    const body = await (await saved).json();
    expect(body.status, 'quantity change (PATCH cart-items/update)').toBe('SUCCESS');
    await expect(this.quantity(item)).toHaveText(`Quantity : ${quantity}`);
  }

  // Clicks the item's delete icon; the confirmation box opens.
  async askToDelete(item) {
    await item.locator('a.cart2_delete').click();
    await expect(this.deleteConfirm).toBeVisible();
  }

  async confirmDelete() {
    await this.deleteConfirm.locator('a', { hasText: 'Yes, Delete Item' }).click();
  }

  async keepItem() {
    await this.deleteConfirm.locator('a', { hasText: 'No, Keep Item' }).click();
  }

  async deleteItem(item) {
    await this.askToDelete(item);
    await this.confirmDelete();
  }
}

module.exports = { CartDrawer, EMPTY_CART_MESSAGE };
