// Page object for the cart page (/cart): one row per cart item, with its own
// "Upload Artwork" button. Based on pages/cart/index.vue + components/cart/CartItems.vue in the
// storefront repo (../Frontend).

const { expect } = require('@playwright/test');
const { ArtworkUploadModal } = require('./artworkUploadModal');
const { expectImageLoaded } = require('../assertions');

class CartPage {
  constructor(page) {
    this.page = page;
    this.rows = page.locator('.cart_table_list');
    this.artworkModal = new ArtworkUploadModal(page);
  }

  // The cart item row that mentions `text` (product name, artwork file name, ...).
  row(text) {
    return this.rows.filter({ hasText: text });
  }

  async goto() {
    await this.page.goto('/cart');
    await this.page.waitForFunction(() => window.$nuxt && window.$nuxt._isMounted);
  }

  async expectOnCartPage() {
    // The address carries a ?key=… after /cart, so only the path is checked.
    await expect(this.page).toHaveURL((url) => url.pathname === '/cart', { timeout: 30_000 });
  }

  async openArtworkUpload(row) {
    await row.getByRole('button', { name: 'Upload Artwork' }).click();
    await this.artworkModal.expectOpen();
  }

  // The row shows the uploaded artwork (a thumbnail that actually loaded, and its file name)
  // and the special instruction.
  async expectArtworkAttached(row, { fileName, instruction }) {
    await expectImageLoaded(row.locator('figure.cart_image.fileUpload img'), 'uploaded artwork thumbnail should load');
    await expect(row.locator('.cart_drop_attach')).toContainText(fileName);
    await expect(row.locator('.text_edit')).toContainText(instruction);
  }
}

module.exports = { CartPage };
