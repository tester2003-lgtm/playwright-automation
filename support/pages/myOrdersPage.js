// Page object for My Page → My Orders (/mypage/orders): the member's order list.
// Based on pages/mypage/orders/ in the storefront repo (../Frontend).

const { expect } = require('@playwright/test');

class MyOrdersPage {
  constructor(page) {
    this.page = page;
    this.rows = page.locator('.order_list_row');
  }

  async goto() {
    await this.page.goto('/mypage/orders');
    await expect(this.rows.first()).toBeVisible({ timeout: 30_000 });
  }

  orderNumber(row) {
    return row.locator('.order_number_column');
  }

  date(row) {
    return row.locator('.order_date_column');
  }

  total(row) {
    return row.locator('.order_total_price_column');
  }

  status(row) {
    return row.locator('.order_status_column .order_list_status');
  }

  // The link that opens the order's page (/mypage/orders/<order id>).
  detailsLink(row) {
    return row.locator('.order_print_columns a.quote_action');
  }
}

module.exports = { MyOrdersPage };
