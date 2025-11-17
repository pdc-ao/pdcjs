/**
 * Orders API – pure‑JS, no DB, works on Vercel serverless.
 * Exported as a CommonJS function (module.exports = async (req, res) => …)
 * The catch‑all resolver will call this file for:
 *   GET    /api/orders
 *   POST   /api/orders
 *   PATCH  /api/orders/:id
 *
 * The file keeps the order list in memory (fast) and optionally seeds it
 * from archived-api/data/orders.json when the function first runs.
 */

const fs = require('fs');
const path = require('path');

// ---------- Load seed data (once per container) ----------
let orders = [];
const seedPath = path.join(__dirname, 'data', 'orders.json');

try {
  const raw = fs.readFileSync(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed.orders)) orders = parsed.orders;
  console.log('[orders] loaded', orders.length, 'seed orders');
} catch (e) {
  // If the file does not exist, we just start with an empty array.
  console.log('[orders] no seed file – starting empty');
}

// ---------- Helper utilities ----------
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// Simple UUID generator (good enough for demo)
function makeId() {
  return 'order-' + Math.random().toString(36).substr(2, 9);
}

// ---------- Main exported handler ----------
module.exports = async function (req, res) {
  // Enable CORS (the catch‑all already does it, but local testing may hit this directly)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.end();
  }

  // -----------------------------------------------------------------
  // 1️⃣ GET /api/orders   → return all orders (data field required)
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/orders')) {
    return json(res, { data: orders });
  }

  // -----------------------------------------------------------------
  // 2️⃣ POST /api/orders  → create a new order
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/orders') {
    let body;
    try {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => (raw += chunk));
        req.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', reject);
      });
    } catch (e) {
      return json(res, { error: 'Invalid JSON' }, 400);
    }

    // Basic validation – the front‑end only sends `items`
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return json(res, { error: 'Missing order items' }, 400);
    }

    // Build a minimal order structure that the UI can read
    const newOrder = {
      id: makeId(),
      buyerId: req.headers.authorization?.split(' ')[1] ? getUserIdFromToken(req.headers.authorization) : null,
      // The seller is inferred from the product – for the demo we just pick a dummy
      sellerId: 'seller-dummy',
      orderStatus: 'PENDING',
      orderItems: body.items.map(it => ({
        productId: it.productId,
        quantityOrdered: it.quantity,
        // The UI expects a nested `productListing.title`. Since we don’t have a DB,
        // we’ll just put a placeholder.
        productListing: { title: `Produto ${it.productId}` }
      }))
    };

    orders.push(newOrder);
    return json(res, { data: newOrder }, 201);
  }

  // -----------------------------------------------------------------
  // 3️⃣ PATCH /api/orders/:id  → update status (only “CONFIRMED” is used)
  // -----------------------------------------------------------------
  if (req.method === 'PATCH' && req.url.match(/^\/api\/orders\/[^/]+$/)) {
    const id = req.url.split('/').pop();

    let body;
    try {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => (raw += chunk));
        req.on('end', () => resolve(JSON.parse(raw)));
        req.on('error', reject);
      });
    } catch (e) {
      return json(res, { error: 'Invalid JSON' }, 400);
    }

    const order = orders.find(o => o.id === id);
    if (!order) return json(res, { error: 'Order not found' }, 404);

    if (body.orderStatus) order.orderStatus = body.orderStatus;
    return json(res, { data: order });
  }

  // -----------------------------------------------------------------
  // Anything else → 404
  // -----------------------------------------------------------------
  return json(res, { error: 'Not found' }, 404);
};

/**
 * Very tiny helper: the demo stores the JWT token in localStorage
 * but we have no real verification. We just decode the payload
 * (the token is a plain string “user‑<id>” in the demo data).
 *
 * If you use a real JWT you can replace this with a proper verification.
 */
function getUserIdFromToken(authHeader) {
  // Expected format: "Bearer user-abc" (the demo stores just the id)
  const parts = authHeader.split(' ');
  if (parts.length === 2) return parts[1];
  return null;
}