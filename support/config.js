// Shared URLs, read from the environment (.env). Mirrors cypress/support/config.js.
const BASE_URL = process.env.BASE_URL || 'https://dev.singaprinting.com';
const ADMIN_URL = process.env.ADMIN_URL || 'https://dev-admin-panel.singaprinting.com';
// The API both sites call (Frontend/.env API_URL). Ends with a slash: paths are appended to it.
const API_URL = process.env.API_URL || 'https://dev-api.singaprinting.com/index.php/api/';

module.exports = { BASE_URL, ADMIN_URL, API_URL };
