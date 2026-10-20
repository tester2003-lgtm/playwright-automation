// @ts-check
// Playwright config for the dev.singaprinting.com suite (migrated from Cypress).
// Secrets/URLs come from a local .env (git-ignored). Copy .env.example -> .env to start.
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

const { MEMBER_STATE, ADMIN_STATE } = require('./support/auth');

const BASE_URL = process.env.BASE_URL || 'https://dev.singaprinting.com';
const ADMIN_URL = process.env.ADMIN_URL || 'https://dev-admin-panel.singaprinting.com';

module.exports = defineConfig({
  // Every area has its own top-level folder (auth/, navigation/, and later cart/, checkout/,
  // admin/ ...) holding only its tests (*.spec.js). Every helper lives in support/.
  // Each project below picks its specs by folder name.
  testDir: '.',
  // The dev site uses ONE shared member/admin account and several specs write real data,
  // so tests must not run concurrently. One worker, no parallelism.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Built-in reporting replaces the custom Cypress bug-report plugin:
  // an HTML report plus a trace/video/screenshot kept only when a test fails.
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // `public` stays FIRST: when nothing is saved yet, the UI dashboard (npm run test:ui) shows
    // only the first project in this list.

    // Every project uses devices['Desktop Chrome']: besides the screen size it sends a normal
    // Chrome User-Agent. Plain headless Chromium says "HeadlessChrome", which the API rejects
    // with "Robot detected!" (add to cart, checkout, email codes). Keep it in every project.

    // --- Public specs (start logged out): navigation/, auth/, and any guest-*.spec.js
    //     (e.g. cart/guest-add-to-cart.spec.js, checkout/guest-*.spec.js) ---
    {
      name: 'public',
      testMatch: ['**/navigation/**/*.spec.js', '**/auth/**/*.spec.js', '**/guest-*.spec.js'],
      use: { ...devices['Desktop Chrome'] },
    },

    // --- Customer specs (logged-in member): customer/, and any member-*.spec.js
    //     (e.g. cart/member-add-to-cart.spec.js, checkout/member-*.spec.js) ---
    {
      name: 'customer',
      testMatch: ['**/customer/**/*.spec.js', '**/member-*.spec.js'],
      dependencies: ['setup-member'],
      use: { ...devices['Desktop Chrome'], storageState: MEMBER_STATE },
    },

    // --- Admin specs (logged-in admin panel): admin/ ---
    {
      name: 'admin',
      testMatch: '**/admin/**/*.spec.js',
      dependencies: ['setup-admin'],
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL, storageState: ADMIN_STATE },
    },

    // --- Setup (support/setup/*.setup.js): log in once per run and save the session to .auth/*.json.
    // They run first anyway, because the customer/admin projects depend on them. ---
    { name: 'setup-member', testMatch: '**/member.setup.js' },
    { name: 'setup-admin', testMatch: '**/admin.setup.js' },
  ],
});
