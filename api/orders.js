// ==== api/orders.js ====================================================
// Orders API – pure Node + Prisma, no compilation needed.
// ---------------------------------------------------------------
// Expected routes (handled by the catch‑all `[...slug].js`):
//   GET    /api/orders                → list orders for logged‑in user
//   POST   /api/orders                → create a new order (buyer)
//   PATCH  /api/orders/:orderId       → update order status (seller only)
// ---------------------------------------------------------------

const prisma = require('../lib/prisma');          // <-- adjust path if lib is elsewhere
const { verifyToken } = require('../lib/jwt');    // same as other API files
require('dotenv').config();                       // loads .env (DB URL, JWT secret …)

// Helper: send JSON with proper headers
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// ---------- Main exported handler ----------
module.exports = async (req, res) => {
  // ---- CORS (the outer catch‑all already does this, but we keep it for safety) ----
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // ---- Authentication ---------------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  const userId = payload.userId;           // <-- whatever your JWT contains
  const userRole = payload.role || '';     // may be useful later (ADMIN, PRODUCER …)

  // -------------------------------------------------------------------------
  // 1️⃣ GET /api/orders  → return orders where current user is buyer OR seller
  // -------------------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/orders')) {
    try {
      const orders = await prisma.order.findMany({
        where: {
          OR: [
            { buyerId: userId },
            { sellerId: userId }
          ]
        },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  pricePerUnit: true,
                  unitOfMeasure: true
                }
              }
            }
          },
          buyer:   { select: { id: true, email: true, fullName: true } },
          seller:  { select: { id: true, email: true, fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // The front‑end expects the shape: { data: [...] }
      return json(res, { data: orders });
    } catch (e) {
      console.error('[orders GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // 2️⃣ POST /api/orders  → create a new order (buyer)
  // -------------------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/orders') {
    // ---- parse JSON body ----------------------------------------------------
    let body;
    try {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => (raw += chunk));
        req.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
        req.on('error', reject);
      });
    } catch (e) {
      return json(res, { error: 'Invalid JSON body' }, 400);
    }

    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return json(res, { error: 'items array required' }, 400);
    }

    // ---- Validate each item (basic) ----------------------------------------
    for (const it of items) {
      if (!it.productId) return json(res, { error: 'productId missing' }, 400);
      if (!it.quantity || it.quantity <= 0) return json(res, { error: 'invalid quantity' }, 400);
    }

    try {
      // The product’s producer becomes the **seller** of the order.
      // We fetch the first item's product to discover the seller.
      const firstProduct = await prisma.product.findUnique({
        where: { id: Number(items[0].productId) },
        select: { producerId: true }
      });
      if (!firstProduct) return json(res, { error: 'Product not found' }, 404);

      const newOrder = await prisma.order.create({
        data: {
          buyerId: userId,
          sellerId: firstProduct.producerId,
          orderStatus: 'PENDING',
          orderItems: {
            create: items.map(it => ({
              productId: Number(it.productId),
              quantityOrdered: Number(it.quantity)
            }))
          }
        },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  pricePerUnit: true,
                  unitOfMeasure: true
                }
              }
            }
          },
          buyer:  true,
          seller: true
        }
      });

      return json(res, { data: newOrder }, 201);
    } catch (e) {
      console.error('[orders POST]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // 3️⃣ PATCH /api/orders/:id   → seller confirms order
  // -------------------------------------------------------------------------
  if (req.method === 'PATCH' && req.url.match(/^\/api\/orders\/[^/]+$/)) {
    const orderId = req.url.split('/').pop(); // string

    // ---- parse JSON body ----------------------------------------------------
    let body;
    try {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => (raw += chunk));
        req.on('end', () => resolve(JSON.parse(raw)));
        req.on('error', reject);
      });
    } catch (e) {
      return json(res, { error: 'Invalid JSON body' }, 400);
    }

    // Only the **seller** (or an ADMIN) may change status
    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      select: { sellerId: true }
    });
    if (!order) return json(res, { error: 'Order not found' }, 404);
    if (order.sellerId !== userId && userRole !== 'ADMIN') {
      return json(res, { error: 'Not authorized' }, 403);
    }

    // Currently the UI only ever sends { orderStatus: "CONFIRMED" }
    const newStatus = body.orderStatus;
    if (!newStatus) return json(res, { error: 'orderStatus required' }, 400);

    try {
      const updated = await prisma.order.update({
        where: { id: Number(orderId) },
        data: { orderStatus: newStatus },
        include: {
          orderItems: {
            include: {
              product: {
                select: { id: true, title: true, pricePerUnit: true, unitOfMeasure: true }
              }
            }
          },
          buyer:  true,
          seller: true
        }
      });
      return json(res, { data: updated });
    } catch (e) {
      console.error('[orders PATCH]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -------------------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
