// Cart — logged-in member: what differs from a guest cart. The cart is saved to the account,
// hidden after signing out, and a guest cart is merged into it on login.
// Migrated from the "Logged-in member" half of cypress/e2e/cart/cart.cy.js (the guest half is
// cart/guest-cart.spec.js).
// Run: npx playwright test cart/member-cart.spec.js
//
// Runs in the "customer" project (member-*.spec.js), but these tests sign out, so they DON'T use
// the shared saved member session: each test starts logged out and logs in with a session of its
// own (signing out the shared one would log out every spec after this one).
// The member's cart is emptied through the API before and after every test, with an API session
// of its own, so it works even after a test has signed the browser out.
// Writes to dev: cart items on the member account (removed afterwards). No order is placed.

const { test, expect, devices } = require('@playwright/test');
const { ProductPage } = require('../support/pages/productPage');
const { CartDrawer } = require('../support/pages/cartDrawer');
const { LoginModal } = require('../support/pages/loginModal');
const { AccountMenu } = require('../support/pages/accountMenu');
const { memberApiLogin, cartItemCount, emptyCart } = require('../support/api');
const { loginAsMember } = require('../support/auth');

const ART_PAPER = { name: 'Art Paper Stickers', path: '/stickers/paper/art' };
const CLASSIC_PAPER = { name: 'Classic Paper Stickers', path: '/stickers/paper/classic' };

const { MEMBER_EMAIL, MEMBER_PASSWORD } = process.env;

// Start logged out (not with the shared saved session); each test logs in by itself.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Cart - logged-in member', () => {
  let api;
  /** @type {ProductPage} */
  let product;
  /** @type {CartDrawer} */
  let cart;

  test.beforeEach(async ({ page }) => {
    api = await memberApiLogin();
    await emptyCart(api);
    expect(await cartItemCount(api), 'member cart is empty before the test').toBe(0);

    await loginAsMember(page);
    product = new ProductPage(page);
    cart = new CartDrawer(page);
  });

  test.afterEach(async () => {
    await emptyCart(api);
    await api.dispose();
  });

  // A new browser with nothing saved (like another computer).
  const newBrowser = (browser, baseURL) => browser.newContext({ ...devices['Desktop Chrome'], baseURL });

  test('adds, edits and deletes an item, and the account cart ends up empty', async () => {
    await test.step(`adds ${ART_PAPER.name}`, async () => {
      await product.addWithDefaultOptions(ART_PAPER);
      await cart.expectItemCount(1);
      await cart.expectSubtotalMatchesItems();
    });

    await test.step('changes the quantity to 200', async () => {
      await cart.changeQuantity(cart.item(ART_PAPER.name), '200');
      await cart.expectSubtotalMatchesItems();
    });

    await test.step('deletes it: the cart is empty, on the page and on the account', async () => {
      await cart.deleteItem(cart.item(ART_PAPER.name));
      await cart.expectEmpty();
      expect(await cartItemCount(api), 'items in the account cart').toBe(0);
    });
  });

  test('saves the cart to the account: still there after signing out and logging in on another browser', async ({ page, browser, baseURL }) => {
    await test.step('adds two products', async () => {
      await product.addWithDefaultOptions(ART_PAPER);
      await product.addWithDefaultOptions(CLASSIC_PAPER);
      await cart.expectItemCount(2);
    });

    await test.step('signs out', async () => {
      await new AccountMenu(page).signOutViaHeader();
    });

    await test.step('logs in on another browser and finds both items', async () => {
      expect(await cartItemCount(api), 'items in the account cart (server)').toBe(2);
      const other = await newBrowser(browser, baseURL);
      try {
        const otherPage = await other.newPage();
        await loginAsMember(otherPage);
        const otherCart = new CartDrawer(otherPage);
        await otherCart.open();
        await otherCart.expectItemCount(2);
        await expect(otherCart.item(ART_PAPER.name)).toHaveCount(1);
        await expect(otherCart.item(CLASSIC_PAPER.name)).toHaveCount(1);
      } finally {
        await other.close();
      }
    });
  });

  test('hides the member cart after signing out, also after a reload', async ({ page }) => {
    const accountMenu = new AccountMenu(page);

    await test.step(`adds ${ART_PAPER.name}`, async () => {
      await product.addWithDefaultOptions(ART_PAPER);
      await cart.expectItemCount(1);
    });

    await test.step('signs out: the cart shows 0 and is empty', async () => {
      await accountMenu.signOutViaHeader();
      await expect(cart.itemCount).toHaveText('0', { timeout: 20_000 });
      await cart.open();
      await cart.expectEmpty();
    });

    await test.step('reloads: still signed out with an empty cart', async () => {
      await page.reload();
      await expect(cart.itemCount).toHaveText('0', { timeout: 20_000 });
      await expect(accountMenu.headerMemberMenu).toHaveCount(0);
      await cart.open();
      await cart.expectEmpty();
    });
  });

  test('merges a guest cart into the account cart on login', async ({ browser, baseURL }) => {
    await test.step(`the member has ${ART_PAPER.name} in the account cart`, async () => {
      await product.addWithDefaultOptions(ART_PAPER);
      await cart.expectItemCount(1);
    });

    const guest = await newBrowser(browser, baseURL);
    try {
      const guestPage = await guest.newPage();
      const guestCart = new CartDrawer(guestPage);

      await test.step(`on another browser, a guest adds ${CLASSIC_PAPER.name}`, async () => {
        await new ProductPage(guestPage).addWithDefaultOptions(CLASSIC_PAPER);
        await guestCart.expectItemCount(1);
      });

      await test.step('the guest logs in with the Sign In form', async () => {
        const loginModal = new LoginModal(guestPage);
        await loginModal.openFromHeader();
        await loginModal.login({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD });
        await loginModal.expectLoggedIn();
      });

      await test.step('both items are in the cart, nothing duplicated or lost', async () => {
        await guestCart.open();
        await guestCart.expectItemCount(2);
        await expect(guestCart.item(ART_PAPER.name)).toHaveCount(1);
        await expect(guestCart.item(CLASSIC_PAPER.name)).toHaveCount(1);
        await guestCart.expectSubtotalMatchesItems();
        expect(await cartItemCount(api), 'items in the account cart').toBe(2);
      });

      await test.step('still 2 after a reload', async () => {
        await guestPage.reload();
        await expect(guestCart.itemCount).toHaveText('2', { timeout: 20_000 });
      });
    } finally {
      await guest.close();
    }
  });
});
