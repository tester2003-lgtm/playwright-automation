// Checkout — guest chooses PayPal: add Art Paper Stickers, check out with a guest email and
// shipping address, click "Pay with PayPal", then leave PayPal without paying.
// New (Cypress had no PayPal spec).
// Run: npx playwright test checkout/guest-paypal.spec.js
//
// Runs in the "public" project (guest-*.spec.js): a new guest every run.
// PayPal's own pages are never loaded: the PayPal window gets a stand-in page, so the test checks
// the site's side of the hand-off (support/pages/checkoutPage.js explains the PayPal flow).
// Paying on PayPal for real would need a PayPal sandbox buyer account; not set up (see the
// test.fixme at the bottom).
// ⚠ Every run CREATES A REAL (unpaid, PayPal) ORDER on dev, marked
// "FOR TESTING PURPOSES ONLY, DO NOT PROCESS !". Keep BASE_URL on the dev site.

const { test, expect } = require('@playwright/test');
const { ProductPage } = require('../support/pages/productPage');
const { CartDrawer } = require('../support/pages/cartDrawer');
const { CheckoutPage, OrderFailedPage, PAYMENT } = require('../support/pages/checkoutPage');
const { CHECKOUT_EMAIL, SHIPPING_ADDRESS, TEST_ORDER_NOTE } = require('../support/testData');

const PRODUCT = { name: 'Art Paper Stickers', path: '/stickers/paper/art' };

test.describe('Guest checkout with PayPal', () => {
  test('hands the payment to PayPal, and completes nothing until PayPal confirms it', async ({ page, context }) => {
    const product = new ProductPage(page);
    const cart = new CartDrawer(page);
    const checkout = new CheckoutPage(page);
    const orderFailed = new OrderFailedPage(page);
    await CheckoutPage.standInForPayPal(context);

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

    await test.step('selects PayPal: "Pay with PayPal" replaces "Complete Checkout"', async () => {
      await checkout.selectPayment(PAYMENT.paypal);
      await expect(checkout.paymentDescription).toContainText('PayPal');
      await expect(checkout.payWithPayPalButton).toBeVisible();
      await expect(checkout.completeButton).toBeHidden();
    });

    await test.step('shows the item in the order summary', async () => {
      await expect(checkout.itemSummary).toHaveText('Item Summary (1)');
      await expect(page.getByText(PRODUCT.name).first()).toBeAttached();
    });

    await test.step('checks the Terms of Service checkbox', async () => {
      await checkout.agreeToTerms();
    });

    let paypal;
    await test.step('clicks "Pay with PayPal": the PayPal window opens on PayPal\'s test site with this order', async () => {
      paypal = await checkout.startPayPalPayment();
      test.info().annotations.push({ type: 'order', description: `Unpaid PayPal order, PayPal token ${paypal.token}` });
    });

    await test.step('closes the PayPal window without paying: still on checkout, can pay again', async () => {
      await paypal.paypalWindow.close();
      await checkout.expectOnCheckoutPage();
      await checkout.expectCanPayWithPayPalAgain();
    });

    await test.step('returning from PayPal with an approval PayPal never gave does not complete the order', async () => {
      // The address PayPal sends the buyer back to, with a made-up PayerID.
      await page.goto(`/order/processing?token=${paypal.token}&PayerID=NOTAPAYPALBUYER`);
      await orderFailed.expectShown();
    });

    await test.step('the item is still in the cart (not sold)', async () => {
      await page.goto('/');
      await cart.open();
      await cart.expectItemCount(1);
      await expect(cart.item(PRODUCT.name)).toBeVisible();
    });
  });

  // Paying on PayPal needs a PayPal sandbox BUYER account (free, from developer.paypal.com) and
  // means driving PayPal's own login pages, which the suite avoids (rule 5). Shows as "fixme"
  // so the gap stays visible.
  // MANUAL CHECK before a release: pay with a PayPal sandbox buyer → the order complete page
  // shows the order number, and the cart is empty.
  test.fixme('completes the order after paying on PayPal', async () => {});
});
