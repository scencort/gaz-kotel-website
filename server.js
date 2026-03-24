const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const productsSeed = require('./data/products-seed');

dotenv.config();

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_AUTO_INIT = String(process.env.DB_AUTO_INIT || 'true').toLowerCase() === 'true';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const TRUST_PROXY = String(process.env.TRUST_PROXY || 'false').toLowerCase() === 'true';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_NOTIFY_STATUS_CHANGES = String(process.env.TELEGRAM_NOTIFY_STATUS_CHANGES || 'true').toLowerCase() === 'true';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Use .env file or environment variable.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

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

const schemaSql = fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8');
const rateLimitStore = new Map();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
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
      } catch (_error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function getClientIp(req) {
  if (TRUST_PROXY) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }
  }

  return req.socket.remoteAddress || 'unknown';
}

function isRateLimited(req, keyPrefix) {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  existing.count += 1;
  if (existing.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

function requireAdminAuth(req) {
  if (!ADMIN_API_KEY) {
    return true;
  }

  const incomingKey = req.headers['x-admin-key'];
  return typeof incomingKey === 'string' && incomingKey === ADMIN_API_KEY;
}

function validateOrder(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (!payload.customer || typeof payload.customer !== 'object') return false;
  if (!payload.customer.name || !payload.customer.phone || !payload.customer.email) return false;
  if (!Array.isArray(payload.items) || payload.items.length === 0) return false;
  return true;
}

function mapProductRow(row) {
  return {
    id: row.id,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description || [],
    specs: row.specs || [],
    price: row.price,
    image: row.image,
    isFeatured: row.is_featured
  };
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString('ru-RU') + ' ₽';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatOrderStatusLabel(status) {
  if (status === 'completed') return 'Завершен';
  if (status === 'in-progress') return 'В работе';
  return 'Новый';
}

function formatOrderStatusEmoji(status) {
  if (status === 'completed') return '✅';
  if (status === 'in-progress') return '🛠';
  return '🆕';
}

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${details}`);
  }
}

async function notifyOrderCreated(orderPayload, orderNumber) {
  const customer = orderPayload.customer || {};
  const pricing = orderPayload.pricing || {};
  const lines = (orderPayload.items || []).map((item, index) => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const sum = qty * price;
    return `${index + 1}) <b>${escapeHtml(item.name || 'Товар')}</b>\n   ${qty} шт. x ${formatPrice(price)} = <b>${formatPrice(sum)}</b>`;
  });

  const promoLine = pricing.promoCode
    ? `<b>Промокод:</b> ${escapeHtml(pricing.promoCode)} (${Number(pricing.discountPercent || 0)}%)`
    : '<b>Промокод:</b> —';

  const text = [
    '🧾 <b>Новый заказ с сайта</b>',
    `Номер: <b>#${escapeHtml(orderNumber)}</b>`,
    '',
    '👤 <b>Клиент</b>',
    `• Имя: ${escapeHtml(customer.name)}`,
    `• Телефон: ${escapeHtml(customer.phone)}`,
    `• Email: ${escapeHtml(customer.email)}`,
    customer.telegram ? `• Telegram: ${escapeHtml(customer.telegram)}` : null,
    '',
    '🛒 <b>Состав заказа</b>',
    lines.length ? lines.join('\n') : '• Нет позиций',
    '',
    '💰 <b>Оплата</b>',
    `<b>Товары:</b> ${formatPrice(pricing.subtotal)}`,
    promoLine,
    `<b>Скидка:</b> -${formatPrice(pricing.discount)}`,
    `<b>Доставка:</b> ${Number(pricing.delivery || 0) === 0 ? 'Бесплатно' : formatPrice(pricing.delivery)}`,
    `🏁 <b>Итого к оплате: ${formatPrice(pricing.total)}</b>`
  ].filter(Boolean).join('\n');

  await sendTelegramMessage(text);
}

async function notifyOrderStatusChanged(orderNumber, status) {
  if (!TELEGRAM_NOTIFY_STATUS_CHANGES) {
    return;
  }

  const statusLabel = formatOrderStatusLabel(status);
  const statusEmoji = formatOrderStatusEmoji(status);

  const text = [
    `${statusEmoji} <b>Статус заказа изменен</b>`,
    `Номер: <b>#${escapeHtml(orderNumber)}</b>`,
    `Текущий статус: <b>${escapeHtml(statusLabel)}</b>`
  ].join('\n');

  await sendTelegramMessage(text);
}

async function initDatabase() {
  if (!DB_AUTO_INIT) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSql);

    for (const product of productsSeed) {
      await client.query(
        `
        INSERT INTO products (id, name, short_description, description, specs, price, image, is_featured)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE
        SET
          name = EXCLUDED.name,
          short_description = EXCLUDED.short_description,
          description = EXCLUDED.description,
          specs = EXCLUDED.specs,
          price = EXCLUDED.price,
          image = EXCLUDED.image,
          is_featured = EXCLUDED.is_featured
        `,
        [
          product.id,
          product.name,
          product.shortDescription,
          JSON.stringify(product.description),
          JSON.stringify(product.specs),
          product.price,
          product.image,
          product.isFeatured
        ]
      );
    }

    await client.query(
      `
      INSERT INTO reviews (author, content, rating, is_published)
      SELECT x.author, x.content, x.rating, true
      FROM (VALUES
        ('Алексей, Подмосковье', 'Подобрали котёл под дом 140 м², расход газа стал ниже.', 5),
        ('Марина, Тверь', 'Доставка быстрая, монтаж прошёл без проблем.', 5),
        ('Игорь, Калуга', 'Для производства подошёл отлично, работает стабильно.', 5)
      ) AS x(author, content, rating)
      WHERE NOT EXISTS (SELECT 1 FROM reviews)
      `
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const requestedPath = path.normalize(path.join(ROOT, pathname));
  if (!requestedPath.startsWith(ROOT)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  const relativePath = path.relative(ROOT, requestedPath).replace(/\\/g, '/');
  const blockedPrefixes = ['db/', 'scripts/', 'data/'];
  if (
    relativePath.startsWith('.') ||
    relativePath === 'package.json' ||
    relativePath === 'README.md' ||
    blockedPrefixes.some(prefix => relativePath.startsWith(prefix))
  ) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.stat(requestedPath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendText(res, 404, 'Not Found');
      return;
    }

    const ext = path.extname(requestedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(requestedPath).pipe(res);
  });
}

async function getProducts(req, res, parsedUrl) {
  const featured = parsedUrl.searchParams.get('featured');
  const params = [];
  let where = '';

  if (featured === '1') {
    where = 'WHERE is_featured = $1';
    params.push(true);
  }

  const result = await pool.query(
    `SELECT id, name, short_description, description, specs, price, image, is_featured
     FROM products
     ${where}
     ORDER BY created_at ASC`,
    params
  );

  sendJson(res, 200, result.rows.map(mapProductRow));
}

async function getProductById(res, productId) {
  const result = await pool.query(
    `SELECT id, name, short_description, description, specs, price, image, is_featured
     FROM products
     WHERE id = $1`,
    [productId]
  );

  if (!result.rows.length) {
    sendJson(res, 404, { message: 'Product not found' });
    return;
  }

  sendJson(res, 200, mapProductRow(result.rows[0]));
}

async function createOrder(req, res) {
  if (isRateLimited(req, 'order')) {
    sendJson(res, 429, { message: 'Too many requests. Try again later.' });
    return;
  }

  const payload = await parseBody(req);
  if (!validateOrder(payload)) {
    sendJson(res, 400, { message: 'Invalid order payload' });
    return;
  }

  const orderNumber = payload.orderNumber || Date.now();
  const pricing = payload.pricing || {};
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `
      INSERT INTO orders (
        order_number, customer_name, customer_phone, customer_email, customer_telegram,
        status, promo_code, discount_percent, subtotal, discount, delivery, total
      )
      VALUES ($1, $2, $3, $4, $5, 'new', $6, $7, $8, $9, $10, $11)
      RETURNING id
      `,
      [
        orderNumber,
        payload.customer.name,
        payload.customer.phone,
        payload.customer.email,
        payload.customer.telegram || null,
        pricing.promoCode || null,
        Number(pricing.discountPercent || 0),
        Number(pricing.subtotal || 0),
        Number(pricing.discount || 0),
        Number(pricing.delivery || 0),
        Number(pricing.total || 0)
      ]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of payload.items) {
      await client.query(
        `
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          orderId,
          item.id || null,
          item.name || 'Товар',
          Number(item.price || 0),
          Number(item.quantity || 1)
        ]
      );
    }

    await client.query('COMMIT');
    notifyOrderCreated(payload, orderNumber).catch(error => {
      console.error('Telegram order notification error:', error.message);
    });
    sendJson(res, 200, { message: 'Order accepted', orderNumber: orderNumber });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      sendJson(res, 409, { message: 'Order number already exists' });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getOrders(res) {
  const result = await pool.query(
    `
    SELECT
      o.order_number,
      o.customer_name,
      o.customer_phone,
      o.customer_email,
      o.customer_telegram,
      o.status,
      o.promo_code,
      o.discount_percent,
      o.subtotal,
      o.discount,
      o.delivery,
      o.total,
      o.created_at,
      o.updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.product_id,
            'name', oi.product_name,
            'price', oi.price,
            'quantity', oi.quantity
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) AS items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC
    `
  );

  const mapped = result.rows.map(row => ({
    orderNumber: Number(row.order_number),
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email,
      telegram: row.customer_telegram
    },
    status: row.status,
    pricing: {
      promoCode: row.promo_code,
      discountPercent: row.discount_percent,
      subtotal: row.subtotal,
      discount: row.discount,
      delivery: row.delivery,
      total: row.total
    },
    items: row.items,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  sendJson(res, 200, mapped);
}

async function updateOrderStatus(req, res, orderNumber) {
  const payload = await parseBody(req);
  const allowed = ['new', 'in-progress', 'completed'];
  if (!payload || !allowed.includes(payload.status)) {
    sendJson(res, 400, { message: 'Invalid status' });
    return;
  }

  const result = await pool.query(
    `
    UPDATE orders
    SET status = $1, updated_at = NOW()
    WHERE order_number = $2
    `,
    [payload.status, orderNumber]
  );

  if (!result.rowCount) {
    sendJson(res, 404, { message: 'Order not found' });
    return;
  }

  notifyOrderStatusChanged(orderNumber, payload.status).catch(error => {
    console.error('Telegram status notification error:', error.message);
  });
  sendJson(res, 200, { message: 'Status updated' });
}

async function getFavorites(res, parsedUrl) {
  const clientId = parsedUrl.searchParams.get('clientId');
  if (!clientId) {
    sendJson(res, 400, { message: 'clientId is required' });
    return;
  }

  const result = await pool.query(
    `SELECT product_id FROM favorites WHERE client_id = $1 ORDER BY created_at DESC`,
    [clientId]
  );

  sendJson(res, 200, result.rows.map(row => row.product_id));
}

async function addFavorite(req, res) {
  const payload = await parseBody(req);
  if (!payload.clientId || !payload.productId) {
    sendJson(res, 400, { message: 'clientId and productId are required' });
    return;
  }

  await pool.query(
    `
    INSERT INTO favorites (client_id, product_id)
    VALUES ($1, $2)
    ON CONFLICT (client_id, product_id) DO NOTHING
    `,
    [payload.clientId, payload.productId]
  );

  sendJson(res, 200, { message: 'Favorite saved' });
}

async function removeFavorite(res, parsedUrl, productId) {
  const clientId = parsedUrl.searchParams.get('clientId');
  if (!clientId) {
    sendJson(res, 400, { message: 'clientId is required' });
    return;
  }

  await pool.query(
    `DELETE FROM favorites WHERE client_id = $1 AND product_id = $2`,
    [clientId, productId]
  );

  sendJson(res, 200, { message: 'Favorite removed' });
}

async function createContactMessage(req, res) {
  if (isRateLimited(req, 'contact')) {
    sendJson(res, 429, { message: 'Too many requests. Try again later.' });
    return;
  }

  const payload = await parseBody(req);
  if (!payload.name || !payload.phone || !payload.message) {
    sendJson(res, 400, { message: 'name, phone and message are required' });
    return;
  }

  await pool.query(
    `
    INSERT INTO contact_messages (name, phone, email, message)
    VALUES ($1, $2, $3, $4)
    `,
    [payload.name, payload.phone, payload.email || null, payload.message]
  );

  sendJson(res, 200, { message: 'Message accepted' });
}

async function getReviews(res, parsedUrl) {
  const limit = Math.min(Number(parsedUrl.searchParams.get('limit') || 10), 30);
  const result = await pool.query(
    `
    SELECT author, content, rating, created_at
    FROM reviews
    WHERE is_published = TRUE
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  sendJson(res, 200, result.rows);
}

async function createReview(req, res) {
  if (isRateLimited(req, 'review')) {
    sendJson(res, 429, { message: 'Too many requests. Try again later.' });
    return;
  }

  const payload = await parseBody(req);
  const rating = Number(payload.rating);
  if (!payload.author || !payload.content || rating < 1 || rating > 5) {
    sendJson(res, 400, { message: 'Invalid review payload' });
    return;
  }

  await pool.query(
    `
    INSERT INTO reviews (author, content, rating, is_published)
    VALUES ($1, $2, $3, TRUE)
    `,
    [payload.author, payload.content, rating]
  );

  sendJson(res, 201, { message: 'Review created' });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && parsedUrl.pathname === '/api/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/products') {
      await getProducts(req, res, parsedUrl);
      return;
    }

    if (req.method === 'GET' && /^\/api\/products\/[^/]+$/.test(parsedUrl.pathname)) {
      const match = parsedUrl.pathname.match(/^\/api\/products\/([^/]+)$/);
      const productId = match ? decodeURIComponent(match[1]) : '';
      await getProductById(res, productId);
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/orders') {
      if (!requireAdminAuth(req)) {
        sendJson(res, 401, { message: 'Unauthorized' });
        return;
      }

      await getOrders(res);
      return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/api/orders') {
      await createOrder(req, res);
      return;
    }

    if (req.method === 'PATCH' && /^\/api\/orders\/[^/]+\/status$/.test(parsedUrl.pathname)) {
      if (!requireAdminAuth(req)) {
        sendJson(res, 401, { message: 'Unauthorized' });
        return;
      }

      const match = parsedUrl.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
      const orderNumber = match ? Number(decodeURIComponent(match[1])) : NaN;
      if (!Number.isFinite(orderNumber)) {
        sendJson(res, 400, { message: 'Invalid order number' });
        return;
      }

      await updateOrderStatus(req, res, orderNumber);
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/favorites') {
      await getFavorites(res, parsedUrl);
      return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/api/favorites') {
      await addFavorite(req, res);
      return;
    }

    if (req.method === 'DELETE' && /^\/api\/favorites\/[^/]+$/.test(parsedUrl.pathname)) {
      const match = parsedUrl.pathname.match(/^\/api\/favorites\/([^/]+)$/);
      const productId = match ? decodeURIComponent(match[1]) : '';
      await removeFavorite(res, parsedUrl, productId);
      return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/api/contacts') {
      await createContactMessage(req, res);
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/reviews') {
      await getReviews(res, parsedUrl);
      return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/api/reviews') {
      await createReview(req, res);
      return;
    }

    if (req.method === 'GET') {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { message: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    sendJson(res, 500, { message: 'Internal server error' });
  }
});

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  });
