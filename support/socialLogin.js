// Helpers for the "Login with Google / Facebook" specs (auth/login-google, auth/login-facebook).
//
// How the site's social login works (Frontend: components/common/auth/BaseSocialAuthentication.vue,
// pages/login/_social, nuxt.config.js auth strategies):
//   - the button opens a POPUP at /login/<google|facebook>?app_id=…
//   - that page sends the popup to the provider's sign-in page;
//   - the provider sends the user back to the site, which then signs them in.
//
// The provider's own pages are never loaded (rule 5: don't test third parties, and both block
// automated browsers anyway). Every request to the provider is caught and answered with a
// stand-in page, so the tests check what the site sends and how it handles what comes back.

const PROVIDERS = {
  google: /^https:\/\/accounts\.google\.com\//,
  facebook: /^https:\/\/([\w-]+\.)*facebook\.com\//,
};

// Catches every request to the provider in this browser (popups included). `reply(url)` returns
// the stand-in page's HTML; by default an empty page. Returns the list of caught URLs.
async function interceptProvider(context, provider, reply = () => `<title>${provider} (stand-in)</title>`) {
  const requests = [];
  await context.route(PROVIDERS[provider], (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    return route.fulfill({ status: 200, contentType: 'text/html', body: reply(url) });
  });
  return requests;
}

// Clicks a social login button and returns the popup it opens.
async function openPopup(page, button) {
  const [popup] = await Promise.all([page.waitForEvent('popup'), button.click()]);
  return popup;
}

module.exports = { PROVIDERS, interceptProvider, openPopup };
