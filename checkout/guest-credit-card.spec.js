// Checkout — guest pays by Credit Card (Airwallex): add Art Paper Stickers, check out with a
// guest email and shipping address, type the card into the Airwallex fields and pay.
// Migrated from cypress/e2e/checkout/guest-credit-card.cy.js.
// Run: npx playwright test checkout/guest-credit-card.spec.js
//
// Runs in the "public" project (guest-*.spec.js): a new guest every run.
// The guest email (CHECKOUT_EMAIL, support/testData.js) is already verified, so the site asks
// for no emailed code. The card is the Airwallex sandbox test card from .env (CARD_*).
// ⚠ Every run PLACES A REAL ORDER on dev and pays it with the sandbox card (test mode, no real
// money), marked "FOR TESTING PURPOSES ONLY, DO NOT PROCESS !". Keep BASE_URL on the dev site.

const { test, expect } = require('@playwright/test');
const { ProductPage } = require('../support/pages/productPage');
const { CartDrawer } = require('../support/pages/cartDrawer');
const { CheckoutPage, OrderCompletePage, PAYMENT } = require('../support/pages/checkoutPage');
const { CHECKOUT_EMAIL, SHIPPING_ADDRESS, TEST_ORDER_NOTE, testCard } = require('../support/testData');

const PRODUCT = { name: 'Art Paper Stickers', path: '/stickers/paper/art' };

test('Guest checkout with Credit Card pays and places the order', async ({ page }) => {
  const product = new ProductPage(page);
  const cart = new CartDrawer(page);
  const checkout = new CheckoutPage(page);
  const orderComplete = new OrderCompletePage(page);
  await CheckoutPage.trackAirwallexFields(page);

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

  await test.step('selects Credit Card as the payment option', async () => {
    await checkout.selectPayment(PAYMENT.creditCard);
    await expect(checkout.cardForm).toBeVisible();
  });

  await test.step('types the card number, expiry and CVC into the Airwallex fields', async () => {
    await checkout.fillCard(testCard());
  });

  await test.step('shows the item in the order summary', async () => {
    await expect(checkout.itemSummary).toHaveText('Item Summary (1)');
    await expect(page.getByText(PRODUCT.name).first()).toBeAttached();
  });

  await test.step('checks the Terms of Service checkbox', async () => {
    await checkout.agreeToTerms();
  });

  let payment;
  let invoice;
  await test.step('clicks "Complete Checkout", the card is charged and the order complete page opens', async () => {
    payment = await checkout.completeCheckoutPayingByCard();
    invoice = await orderComplete.expectShown();
    expect(invoice, 'invoice in the address = invoice of the payment').toBe(payment.invoice_no);
  });

  await test.step('shows the thank-you message with the order number and email', async () => {
    const orderNumber = await orderComplete.expectThankYou({ email: CHECKOUT_EMAIL });
    expect(orderNumber, 'order number shown = invoice number in the address').toBe(invoice);
    test.info().annotations.push({ type: 'order', description: `Credit Card order ${orderNumber}` });
  });
});
