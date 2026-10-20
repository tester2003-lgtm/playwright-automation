// Page object for the "Upload Artwork" window. It opens after Add to Cart (where it can be
// skipped) and from a cart item's "Upload Artwork" button on the cart page.
// Based on components/quote/modals/SubmitArtwork.vue in the storefront repo (../Frontend);
// the upload is POST cart/create/artwork.
//
// The page holds a second, hidden copy of this window, so everything is found inside the open
// one (.up_artwork_modal.active).

const { expect } = require('@playwright/test');

class ArtworkUploadModal {
  constructor(page) {
    this.page = page;
    this.modal = page.locator('.up_artwork_modal.active');
    this.skipLink = this.modal.locator('a.high_text', { hasText: 'Skip' });
    this.dropZone = this.modal.locator('label.button-upload-full');
    this.fileInput = this.modal.locator('input[type="file"]');
    this.instructionBox = this.modal.locator('textarea');
    this.uploadButton = this.modal.getByRole('button', { name: 'Upload Artwork' });
  }

  async expectOpen() {
    await expect(this.modal).toBeVisible({ timeout: 20_000 });
    await expect(this.dropZone).toContainText('Drag and drop');
  }

  async skip() {
    await this.skipLink.click();
    await expect(this.modal).toHaveCount(0);
  }

  // Chooses the file, types the instruction, clicks Upload Artwork and waits for the server to
  // accept the upload.
  async upload({ file, fileName, instruction }) {
    await this.fileInput.setInputFiles(file);
    await expect(this.modal).toContainText(fileName);
    await this.instructionBox.fill(instruction);
    await expect(this.instructionBox).toHaveValue(instruction);

    const uploaded = this.page.waitForResponse(
      (res) => res.url().includes('cart/create/artwork') && res.request().method() === 'POST',
      { timeout: 60_000 },
    );
    await this.uploadButton.click();
    const body = await (await uploaded).json();
    expect(body.status, 'artwork upload (POST cart/create/artwork)').toBe('SUCCESS');
    await expect(this.modal).toHaveCount(0);
  }
}

module.exports = { ArtworkUploadModal };
