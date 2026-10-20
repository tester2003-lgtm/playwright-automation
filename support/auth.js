// Login helpers and where the saved login sessions (storage state: cookies + localStorage)
// are written. The setup specs create these; the customer/admin test projects reuse them so
// each run logs in once instead of per spec (the Playwright equivalent of Cypress's cy.session
// with cacheAcrossSpecs:true). The .auth folder is git-ignored.
const path = require('path');
const { BASE_URL } = require('./config');

const MEMBER_STATE = path.join(__dirname, '..', '.auth', 'member.json');
const ADMIN_STATE = path.join(__dirname, '..', '.auth', 'admin.json');

// Logs the page in as the test member with a NEW session, without using the login form
// (the form is tested in auth/login-email.spec.js). Calls the site's own
// $auth.loginWith('local', ...) — the same POST user/signin the form sends.
// Use it in specs that must not share the saved member session, e.g. sign-out tests:
// signing out ends the session on the server, which would break the shared one.
// Ends with a reload: logging in this way doesn't refresh the header, so without it the account
// menu and the cart count would still show what a guest sees.
async function loginAsMember(page) {
  const email = process.env.MEMBER_EMAIL;
  const password = process.env.MEMBER_PASSWORD;
  if (!email || !password) {
    throw new Error('loginAsMember needs MEMBER_EMAIL and MEMBER_PASSWORD in playwright/.env');
  }

  await page.goto(BASE_URL + '/');
  await page.waitForFunction(() => window.$nuxt && window.$nuxt._isMounted);
  await page.evaluate(async ({ email, password }) => {
    await window.$nuxt.$auth.loginWith('local', {
      data: { email, password, remember_me: false },
    });
  }, { email, password });
  await page.reload();
  await page.waitForFunction(() => window.$nuxt && window.$nuxt._isMounted);
}

module.exports = { MEMBER_STATE, ADMIN_STATE, loginAsMember };
