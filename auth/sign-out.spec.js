// Auth — Sign out, via the header My Account menu and via the footer.
// Migrated from cypress/e2e/auth/sign-out.cy.js.
// Run: npx playwright test auth/sign-out.spec.js
//
// Each test logs in with its OWN new session (loginAsMember, no login form) instead of the
// shared saved one: the footer Sign Out ends the session on the server, so reusing the
// shared session would log out every spec that runs after this one.

const { test, expect } = require('@playwright/test');
const { loginAsMember } = require('../support/auth');
const { AccountMenu } = require('../support/pages/accountMenu');
const { LoginModal } = require('../support/pages/loginModal');

const { MEMBER_EMAIL, MEMBER_PASSWORD } = process.env;

const PROFILE_PATH = '/mypage/profile';
const PRODUCT_PATH = '/stickers/paper/art';

const HEADER = { via: 'the header My Account menu', signOut: (menu) => menu.signOutViaHeader() };
const FOOTER = { via: 'the footer', signOut: (menu) => menu.signOutViaFooter() };

test.describe('Sign out', () => {
  /** @type {AccountMenu} */
  let accountMenu;

  test.beforeEach(async ({ page }) => {
    await loginAsMember(page);
    accountMenu = new AccountMenu(page);
  });

  for (const place of [HEADER, FOOTER]) {
    const { via, signOut } = place;

    test.describe(`via ${via}`, () => {
      test('signs out and stays signed out after a reload', async ({ page }) => {
        await test.step('starts on the homepage, logged in', async () => {
          await page.goto('/');
          await accountMenu.expectLoggedIn();
        });

        await test.step(`clicks Sign Out in ${via}`, async () => {
          await signOut(accountMenu);
          await accountMenu.expectLoggedOut();
        });

        await test.step('is still signed out after reloading the page', async () => {
          await page.reload();
          await accountMenu.expectLoggedOut();
        });
      });

      test('signs out from a My Account page', async ({ page }) => {
        await test.step('opens the Profile page, logged in', async () => {
          await page.goto(PROFILE_PATH);
          await accountMenu.expectLoggedIn();
        });

        await test.step(`clicks Sign Out in ${via}`, async () => {
          await signOut(accountMenu);
          await accountMenu.expectLoggedOut();
        });
      });

      // KNOWN BUG (dev, Oct 2026), footer only: Sign Out from the footer leaves you on
      // /mypage/profile still showing the member's details (the header one goes to the homepage).
      // test.fail() keeps the run green while the bug exists and turns this test RED once it
      // is fixed — then delete the test.fail() line.
      test('hides the personal details after signing out on the Profile page', async ({ page }) => {
        test.fail(place === FOOTER, 'Known bug: footer Sign Out leaves the Profile page showing personal details');

        await test.step('opens the Profile page showing the personal details', async () => {
          await page.goto(PROFILE_PATH);
          await expect(page.getByText('Personal Details')).toBeVisible();
          await expect(page.getByText(MEMBER_EMAIL)).toBeVisible();
        });

        await test.step(`clicks Sign Out in ${via}`, async () => {
          await signOut(accountMenu);
          await accountMenu.expectLoggedOut();
        });

        await test.step('no longer shows the personal details', async () => {
          await expect(page.getByText('Personal Details')).toHaveCount(0);
          await expect(page.getByText(MEMBER_EMAIL)).toHaveCount(0);
        });
      });

      // KNOWN BUG (dev, Oct 2026), header only: the header Sign Out only deletes the login cookie
      // in the browser — it never calls POST user/signout, so the session stays valid on the
      // server and anyone holding the old token is still logged in. The footer one does call it.
      test('ends the session on the server, so the old login cannot be reused', async ({ page, browser, baseURL }) => {
        test.fail(place === HEADER, 'Known bug: header Sign Out does not end the session on the server');

        let savedLogin;
        await test.step('starts on the homepage, logged in, and keeps a copy of the login cookies', async () => {
          await page.goto('/');
          await accountMenu.expectLoggedIn();
          savedLogin = await page.context().storageState();
        });

        await test.step(`clicks Sign Out in ${via}`, async () => {
          await signOut(accountMenu);
          await accountMenu.expectLoggedOut();
        });

        await test.step('a new browser using the copied login cookies is logged out', async () => {
          const otherContext = await browser.newContext({ baseURL, storageState: savedLogin });
          try {
            const otherPage = await otherContext.newPage();
            await otherPage.goto('/');
            await new AccountMenu(otherPage).expectLoggedOut();
          } finally {
            await otherContext.close();
          }
        });
      });

      test('can sign back in after signing out', async ({ page }) => {
        const loginModal = new LoginModal(page);

        await test.step(`signs out via ${via}`, async () => {
          await page.goto('/');
          await accountMenu.expectLoggedIn();
          await signOut(accountMenu);
          await accountMenu.expectLoggedOut();
        });

        await test.step('signs back in with the member email and password', async () => {
          await loginModal.open();
          await loginModal.login({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD });
          await loginModal.expectLoggedIn();
        });
      });
    });
  }

  // Regression test for an Oct 2026 bug (reloading after visiting a product page logged the
  // member back in). It no longer reproduces on dev (checked 2026-10-19).
  test('stays signed out after a reload when a product page was visited', async ({ page }) => {
    await test.step('opens a product page, logged in', async () => {
      await page.goto(PRODUCT_PATH);
      await expect(page.locator('h1.quote_title')).toBeVisible();
      await accountMenu.expectLoggedIn();
    });

    await test.step('signs out via the header My Account menu', async () => {
      await accountMenu.signOutViaHeader();
      await accountMenu.expectLoggedOut();
    });

    await test.step('is still signed out after reloading the page', async () => {
      await page.reload();
      await accountMenu.expectLoggedOut();
    });
  });
});
