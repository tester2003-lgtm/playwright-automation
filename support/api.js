// Customer-side API helpers, for setting up and checking test preconditions without the UI
// (rule 4: use the UI only for what the test is about). Endpoints are the ones the storefront
// itself calls (Frontend/store/cart/index.js → API routes/api.php "cart-items").

const { request, devices } = require('@playwright/test');
const { BASE_URL, API_URL } = require('./config');

// Headers the storefront sends with every API call (Frontend/plugins/axios.js). The API answers
// "client-panel" requests as the customer site. A normal Chrome User-Agent avoids the API's
// "Robot detected!" check.
const CLIENT_HEADERS = {
  'Request-From': 'client-panel',
  'X-Requested-With': 'XMLHttpRequest',
  Origin: BASE_URL,
  Referer: `${BASE_URL}/`,
  Accept: 'application/json',
};

// The login token of the member logged in to `context` (a browser context), read from the
// site's own login cookie. Returns "Bearer …".
async function memberToken(context) {
  const cookie = (await context.cookies(BASE_URL)).find((c) => c.name === 'auth_client__token.local');
  if (!cookie) throw new Error('memberToken: this browser is not logged in (no auth_client__token.local cookie)');
  return decodeURIComponent(cookie.value);
}

// An API client acting as the member logged in to `context`. Call .dispose() when done.
async function customerApi(context) {
  return request.newContext({
    baseURL: API_URL,
    userAgent: devices['Desktop Chrome'].userAgent,
    extraHTTPHeaders: { ...CLIENT_HEADERS, Authorization: await memberToken(context) },
  });
}

// An API client logged in as the test member (MEMBER_EMAIL / MEMBER_PASSWORD) with a session
// of its own: POST user/signin, the call the login form makes. Independent of any browser, so
// it keeps working after a test signs the browser out. Call .dispose() when done.
async function memberApiLogin() {
  const { MEMBER_EMAIL: email, MEMBER_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('memberApiLogin needs MEMBER_EMAIL and MEMBER_PASSWORD in the Playwright .env');
  const options = { baseURL: API_URL, userAgent: devices['Desktop Chrome'].userAgent };

  const login = await request.newContext({ ...options, extraHTTPHeaders: CLIENT_HEADERS });
  let token;
  try {
    const body = await json(await login.post('user/signin', { data: { email, password, remember_me: false } }), 'user/signin');
    token = `Bearer ${body.meta.token}`;
  } finally {
    await login.dispose();
  }
  return request.newContext({ ...options, extraHTTPHeaders: { ...CLIENT_HEADERS, Authorization: token } });
}

async function json(response, what) {
  const body = await response.json();
  if (!response.ok() || body.status !== 'SUCCESS') {
    throw new Error(`${what} failed: HTTP ${response.status()} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

// Number of items in the member's cart.
async function cartItemCount(api) {
  const body = await json(await api.get('cart-items/item-count'), 'cart-items/item-count');
  return Number(body.data.item_count);
}

// Deletes every item in the member's cart. The list comes one page at a time, so it repeats
// until the cart is empty.
async function emptyCart(api) {
  for (let pass = 0; pass < 10; pass++) {
    const body = await json(await api.get('cart-items/get?page=1'), 'cart-items/get');
    const items = body.data.carts.data;
    if (!items.length) return;
    for (const item of items) {
      await json(await api.delete(`cart-items/delete/${item.id}`), `cart-items/delete/${item.id}`);
    }
  }
  throw new Error('emptyCart: the cart still has items after 10 passes');
}

// The member's newest order: { id, number } (id opens /mypage/orders/<id>).
async function newestOrder(api) {
  const body = await json(await api.get('mypage/orders', { params: { page: 1 } }), 'mypage/orders');
  const order = body.data.data[0];
  if (!order) throw new Error('The member account has no orders yet. Run checkout/member-credit-card.spec.js once.');
  return { id: order.id, number: String(order.invoice_no) };
}

module.exports = { customerApi, memberApiLogin, memberToken, cartItemCount, emptyCart, newestOrder };
