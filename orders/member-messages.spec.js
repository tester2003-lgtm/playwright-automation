// Customer messages on an order — a logged-in member opens My Orders, opens the newest order and
// its Messages panel, and writes messages: what is refused (nothing sent) and what is sent.
// Migrated from cypress/e2e/orders/customer-messages.cy.js.
// Run: npx playwright test orders/member-messages.spec.js
//
// Runs in the "customer" project (member-*.spec.js): starts logged in with the saved member
// session. The account needs at least one order (checkout/member-credit-card.spec.js makes them);
// the tests use the newest one. No order is placed.
// ⚠ Every run SENDS 6 REAL MESSAGES (tagged with the run id) to that order, and each one emails
// the staff inbox (marketing@singaprinting.com on dev). There is no clean-up: they stay in the
// order's conversation.
//
// Changed from Cypress: the HTML check uses harmless tags only (<b>, <u>). Cypress also sent a
// <script> tag; the API's attack detector can block this computer's IP for script-like text,
// so tests never send it (see CLAUDE.md "Testing gotchas").

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MyOrdersPage } = require('../support/pages/myOrdersPage');
const { OrderMessagesPanel, MESSAGES } = require('../support/pages/orderMessagesPanel');
const { customerApi, newestOrder } = require('../support/api');
const { TEST_FILES } = require('../support/testData');

// Tags this run's messages so they can be told apart from earlier runs on the same order.
const RUN = `pw-${Date.now().toString(36)}`;
const tag = (name) => `[${RUN}-${name}-${test.info().retry}]`;

// Not applicable file types, made in memory (just text with that file name); the QA test files
// (TEST_FILES) have none of these types.
const NOT_APPLICABLE_FILES = [
  { name: 'document.txt', mimeType: 'text/plain', buffer: Buffer.from('A plain text file.') },
  { name: 'program.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('Not a real program, only text.') },
  { name: 'animation.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') },
];

test.describe('Customer messages on an order', () => {
  /** @type {{ id: number, number: string }} */
  let order;
  /** @type {OrderMessagesPanel} */
  let messages;

  test.beforeEach(async ({ page, context }) => {
    const api = await customerApi(context);
    order = await newestOrder(api);
    await api.dispose();
    messages = new OrderMessagesPanel(page);
  });

  // Opens the newest order's Messages panel and an empty message form.
  async function openNewMessage() {
    await messages.gotoOrder(order.id);
    await messages.open(order.number);
    await messages.startNewMessage();
  }

  test('My Orders shows the newest order first, and its Messages panel opens', async ({ page }) => {
    const orders = new MyOrdersPage(page);
    const first = orders.rows.first();
    let link;

    await test.step('opens My Orders: the newest order is first, with number, date, total and status', async () => {
      await orders.goto();
      await expect(orders.orderNumber(first)).toHaveText(order.number);
      await expect(orders.date(first)).toHaveText(/\d{4}\/\d{2}\/\d{2}/);
      await expect(orders.total(first)).toHaveText(/S\$\d/);
      await expect(orders.status(first)).toHaveText(/\S/);
      link = await orders.detailsLink(first).getAttribute('href');
      expect(link, 'link to the order page').toMatch(/^\/mypage\/orders\/\d+$/);
      if ((await orders.rows.count()) > 1) {
        const second = Number((await orders.orderNumber(orders.rows.nth(1)).innerText()).trim());
        expect(second, 'the second order is older (lower number) than the first').toBeLessThan(Number(order.number));
      }
    });

    await test.step('opens the order', async () => {
      await orders.detailsLink(first).click();
      await expect(page).toHaveURL((url) => url.pathname === link, { timeout: 30_000 });
      await expect(messages.messageButton).toContainText('Messages');
    });

    await test.step('clicks Messages and the panel opens for that order', async () => {
      await messages.open(order.number);
    });

    await test.step('clicks the new-message button and an empty form opens', async () => {
      await expect(messages.newMessageButton).toHaveText(/^\s*(Create Message|Add Message|Respond)\s*$/);
      await messages.startNewMessage();
      await expect(messages.sendButton).toBeVisible();
      await expect(messages.cancelButton).toBeVisible();
    });
  });

  test.describe('refused, nothing is sent', () => {
    let sends;

    test.beforeEach(async () => {
      sends = messages.watchSends();
      await openNewMessage();
    });

    test('an empty message', async () => {
      await messages.sendButton.click();

      await expect(messages.requiredError).toHaveText(MESSAGES.required);
      await expect(messages.input).toContainClass('g-textarea-main--error');
      expect(sends, 'messages sent').toHaveLength(0);
    });

    test('a message of only spaces', async () => {
      await messages.type('      ');
      await messages.sendButton.click();

      await expect(messages.requiredError).toHaveText(MESSAGES.required);
      expect(sends, 'messages sent').toHaveLength(0);
    });

    for (const file of NOT_APPLICABLE_FILES) {
      test(`a ${path.extname(file.name)} file (not an applicable file type)`, async () => {
        await messages.fileInput.setInputFiles(file);

        await expect(messages.fileError).toHaveText(MESSAGES.unsupportedType);
        await expect(messages.filePreviews).toHaveCount(0);
        expect(sends, 'messages sent').toHaveLength(0);
      });
    }

    test('more than 4 files', async () => {
      await messages.fileInput.setInputFiles(TEST_FILES.images.slice(0, 5));

      await expect(messages.fileError).toHaveText(MESSAGES.tooManyFiles);
      await expect(messages.filePreviews).toHaveCount(0);
      expect(sends, 'messages sent').toHaveLength(0);
    });

    test('files over 50 MB in total', async () => {
      // 50 MB + 1 byte, written to this test's output folder (refused before anything is uploaded).
      const oversized = test.info().outputPath('oversized.pdf');
      fs.writeFileSync(oversized, Buffer.alloc(50 * 1024 * 1024 + 1));
      await messages.fileInput.setInputFiles(oversized);

      await expect(messages.fileError).toHaveText(MESSAGES.tooLarge);
      await expect(messages.filePreviews).toHaveCount(0);
      expect(sends, 'messages sent').toHaveLength(0);
    });

    test('a cancelled message', async () => {
      const text = `This message is cancelled. ${tag('cancelled')}`;
      await messages.type(text);
      await messages.fileInput.setInputFiles(TEST_FILES.images[0]);
      await expect(messages.filePreviews).toHaveCount(1);

      await messages.cancelButton.click();

      await expect(messages.form).toBeHidden();
      await expect(messages.newMessageButton).toBeVisible();
      await expect(messages.panel).not.toContainText(text);
      expect(sends, 'messages sent').toHaveLength(0);
    });
  });

  test.describe('sent, and still there after a reload', () => {
    test.beforeEach(async () => {
      await openNewMessage();
    });

    test('a short message', async () => {
      const text = `Hello, this is a short test message. ${tag('short')}`;
      await messages.type(text);

      const sent = await messages.send(text);
      await expect(sent.locator('.message-content p')).toHaveText([text]);
      await expect(sent.locator('.message-date')).toHaveText(/\S/);

      const reloaded = await messages.reopenAfterReload(order.number, text);
      await expect(reloaded.locator('.message-content p')).toHaveText([text]);
    });

    test('a message in paragraphs keeps its line breaks', async () => {
      const t = tag('paragraphs');
      // A blank line between paragraphs; paragraph 2 also has a single line break.
      const text = [
        `Hi team, this is the first paragraph about my artwork. ${t}`,
        'Second paragraph, line one.\nSecond paragraph, line two.',
        'Third paragraph: thank you!',
      ].join('\n\n');
      await messages.type(text);

      const sent = await messages.send(t);
      expect(await OrderMessagesPanel.shownText(sent), 'message as displayed').toBe(text);

      const reloaded = await messages.reopenAfterReload(order.number, t);
      expect(await OrderMessagesPanel.shownText(reloaded), 'message as displayed after a reload').toBe(text);
    });

    test('special characters are kept exactly as typed', async () => {
      const text = `Special characters ~!@#$%^&*()_+-={}[]|\\:;"',.?/ é ñ ü € £ © ${tag('special')}`;
      await messages.type(text);

      const sent = await messages.send(text);
      await expect(sent.locator('.message-content p')).toHaveText([text]);

      const reloaded = await messages.reopenAfterReload(order.number, text);
      await expect(reloaded.locator('.message-content p')).toHaveText([text]);
    });

    // Only checks safety: no formatting/markup is created. The site also REMOVES the tags (shows
    // "HTML check bold and underline"): the API's DataHandler::sanitize runs strip_tags on the
    // message, although MessagingController's comment says tags are deliberately kept. Whether a
    // message must keep exactly what was typed is a requirement still to be confirmed.
    test('HTML tags are never turned into formatting', async () => {
      const t = tag('html');
      await messages.type(`HTML check <b>bold</b> and <u>underline</u> ${t}`);

      const expectSafe = async (message) => {
        await expect(message.locator('.message-content')).toContainText(/HTML check .*bold.* and .*underline/);
        await expect(message.locator('.message-content b, .message-content u')).toHaveCount(0);
      };
      await expectSafe(await messages.send(t));
      await expectSafe(await messages.reopenAfterReload(order.number, t));
    });

    test('emoji are kept', async () => {
      const text = `Emoji check 😀 🎉 👍 ❤️ ${tag('emoji')}`;
      await messages.type(text);

      const sent = await messages.send(tag('emoji'));
      await expect(sent.locator('.message-content p')).toHaveText([text]);

      const reloaded = await messages.reopenAfterReload(order.number, tag('emoji'));
      await expect(reloaded.locator('.message-content p')).toHaveText([text]);
    });

    test('applicable files, adding more with "Select Files" up to 4', async () => {
      const text = `Applicable files attached. ${tag('files')}`;
      const previewNames = () => messages.filePreviews.locator('figure').evaluateAll((figures) => figures.map((f) => f.title));

      await test.step('adds the first file, then 3 more with "Select Files" (4 is the maximum)', async () => {
        await messages.fileInput.setInputFiles(TEST_FILES.images[0]);
        await expect(messages.filePreviews).toHaveCount(1);
        await expect(messages.addMoreFilesButton).toContainText('Select Files');

        await messages.addMoreFilesInput.setInputFiles([TEST_FILES.pdf, TEST_FILES.illustrator, TEST_FILES.images[1]]);
        await expect(messages.filePreviews).toHaveCount(4);
        expect(await previewNames()).toEqual(['Test-image-1.png', 'pdf_test.pdf', 'Test.ai', 'Test-image-2.png']);
        await expect(messages.addMoreFilesButton).toHaveCount(0);
      });

      await test.step('removing a file brings "Select Files" back', async () => {
        await messages.removeFileButtons.last().click();
        await expect(messages.filePreviews).toHaveCount(3);
        await expect(messages.addMoreFilesButton).toBeVisible();
        await messages.addMoreFilesInput.setInputFiles(TEST_FILES.images[2]);
        await expect(messages.filePreviews).toHaveCount(4);
        expect(await previewNames()).toEqual(['Test-image-1.png', 'pdf_test.pdf', 'Test.ai', 'Test-image-3.png']);
      });

      await test.step('sends the message with its 4 files; the image is displayed', async () => {
        await messages.type(text);
        const sent = await messages.send(text);
        await expect(sent.locator('.message-content p')).toHaveText([text]);
        await expect(sent.locator('.message-attachments .message-attachment-item')).toHaveCount(4);
        // Shown from storage, which can take a moment after the upload.
        await expect
          .poll(() => sent.locator('img.message-attachment-image').first().evaluate((img) => img.naturalWidth), {
            message: 'image attachment displayed at its real size',
            timeout: 15_000,
          })
          .toBe(TEST_FILES.imageWidth);
      });

      await test.step('still there with its 4 files after a reload', async () => {
        const reloaded = await messages.reopenAfterReload(order.number, text);
        await expect(reloaded.locator('.message-attachments .message-attachment-item')).toHaveCount(4);
      });
    });
  });
});
