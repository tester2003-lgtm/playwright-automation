// Test data shared by several specs. Secrets (card details, logins) come from .env only.

// Checkout email for guest orders. trainee84.glophics@gmail.com itself signs in with Google,
// which blocks guest checkout; Gmail ignores the "+…" part, so mail still reaches the trainee84
// inbox while the site sees a separate guest email. This one was verified once (by hand, during
// the Cypress runs) and the site remembers that, so checkout asks for no emailed code.
const CHECKOUT_EMAIL = process.env.CHECKOUT_EMAIL || 'trainee84.glophics+cypress@gmail.com';

const SHIPPING_ADDRESS = {
  fullName: 'QA Automation',
  company: 'Glophics QA',
  address: '51 Changi Business Park Central 2',
  address2: '#04-05 The Signature',
  postcode: '486066',
  phone: '91234567',
};

// Put in every test order's special instructions, so staff know not to process it.
const TEST_ORDER_NOTE = Array(3).fill('FOR TESTING PURPOSES ONLY, DO NOT PROCESS !').join('\n');

// Airwallex sandbox test card (test mode, no real money), from .env.
function testCard() {
  const { CARD_NUMBER: number, CARD_EXPIRY: expiry, CARD_CVC: cvc } = process.env;
  if (!number || !expiry || !cvc) throw new Error('Set CARD_NUMBER, CARD_EXPIRY and CARD_CVC in the Playwright .env');
  // The expiry field adds its own " / ", so it is typed as digits only (03/30 → 0330).
  return { number, expiry: expiry.replace(/\D/g, ''), cvc };
}

module.exports = { CHECKOUT_EMAIL, SHIPPING_ADDRESS, TEST_ORDER_NOTE, testCard };
