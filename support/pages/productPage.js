// Page object for a product page with the price calculator, e.g. /stickers/paper/art.
// Based on pages/stickers/_featuredItem/_product.vue and components/quote/banner/StickersV2.vue
// in the storefront repo (../Frontend). Add to Cart is POST cart-items/create.

const { expect } = require('@playwright/test');
const { ArtworkUploadModal } = require('./artworkUploadModal');

// A real price: "S$22.00". While loading, the page shows "S$0.00".
const LOADED_PRICE = /^S\$[1-9][\d,]*\.\d{2}$/;

class ProductPage {
  constructor(page) {
    this.page = page;
    this.title = page.locator('h1.quote_title');
    this.price = page.locator('.quote_footer_price h2').first();
    this.addToCartButton = page.locator('.quote_footer_btns').getByRole('button', { name: 'Add to Cart' });
    this.artworkModal = new ArtworkUploadModal(page);
  }

  async goto(path) {
    await this.page.goto(path);
    // The page is server-rendered: its buttons do nothing until the Nuxt app has mounted.
    await this.page.waitForFunction(() => window.$nuxt && window.$nuxt._isMounted);
  }

  // Waits until the calculator shows a real price, and returns it ("S$22.00").
  async loadedPrice() {
    await expect(this.price).toHaveText(LOADED_PRICE, { timeout: 30_000 });
    return (await this.price.innerText()).trim();
  }

  // Clicks Add to Cart (it stays disabled until the price has loaded) and waits for the server
  // to add the item. The "Upload Artwork" window opens next.
  async addToCart() {
    const added = this.page.waitForResponse(
      (res) => res.url().includes('cart-items/create') && res.request().method() === 'POST',
    );
    await this.addToCartButton.click();
    const body = await (await added).json();
    expect(body.status, `Add to Cart (POST cart-items/create): ${body.message}`).toBe('SUCCESS');
    await this.artworkModal.expectOpen();
  }

  // Opens `product` ({ name, path }), adds it with the page's default options and skips the
  // artwork upload. Returns the price shown on the product page.
  async addWithDefaultOptions(product) {
    await this.goto(product.path);
    await expect(this.title).toContainText(product.name);
    const price = await this.loadedPrice();
    await this.addToCart();
    await this.artworkModal.skip();
    return price;
  }
}

module.exports = { ProductPage, LOADED_PRICE };
