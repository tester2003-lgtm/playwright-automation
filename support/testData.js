// Test data shared by several specs. Secrets (card details, logins) come from .env only.

const path = require('path');

// The QA test files every upload uses (artwork, message attachments). Copied from the QA folder
// OneDrive\Documents\WORK\artwork_test into support/fixtures/test-files; copy again after
// changing them there. The images are 500x500 PNGs.
const TEST_FILES_DIR = path.join(__dirname, 'fixtures', 'test-files');
const TEST_FILES = {
  images: [1, 2, 3, 4, 5, 6, 7].map((i) => path.join(TEST_FILES_DIR, `Test-image-${i}.png`)),
  imageWidth: 500,
  pdf: path.join(TEST_FILES_DIR, 'pdf_test.pdf'),
  illustrator: path.join(TEST_FILES_DIR, 'Test.ai'),
};

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

module.exports = { CHECKOUT_EMAIL, SHIPPING_ADDRESS, TEST_ORDER_NOTE, testCard, TEST_FILES };
