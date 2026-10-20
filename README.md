# Playwright QA suite — dev.singaprinting.com

Playwright version of the Cypress E2E suite. Lives beside `../Cypress/`.

## Where things are

Each area of the site has its own folder that holds **only its tests** (`*.spec.js`).
Everything else the tests use lives in `support/`. New areas (checkout/, admin/ ...)
follow the same pattern.

**File names decide logged in or not:** `guest-*.spec.js` starts logged out, and
`member-*.spec.js` starts logged in as the test member. `auth/` and `navigation/` start
logged out.

```
auth/                     tests: logging in and out
  login-email.spec.js
  sign-out.spec.js
  forgot-password.spec.js
  register.spec.js
  login-google.spec.js
  login-facebook.spec.js
navigation/               tests: homepage and top menu
  homepage.spec.js
  top-menu.spec.js
cart/                     tests: the cart
  guest-add-to-cart.spec.js   one full journey: add → quantity → cart page → upload artwork
  member-add-to-cart.spec.js  the same journey as a member, + cart kept on the account
  guest-cart.spec.js          cart drawer rules, one per test: empty, count, delete, subtotal
  member-cart.spec.js         member-only rules: saved to account, hidden on sign out, merge
checkout/                 tests: placing orders (⚠ each run places a real TEST order on dev)
  guest-bank-transfer.spec.js
  guest-credit-card.spec.js   Airwallex sandbox card from .env (CARD_*)
  guest-paypal.spec.js        hand-off to PayPal (stand-in page), leave without paying (unpaid order)
  member-credit-card.spec.js  saved address, card, then finds the order in My Orders
support/                  helpers (not tests)
  pages/                    page helpers: loginModal.js, forgotPasswordModal.js,
                            registerModal.js, accountMenu.js, topMenu.js,
                            productPage.js, cartDrawer.js, cartPage.js, artworkUploadModal.js,
                            checkoutPage.js (checkout, PayPal, order complete/failed pages)
  setup/                    member.setup.js, admin.setup.js (log in once per run)
  fixtures/                 test files to upload (artwork/sticker-artwork.png)
  api.js                    API shortcuts for test setup (e.g. empty the member's cart)
  testData.js               shared test data: guest checkout email, address, test-order note
  socialLogin.js            Google/Facebook login helpers (stand-in for the provider's pages)
  auth.js                   login shortcut used by other tests
  config.js                 site and API URLs from .env
  assertions.js             shared checks (e.g. image loaded)
```

Created automatically, safe to ignore: `node_modules/`, `test-results/`,
`playwright-report/`, `.auth/` (saved logins, not the same as `auth/`).

## One-time setup

```bash
cd C:\Users\Glophics\projects\Singapriting-automation\Playwright
npm install                 # installs @playwright/test + dotenv (browsers already installed)
copy .env.example .env      # then fill in .env (it is git-ignored)
```

If Playwright ever reports a missing browser:

```bash
npx playwright install chromium
```

## Running tests

```bash
npm test                    # all tests, headless, HTML report
npm run test:headed         # watch it run in a real browser window
npm run test:ui             # interactive UI mode (pick & re-run tests, time-travel)
npm run report              # open the last HTML report

# a single file, or a whole folder
npx playwright test navigation/homepage.spec.js
npx playwright test auth/
```

## Notes
- **One worker only** — the dev site uses one shared member/admin account and several specs
  write real data, so tests must not run concurrently.
- **Bot check:** the site's API blocks browsers that call themselves "HeadlessChrome"
  ("Robot detected!" on add to cart, checkout, email codes). Every project here uses
  `devices['Desktop Chrome']`, which sends a normal Chrome name, so headless runs work.
  Keep that in every project.
- **Reports replace the custom bug-report plugin:** on failure Playwright keeps a trace,
  video and screenshot automatically. Open a failure with `npx playwright show-trace`.
- **Secrets** live only in `.env` (git-ignored), never in specs.
