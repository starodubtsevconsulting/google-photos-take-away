#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const repoRoot = path.resolve(root, '..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const stateDir = path.join(repoRoot, '.state');
const stateFile = path.join(stateDir, 'state.json');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2), 'application/json; charset=utf-8');
}

function readState() {
  if (!fs.existsSync(stateFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(data) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/state' && req.method === 'GET') {
    sendJson(res, 200, readState());
    return;
  }

  if (req.url === '/api/state' && req.method === 'PUT') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        writeState(parsed);
        sendJson(res, 200, { ok: true });
      } catch {
        sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (req.url === '/api/state' && req.method === 'DELETE') {
    try {
      if (fs.existsSync(stateFile)) {
        fs.rmSync(stateFile, { force: true });
      }
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 500, { ok: false, error: 'Failed to reset state' });
    }
    return;
  }

  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const safePath = path.normalize(urlPath).replace(/^\/+/, '');
  let filePath = path.join(root, safePath || 'index.html');

  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, 'Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = contentTypes[ext] || 'application/octet-stream';
  fs.createReadStream(filePath)
    .on('error', () => send(res, 500, 'Internal Server Error'))
    .pipe(res.writeHead(200, { 'Content-Type': type }));
});

server.listen(port, host, () => {
  process.stdout.write(`UI server running at http://${host}:${port}\n`);
});
