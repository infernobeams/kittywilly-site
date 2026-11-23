// Local entry point. Vercel uses api/index.js instead.
//
// server.js only binds a port when it is the process entry, so requiring it
// here used to start nothing and `npm start` exited 0. The listen block is
// exported as app.start() and called explicitly.
const app = require('./server');

if (!process.env.VERCEL) {
    app.start();
}

module.exports = app;
