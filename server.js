// Startup file for cPanel "Setup Node.js App" (Phusion Passenger).
// cPanel runs this file; it starts the already-built Next.js site.
process.env.NODE_ENV = "production";

const { createServer } = require("http");
const next = require("next");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();
const port = Number(process.env.PORT) || 3000;

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`HBA free tickets running on port ${port}`);
  });
});
