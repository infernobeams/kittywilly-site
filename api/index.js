// Vercel serverless adapter. server.js exports the Express app and skips
// binding ports when it is required rather than run directly.
const app = require('../server');

module.exports = app;
