// Checkout — logged-in member pays by Credit Card (Airwallex): add Art Paper Stickers, ship to
// the account's saved address, type the card into the Airwallex fields, pay, and find the order
// in My Orders.
// Migrated from cypress/e2e/checkout/member-credit-card.cy.js.
// Run: npx playwright test checkout/member-credit-card.spec.js
//
// Runs in the "customer" project (member-*.spec.js): starts logged in with the saved member
// session (the login form is tested in auth/). The member's cart is emptied through the API
// before and after the test, so it holds only the item this test adds.
// The card is the Airwallex sandbox test card from .env (CARD_*).
// ⚠ Every run PLACES A REAL ORDER on the member account and pays it with the sandbox card (test
// mode, no real money), marked "FOR TESTING PURPOSES ONLY, DO NOT PROCESS !".

const { test, expect } = require('@playwright/test');
const { ProductPage } = require('../support/pages/productPage');
const { CartDrawer } = require('../support/pages/cartDrawer');
const { CheckoutPage, OrderCompletePage, PAYMENT } = require('../support/pages/checkoutPage');
const { customerApi, cartItemCount, emptyCart } = require('../support/api');
const { TEST_ORDER_NOTE, testCard } = require('../support/testData');

const PRODUCT = { name: 'Art Paper Stickers', path: '/stickers/paper/art' };

test.describe('Member checkout with Credit Card', () => {
  let api;

  test.beforeEach(async ({ context }) => {
    api = await customerApi(context);
    await emptyCart(api);
    expect(await cartItemCount(api), 'member cart is empty before the test').toBe(0);
  });

  test.afterEach(async () => {
    await emptyCart(api);
    await api.dispose();
  });

  test('pays with the card, places the order and it appears in My Orders', async ({ page }) => {
    const product = new ProductPage(page);
    const cart = new CartDrawer(page);
    const checkout = new CheckoutPage(page);
    const orderComplete = new OrderCompletePage(page);
    await CheckoutPage.trackAirwallexFields(page);

    await test.step(`adds ${PRODUCT.name} to the cart`, async () => {
      await product.addWithDefaultOptions(PRODUCT);
      await cart.expectItemCount(1);
    });

    await test.step('proceeds to checkout (members have no email step)', async () => {
      await cart.checkoutButton.click();
      await checkout.expectOnCheckoutPage();
      await expect(checkout.email).toHaveCount(0);
    });

    await test.step("ships to the account's saved address", async () => {
      await checkout.useSavedAddress();
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
    let orderNumber;
    await test.step('clicks "Complete Checkout", the card is charged and the order complete page opens', async () => {
      payment = await checkout.completeCheckoutPayingByCard();
      const invoice = await orderComplete.expectShown();
      expect(invoice, 'invoice in the address = invoice of the payment').toBe(payment.invoice_no);
    });

    await test.step('shows the thank-you message with the order number and the member email', async () => {
      orderNumber = await orderComplete.expectThankYou({ email: process.env.MEMBER_EMAIL });
      expect(orderNumber, 'order number shown = invoice of the payment').toBe(payment.invoice_no);
      test.info().annotations.push({
        type: 'order',
        description: `Member Credit Card order ${orderNumber} (order id ${payment.order_master_id})`,
      });
    });

    await test.step('the order appears in My Orders, and the cart is now empty', async () => {
      await page.goto('/mypage/orders');
      await expect(page.getByText(orderNumber).first()).toBeVisible({ timeout: 30_000 });
      expect(await cartItemCount(api), 'items left in the member cart after checkout').toBe(0);
    });
  });
});
