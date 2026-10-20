// Page objects for the checkout page (/checkout) and the order complete page (/order/complete).
// Based on pages/checkout.vue + components/checkout/ (forms/ShippingAddress.vue,
// forms/PaymentOptions.vue, components/Airwallex.vue) in the storefront repo (../Frontend).
//
// PayPal (PayPal Express Checkout, Frontend components/checkout/index.vue, API
// OrderConfirmationController::makePay / validatePayment): "Pay with PayPal" creates the order
// UNPAID and the server gets a PayPal token (EC-…); a PayPal window opens at
// paypal.com/checkoutnow?token=…; after the buyer approves, PayPal sends them to
// /order/processing?token=…&PayerID=…, where the server asks PayPal for the money and only then
// marks the order paid and the cart items sold. PayPal's own pages are never loaded (rule 5:
// don't test third parties): the PayPal window gets a stand-in page (standInForPayPal).
//
// Card fields: #cardNumber / #expiry / #cvc each hold an iframe served by Airwallex
// (checkout-demo.airwallex.com on dev) with one input inside. Playwright types into it directly
// (frameLocator). Each field also posts its state to the page ({ type, code: 'onReady' |
// 'onChange', complete }); trackAirwallexFields() records those messages so the test can wait
// for a field to be ready and check Airwallex accepted what was typed.

const { expect } = require('@playwright/test');

// Payment options by the name the customer sees (GET get/payment-methods).
const PAYMENT = { creditCard: 'Credit Card', paypal: 'PayPal', bankTransfer: 'Bank Transfer' };

const isPost = (res, path) => res.request().method() === 'POST' && new URL(res.url()).pathname.endsWith(path);

// The PayPal window's page, live or sandbox. Dev must only ever use the sandbox (test money).
const PAYPAL_CHECKOUT = /^https:\/\/www\.(sandbox\.)?paypal\.com\/checkoutnow\b/;
const PAYPAL_SANDBOX_CHECKOUT = /^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?/;

class CheckoutPage {
  constructor(page) {
    this.page = page;
    this.email = page.locator('#checkout_email');
    this.field = {
      fullName: page.locator('#checkout_shipping_full_name'),
      company: page.locator('#checkout_shipping_company'),
      address: page.locator('#checkout_shipping_address'),
      address2: page.locator('#checkout_shipping_address2'),
      postcode: page.locator('#checkout_shipping_postcode'),
      phone: page.locator('#checkout_shipping_phone_number'),
    };
    this.shippingForm = page.locator('form.shipping_address');
    this.savedAddressOption = page.locator('input[name="address_option"][value="old"]');
    this.specialInstructions = page.locator('#special_instructions');
    this.paymentDescription = page.locator('.payment_description');
    this.cardForm = page.locator('.airwallex_container');
    this.itemSummary = page.getByText(/Item Summary \(\d+\)/).first();
    this.termsCheckbox = page.locator('#i_agree');
    this.completeButton = page.locator('button.cart_submit').filter({ visible: true }).filter({ hasText: 'Complete Checkout' });
    this.payWithPayPalButton = page.locator('button.cart_submit.paypal').filter({ hasText: 'Pay with' });
  }

  // Call before clicking "Pay with PayPal": the PayPal window gets a stand-in page instead of
  // PayPal's (live PayPal included, so a wrong setup can never reach it).
  static async standInForPayPal(context) {
    await context.route(PAYPAL_CHECKOUT, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>PayPal (stand-in)</title>' }),
    );
  }

  // Call BEFORE opening the product page: records the Airwallex card fields' state messages.
  static async trackAirwallexFields(page) {
    await page.addInitScript(() => {
      window.__airwallex = { ready: {}, complete: {} };
      window.addEventListener('message', ({ origin, data }) => {
        if (!/^https:\/\/[\w.-]+\.airwallex\.com$/.test(origin) || !data || !data.type) return;
        if (data.code === 'onReady') window.__airwallex.ready[data.type] = true;
        if (data.code === 'onChange') window.__airwallex.complete[data.type] = data.complete;
      });
    });
  }

  async expectOnCheckoutPage() {
    await expect(this.page).toHaveURL((url) => url.pathname === '/checkout', { timeout: 30_000 });
  }

  // Types the guest email and leaves the field. The site then checks the email: it must not
  // belong to an account, and must already be verified (otherwise the site emails a 4-digit
  // code, which the tests can't read).
  async enterGuestEmail(email) {
    const lookup = this.page.waitForResponse((res) => res.url().includes('inquiry/email'));
    const verification = this.page.waitForResponse((res) => isPost(res, 'cart/mail/get-verification'));
    verification.catch(() => {}); // not sent at all if the email belongs to an account
    await this.email.fill(email);
    await this.email.blur();

    const account = (await (await lookup).json()).data;
    expect(account.exists, `${email} belongs to an account, so the site won't take a guest order with it. Use another CHECKOUT_EMAIL.`).toBe(false);
    const verified = (await (await verification).json()).data?.verified;
    expect(
      verified,
      `${email} isn't verified yet, so the site wants the 4-digit code it just emailed. One-time fix: ` +
        'in a normal browser, start a guest checkout with this email and type the code from the inbox. ' +
        'The site remembers it from then on.',
    ).toBe(true);
  }

  async fillShippingAddress(address) {
    for (const [name, value] of Object.entries(address)) {
      await this.field[name].fill(value);
      await expect(this.field[name]).toHaveValue(value);
    }
  }

  // Members: ship to the address saved on the account. The account gets one from its first
  // checkout; the test member has had many, so it must be there.
  async useSavedAddress() {
    await expect(this.savedAddressOption, 'the member account has a saved shipping address').toBeAttached({ timeout: 30_000 });
    await this.page.locator(`label[for="${await this.savedAddressOption.getAttribute('id')}"]`).click();
    await expect(this.savedAddressOption).toBeChecked();
  }

  // Clicks the shipping option's label (value: 'standard_shipping' | 'express_shipping').
  async selectDelivery(value) {
    const option = this.page.locator(`input[name="delivery_option"][value="${value}"]`);
    await this.page.locator(`label[for="${await option.getAttribute('id')}"]`).click();
    await expect(option).toBeChecked();
  }

  async addSpecialInstructions(text) {
    await this.specialInstructions.fill(text);
    await expect(this.specialInstructions).toHaveValue(text);
  }

  // Clicks a payment option box by its name (PAYMENT.*). The site handles the click on the box
  // and marks it "selected"; it redraws the radio button inside without keeping it ticked, so the
  // highlight is what's checked, not the radio.
  paymentOption(name) {
    return this.page.locator('.payment_options .standard_radio_box').filter({ hasText: name });
  }

  async selectPayment(name) {
    await this.paymentOption(name).click();
    await expect(this.paymentOption(name)).toContainClass('selected');
  }

  // Types into one Airwallex field once it's ready, then waits until Airwallex says it's complete.
  async typeCardField(field, value) {
    const state = (key) => this.page.evaluate(([k, f]) => window.__airwallex?.[k]?.[f], [key, field]);
    await expect.poll(() => state('ready'), { message: `Airwallex ${field} field ready`, timeout: 30_000 }).toBe(true);
    await this.page.frameLocator(`#${field} iframe`).locator('input').pressSequentially(value, { delay: 50 });
    await expect.poll(() => state('complete'), { message: `Airwallex accepted the ${field}` }).toBe(true);
  }

  async fillCard({ number, expiry, cvc }) {
    await this.typeCardField('cardNumber', number);
    await this.typeCardField('expiry', expiry);
    await this.typeCardField('cvc', cvc);
  }

  async agreeToTerms() {
    await this.termsCheckbox.check({ force: true });
    await expect(this.termsCheckbox).toBeChecked();
  }

  // Clicks Complete Checkout and returns the server's answer to "create the order"
  // (POST cart/checkout). Card payments carry on with Airwallex after this.
  async completeCheckout() {
    const order = this.page.waitForResponse((res) => isPost(res, '/cart/checkout'), { timeout: 60_000 });
    await expect(this.completeButton).toBeEnabled();
    await this.completeButton.click();
    return (await order).json();
  }

  // Complete Checkout paying by card: the site creates the order (POST cart/checkout answers
  // "airwallex"), Airwallex charges the card, then the site records the payment
  // (PATCH cart/checkout/payment-summary-aw). Returns that last answer's data
  // ({ invoice_no, order_master_id, … }).
  async completeCheckoutPayingByCard() {
    const payment = this.page.waitForResponse(
      (res) => res.request().method() === 'PATCH' && new URL(res.url()).pathname.endsWith('/cart/checkout/payment-summary-aw'),
      { timeout: 90_000 },
    );
    payment.catch(() => {}); // never sent if creating the order already failed
    const order = await this.completeCheckout();
    expect(order.message, `create the order (POST cart/checkout) for a card payment: ${order.status}`).toBe('airwallex');
    const body = await (await payment).json();
    expect(body.message, 'card payment recorded (PATCH cart/checkout/payment-summary-aw)').toBe('SUCCESS');
    return body.data;
  }

  // Clicks "Pay with PayPal": the site creates the order, the server gets a PayPal token for it
  // (POST cart/checkout answers ACK Success + TOKEN) and the PayPal window opens on PayPal's
  // sandbox with that token. Returns { token, paypalWindow }.
  async startPayPalPayment() {
    // The button needs PayPal's script (paypalobjects.com/api/checkout.js). Clicked before it
    // has loaded, the click silently does nothing ("paypal is not defined" in the console), so
    // wait for it like a customer would wait for the page to finish loading.
    await expect
      .poll(() => this.page.evaluate(() => typeof window.paypal?.checkout?.initXO), {
        message: "PayPal's checkout script has loaded",
        timeout: 30_000,
      })
      .toBe('function');

    const order = this.page.waitForResponse((res) => isPost(res, '/cart/checkout'), { timeout: 60_000 });
    const paypalWindow = this.page.waitForEvent('popup', { timeout: 60_000 });
    paypalWindow.catch(() => {}); // never opens if the click did nothing
    await expect(this.payWithPayPalButton).toBeEnabled();
    await this.payWithPayPalButton.click();

    const body = await (await order).json();
    expect(body.status, `create the order (POST cart/checkout): ${body.message}`).toBe('SUCCESS');
    expect(body.data?.ACK, `PayPal accepted the payment request: ${body.data?.message}`).toBe('Success');
    const token = body.data.TOKEN;
    expect(token, 'PayPal token for the order').toMatch(/^EC-\w+$/);

    const popup = await paypalWindow;
    await popup.waitForURL(PAYPAL_CHECKOUT, { timeout: 30_000 });
    expect(popup.url(), 'the PayPal window is on PayPal\'s TEST site (sandbox), never live PayPal').toMatch(PAYPAL_SANDBOX_CHECKOUT);
    expect(new URL(popup.url()).searchParams.get('token'), 'the PayPal window shows this order').toBe(token);
    return { token, paypalWindow: popup };
  }

  // After the PayPal window closes, the checkout page must be usable again: the Pay with PayPal
  // button is enabled and nothing (PayPal's dimmed overlay) covers it.
  async expectCanPayWithPayPalAgain() {
    await expect(this.payWithPayPalButton).toBeVisible();
    await expect(this.payWithPayPalButton).not.toContainClass('disabled');
    await this.payWithPayPalButton.click({ trial: true, timeout: 15_000 });
  }
}

class OrderCompletePage {
  constructor(page) {
    this.page = page;
    this.thankYou = page.locator('.cart_thankyou');
    this.heading = this.thankYou.locator('h3');
    this.orderNumber = this.thankYou.locator('p', { hasText: 'Your Order number is' }).locator('.high_text');
    this.emailNote = this.thankYou.locator('p', { hasText: 'A copy of your order details has been sent to' });
  }

  // On /order/complete?invoice_no=… (a failed order goes to /order/failed instead).
  // Returns the invoice number from the address.
  async expectShown() {
    // The invoice number is added to the address a moment after the page opens, so wait for both.
    await expect(this.page).toHaveURL(
      (url) => url.pathname === '/order/complete' && /^\w+$/.test(url.searchParams.get('invoice_no') || ''),
      { timeout: 60_000 },
    );
    return new URL(this.page.url()).searchParams.get('invoice_no');
  }

  // "Thank you, <name>!", the order number, and the email the order details were sent to.
  async expectThankYou({ email }) {
    await expect(this.heading).toHaveText(/^Thank you, .+!$/, { timeout: 30_000 });
    await expect(this.orderNumber).toHaveText(/^\s*\w+\s*$/);
    await expect(this.emailNote).toContainText(email);
    return (await this.orderNumber.innerText()).trim();
  }
}

// /order/failed: shown when a payment didn't go through.
class OrderFailedPage {
  constructor(page) {
    this.page = page;
    this.heading = page.locator('.content_404 h1');
  }

  async expectShown() {
    await expect(this.page).toHaveURL((url) => url.pathname === '/order/failed', { timeout: 60_000 });
    await expect(this.heading).toHaveText(/something went wrong/i);
  }
}

module.exports = { CheckoutPage, OrderCompletePage, OrderFailedPage, PAYMENT };
