// Shared custom checks used by more than one spec.

const { expect } = require('@playwright/test');

// Assert an <img> actually loaded (naturalWidth > 0), not just that the element exists.
// Footer/below-the-fold images are lazy-loaded, so scroll it into view and poll until the
// bytes have arrived rather than checking once.
async function expectImageLoaded(locator, message = 'image should have loaded') {
  await locator.scrollIntoViewIfNeeded();
  await expect
    .poll(() => locator.evaluate((img) => img.naturalWidth), { message, timeout: 10_000 })
    .toBeGreaterThan(0);
}

module.exports = { expectImageLoaded };
