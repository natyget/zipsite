const serverless = require('serverless-http');
// Import your Express app
const app = require('../../src/app'); // Adjust path as needed

exports.handler = serverless(app);
