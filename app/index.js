/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/* jshint esversion: 6, asi: true, node: true */

const { config } = require('./server/app');
const { server } = require('./server/app');

server.listen({ host: config.listen.ip, port: config.listen.port });

// eslint-disable-next-line no-console
console.log(`ws-ssh service listening on ${config.listen.ip}:${config.listen.port}`);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    config.listen.port += 1;
    console.warn(`ws-ssh Address in use, retrying on port ${config.listen.port}`);
    setTimeout(() => {
      server.listen(config.listen.port);
    }, 250);
  } else {
    // eslint-disable-next-line no-console
    console.log(`ws-ssh server.listen ERROR: ${err.code}`);
  }
});
