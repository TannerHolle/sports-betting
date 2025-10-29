// Entry point for Render deployment
// This file simply requires and starts the backend server

const path = require('path');

// Change to the backend directory and require the server
process.chdir(path.join(__dirname, 'backend'));

// Now require and start the server
require('./server.js');
