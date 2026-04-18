// eslint-disable-next-line import/order
const config = require('./config');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const readFile = (location) => (fs.existsSync(location) ? fs.readFileSync(location, 'utf8') : null);
const createServer = (app, keyLocation = '/certs/.key', certLocation = '/certs/.crt') => {
  const keyFile = readFile(keyLocation);
  const certFile = readFile(certLocation);
  return keyFile && certFile
    ? https.createServer({ key: keyFile, cert: certFile }, app)
    : http.createServer(app);
};

const nodeRoot = path.dirname(require.main.filename);
path.join(nodeRoot, 'client', 'public');
const express = require('express');
const logger = require('morgan');

const app = express();
const server = createServer(app);
const cors = require('cors');
const io = require('socket.io')(server, config.socketio);
const session = require('express-session')(config.express);

const appSocket = require('./socket');
const { notfound, handleErrors } = require('./routes');

config.user.username = null;
config.user.password = null;
config.user.privatekey = null;

// safe shutdown
let remainingSeconds = config.safeShutdownDuration;
let shutdownMode = false;
let shutdownInterval;
let connectionCount = 0;

// eslint-disable-next-line consistent-return
function safeShutdownGuard(req, res, next) {
  if (!shutdownMode) return next();
  res.status(503).end('Service unavailable: Server shutting down');
}

// express
app.use(safeShutdownGuard);

const whitelist = [
  'http://localhost:8080',
  'https://localhost:8080',
  'https://hello.aws-dev.choam.de',
  'https://hello.bkahlert.com',
  'https://ssh.de-docker.choam.de',
];
const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (origin && whitelist.indexOf(origin) === -1) {
      callback(new Error(`Access by ${origin} not allowed by CORS`));
    } else {
      callback(null, true);
    }
  },
};
app.use(cors(corsOptions));
app.use(session);
if (config.accesslog) app.use(logger('common'));
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));
app.use(notfound);
app.use(handleErrors);

// clean stop
function stopApp(reason) {
  shutdownMode = false;
  if (reason) console.info(`Stopping: ${reason}`);
  clearInterval(shutdownInterval);
  io.close();
  server.close();
}

// bring up socket
io.on('connection', appSocket);

// socket.io
// expose express session with socket.request.session
io.use((socket, next) => {
  socket.request.res ? session(socket.request, socket.request.res, next) : next(next); // eslint disable-line
});

function countdownTimer() {
  if (!shutdownMode) clearInterval(shutdownInterval);
  remainingSeconds -= 1;
  if (remainingSeconds <= 0) {
    stopApp('Countdown is over');
  } else io.emit('shutdownCountdownUpdate', remainingSeconds);
}

const signals = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) =>
  process.on(signal, () => {
    if (shutdownMode) stopApp('Safe shutdown aborted, force quitting');
    if (!connectionCount > 0) stopApp('All connections ended');
    shutdownMode = true;
    console.error(
      `\r\n${connectionCount} client(s) are still connected.\r\nStarting a ${remainingSeconds} seconds countdown.\r\nPress Ctrl+C again to force quit`
    );
    if (!shutdownInterval) shutdownInterval = setInterval(countdownTimer, 1000);
  })
);

module.exports = { server, config };

const onConnection = (socket) => {
  connectionCount += 1;
  socket.on('disconnect', () => {
    connectionCount -= 1;
    if (connectionCount <= 0 && shutdownMode) {
      stopApp('All clients disconnected');
    }
  });
};

io.on('connection', onConnection);
