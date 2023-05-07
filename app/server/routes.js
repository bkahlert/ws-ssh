/* eslint-disable no-console */
// ssh.js

const config = require('./config');

exports.connect = function connect(req, res) {
  const { host, port } = config.ssh;
  const { term: sshterm, readyTimeout } = config.ssh;
  req.session.ssh = {
    host,
    port,
    localAddress: config.ssh.localAddress,
    localPort: config.ssh.localPort,
    algorithms: config.algorithms,
    keepaliveInterval: config.ssh.keepaliveInterval,
    keepaliveCountMax: config.ssh.keepaliveCountMax,
    allowedSubnets: config.ssh.allowedSubnets,
    term: sshterm,
    serverlog: {
      client: config.serverlog.client || false,
      server: config.serverlog.server || false,
    },
    readyTimeout,
  };
};

exports.notfound = function notfound(_req, res) {
  res.status(404).send("Sorry, can't find that!");
};

exports.handleErrors = function handleErrors(err, _req, res) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
};
