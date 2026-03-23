const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const ORDERS_FILE = path.join(ROOT, 'orders.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function validateOrder(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.orderNumber !== 'number') return false;
  if (!payload.customer || typeof payload.customer !== 'object') return false;
  if (!payload.customer.name || !payload.customer.phone || !payload.customer.email) return false;
  if (!Array.isArray(payload.items) || payload.items.length === 0) return false;
  return true;
}

function appendOrder(order) {
  const existing = readOrders();

  existing.push({
    ...order,
    status: 'new',
    createdAt: new Date().toISOString()
  });

  writeOrders(existing);
}

function readOrders() {
  let existing = [];
  if (fs.existsSync(ORDERS_FILE)) {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8').trim();
    if (raw) {
      try {
        existing = JSON.parse(raw);
      } catch {
        existing = [];
      }
    }
  }

  return existing;
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

function updateOrderStatus(orderNumber, status) {
  const orders = readOrders();
  const order = orders.find(item => String(item.orderNumber) === String(orderNumber));

  if (!order) {
    return false;
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();

  writeOrders(orders);
  return true;
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const requestedPath = path.normalize(path.join(ROOT, pathname));
  if (!requestedPath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(requestedPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(requestedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(requestedPath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && parsedUrl.pathname === '/api/orders') {
    const orders = readOrders().sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    sendJson(res, 200, orders);
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/orders') {
    try {
      const payload = await parseBody(req);
      if (!validateOrder(payload)) {
        sendJson(res, 400, { message: 'Invalid order payload' });
        return;
      }

      appendOrder(payload);
      sendJson(res, 200, { message: 'Order accepted' });
    } catch (error) {
      sendJson(res, 400, { message: error.message });
    }
    return;
  }

  if (req.method === 'PATCH' && /^\/api\/orders\/[^/]+\/status$/.test(parsedUrl.pathname)) {
    try {
      const payload = await parseBody(req);
      const allowed = ['new', 'in-progress', 'completed'];
      if (!payload || !allowed.includes(payload.status)) {
        sendJson(res, 400, { message: 'Invalid status' });
        return;
      }

      const match = parsedUrl.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
      const orderNumber = match ? decodeURIComponent(match[1]) : '';
      const updated = updateOrderStatus(orderNumber, payload.status);
      if (!updated) {
        sendJson(res, 404, { message: 'Order not found' });
        return;
      }

      sendJson(res, 200, { message: 'Status updated' });
    } catch (error) {
      sendJson(res, 400, { message: error.message });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { message: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
