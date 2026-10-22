// Page object for the "Messages" panel of an order (/mypage/orders/<order id> → Messages).
// Based on components/mypage/modals/Orders/MessageNew.vue and components/messaging/MessagingLayout.vue
// in the storefront repo (../Frontend); sending is POST message/send (API MessagingController).
//
// Rules: a message needs text that isn't only spaces, or at least one file. Files: .doc .docx
// .xls .xlsx .ppt .pptx .csv .eps .ai .psd .pdf .tif .tiff .zip .png .jpg .jpeg, max 4 files /
// 50 MB total (checked in the browser; errors disappear after 4 seconds).
// ⚠ Every message sent emails the staff inbox (marketing@singaprinting.com on dev).

const { expect } = require('@playwright/test');

const MESSAGES = {
  required: 'Your message is required. Please try again.',
  unsupportedType: 'Upload failed. Unsupported filetype.',
  tooManyFiles: 'Maximum number of files exceeded. Only 4 files is allowed.',
  tooLarge: 'Maximum total file size exceeded. Only 50 MB total is allowed.',
};

const isSend = (req) => req.method() === 'POST' && /\/api\/message\/send(\?|$)/.test(req.url());

class OrderMessagesPanel {
  constructor(page) {
    this.page = page;
    // "Messages" link on the order page.
    this.messageButton = page.locator('a[aria-label="Send a message"]').first();

    // Sliding panel from the right, titled "Messages - #<order number>".
    this.panel = page.locator('.slider_container.slide_modal.active .message_slider');
    this.title = this.panel.locator('.slider_header h3');
    // "Create Message" (no messages yet), "Add Message" (last message was ours) or "Respond"
    // (last message was from staff).
    this.newMessageButton = this.panel.locator('.message-new__toggle button');

    this.form = this.panel.locator('form.message-new__form');
    this.input = this.form.locator('textarea.g-textarea-main');
    this.requiredError = this.form.locator('p.g-textarea-error');
    this.sendButton = this.form.getByRole('button', { name: 'Send Message' });
    this.cancelButton = this.form.getByRole('button', { name: 'Cancel' });

    // The big drop zone takes the first files; after that a smaller "Select Files" adds more,
    // until there are 4.
    this.fileInput = this.form.locator('.message-new__dropzone input[type="file"]');
    this.addMoreFilesButton = this.form.locator('label.message-new__select-more');
    this.addMoreFilesInput = this.addMoreFilesButton.locator('input[type="file"]');
    this.filePreviews = this.form.locator('.message-new__preview');
    this.removeFileButtons = this.form.getByRole('button', { name: 'Remove file' });
    this.fileError = this.form.locator('p.message-new__error');

    // Our messages; staff replies are .message-received.
    this.sentMessages = this.panel.locator('.messaging-layout .message-item.message-sent');
  }

  // The sent message containing `text` (each test tags its messages, so it's unique).
  sentMessage(text) {
    return this.sentMessages.filter({ hasText: text });
  }

  async gotoOrder(orderId) {
    await this.page.goto(`/mypage/orders/${orderId}`);
    await expect(this.messageButton).toBeVisible({ timeout: 30_000 });
  }

  async open(orderNumber) {
    await this.messageButton.click();
    await expect(this.panel).toBeVisible({ timeout: 20_000 });
    await expect(this.title).toHaveText(`Messages - #${orderNumber}`);
    await expect(this.newMessageButton).toBeVisible({ timeout: 20_000 });
  }

  // Opens a fresh, empty message form.
  async startNewMessage() {
    await this.newMessageButton.click();
    await expect(this.form).toBeVisible();
    await expect(this.input).toHaveValue('');
    await expect(this.filePreviews).toHaveCount(0);
  }

  async type(text) {
    await this.input.fill(text);
    await expect(this.input).toHaveValue(text);
  }

  // Records every "send message" request from now on; the returned list stays up to date.
  watchSends() {
    const sends = [];
    this.page.on('request', (req) => {
      if (isSend(req)) sends.push(req);
    });
    return sends;
  }

  // Clicks Send, waits for the server to accept the message, and returns its bubble.
  async send(tag) {
    const response = this.page.waitForResponse((res) => isSend(res.request()), { timeout: 60_000 });
    await this.sendButton.click();
    const body = await (await response).json();
    expect(body.status, `message accepted (POST message/send): ${JSON.stringify(body.message)}`).toBe('SUCCESS');
    await expect(this.form).toBeHidden();
    const message = this.sentMessage(tag);
    await expect(message).toHaveCount(1);
    await expect(message).not.toContainClass('message-pending');
    return message;
  }

  // Reloads the order page, reopens the panel and returns the message tagged `tag`.
  async reopenAfterReload(orderNumber, tag) {
    await this.page.reload();
    await expect(this.messageButton).toBeVisible({ timeout: 30_000 });
    await this.open(orderNumber);
    const message = this.sentMessage(tag);
    await expect(message).toHaveCount(1);
    return message;
  }

  // The message text as the customer sees it (line breaks as displayed).
  static async shownText(message) {
    const text = await message.locator('.message-content').innerText();
    return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  }
}

module.exports = { OrderMessagesPanel, MESSAGES };
