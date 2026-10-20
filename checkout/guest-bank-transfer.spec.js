// Checkout — guest pays by Bank Transfer: add Art Paper Stickers, check out with a guest email
// and shipping address, and place the order.
// Migrated from cypress/e2e/checkout/guest-bank-transfer.cy.js.
// Run: npx playwright test checkout/guest-bank-transfer.spec.js
//
// Runs in the "public" project (guest-*.spec.js): a new guest every run.
// The guest email (CHECKOUT_EMAIL, support/testData.js) is already verified, so the site asks
// for no emailed code; the test stops with an explanation if that ever changes.
// ⚠ Every run PLACES A REAL (unpaid, Bank Transfer) ORDER on dev, marked
// "FOR TESTING PURPOSES ONLY, DO NOT PROCESS !". Keep BASE_URL on the dev site.

const { test, expect } = require('@playwright/test');
const { ProductPage } = require('../support/pages/productPage');
const { CartDrawer } = require('../support/pages/cartDrawer');
const { CheckoutPage, OrderCompletePage, PAYMENT } = require('../support/pages/checkoutPage');
const { CHECKOUT_EMAIL, SHIPPING_ADDRESS, TEST_ORDER_NOTE } = require('../support/testData');

const PRODUCT = { name: 'Art Paper Stickers', path: '/stickers/paper/art' };

test('Guest checkout with Bank Transfer places the order', async ({ page }) => {
  const product = new ProductPage(page);
  const cart = new CartDrawer(page);
  const checkout = new CheckoutPage(page);
  const orderComplete = new OrderCompletePage(page);

  await test.step(`adds ${PRODUCT.name} to the cart`, async () => {
    await product.addWithDefaultOptions(PRODUCT);
    await cart.expectItemCount(1);
  });

  await test.step('proceeds to checkout', async () => {
    await cart.checkoutButton.click();
    await checkout.expectOnCheckoutPage();
  });

  await test.step('enters the guest email (already verified: no code needed)', async () => {
    await checkout.enterGuestEmail(CHECKOUT_EMAIL);
  });

  await test.step('fills in the shipping address', async () => {
    await checkout.fillShippingAddress(SHIPPING_ADDRESS);
  });

  await test.step('selects Standard shipping', async () => {
    await checkout.selectDelivery('standard_shipping');
  });

  await test.step('adds the "do not process" special instruction', async () => {
    await checkout.addSpecialInstructions(TEST_ORDER_NOTE);
  });

  await test.step('selects Bank Transfer as the payment option', async () => {
    await checkout.selectPayment(PAYMENT.bankTransfer);
    await expect(checkout.paymentDescription).toContainText('Bank');
  });

  await test.step('shows the item in the order summary', async () => {
    await expect(checkout.itemSummary).toHaveText('Item Summary (1)');
    await expect(page.getByText(PRODUCT.name).first()).toBeAttached();
  });

  await test.step('checks the Terms of Service checkbox', async () => {
    await checkout.agreeToTerms();
  });

  let invoice;
  await test.step('clicks "Complete Checkout" and lands on the order complete page', async () => {
    const order = await checkout.completeCheckout();
    expect(order.status, `create the order (POST cart/checkout): ${order.message}`).toBe('SUCCESS');
    invoice = await orderComplete.expectShown();
  });

  await test.step('shows the thank-you message with the order number and email', async () => {
    const orderNumber = await orderComplete.expectThankYou({ email: CHECKOUT_EMAIL });
    expect(orderNumber, 'order number shown = invoice number in the address').toBe(invoice);
    test.info().annotations.push({ type: 'order', description: `Bank Transfer order ${orderNumber}` });
  });
});
