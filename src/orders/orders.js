// ================================================================
// api/orders.js – Orders API (GET /api/orders, POST /api/orders, PATCH /api/orders/:id)
// ---------------------------------------------------------------
// GET:
//   • If query string contains ?buyerId=… → return a **plain array** of orders
//   • If query string contains ?sellerId=… → return a **plain array** (not used yet)
//   • Otherwise (no filter) → return the original { data: [...] } shape
// POST & PATCH stay unchanged.
// ================================================================

const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');
require('dotenv').config(); // loads JWT secret, DB URL, etc.

// ---------- tiny JSON helper (identical to transformation.js) ----------
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Main exported handler – Vercel calls it with (req, res)
// ---------------------------------------------------------------------------
module.exports = async (req, res) => {
  // -------------------------------------------------
  // CORS (kept for safety – global catch‑all also adds it)
  // -------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // 1️⃣ Authenticate – same flow as all other API files
  // -------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  const userId = payload.userId;   // the logged‑in user
  const userRole = payload.role || '';

  // -------------------------------------------------
  // 2️⃣ GET – list orders (filterable)
  // -------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/orders')) {
    // ---- Parse query string -------------------------------------------------
    const urlObj   = new URL(req.url, `http://${req.headers.host}`);
    const buyerId  = urlObj.searchParams.get('buyerId');
    const sellerId = urlObj.searchParams.get('sellerId');

    // Build Prisma “where” clause based on the query parameters.
    //   • buyerId  → only orders where the user is the buyer
    //   • sellerId → only orders where the user is the seller
    //   • none     → default behaviour – orders where the user is buyer OR seller
    let where;
    if (buyerId) {
      where = { buyerId };
    } else if (sellerId) {
      where = { sellerId };
    } else {
      where = { OR: [{ buyerId: userId }, { sellerId: userId }] };
    }

    try {
      const orders = await prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              productListing: {
                select: {
                  id: true,
                  title: true,
                  pricePerUnit: true,
                  unitOfMeasure: true,
                },
              },
            },
          },
          buyer:  { select: { id: true, email: true, fullName: true } },
          seller: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // ------- RESPONSE SHAPE -------
      // If the request explicitly asked for a buyerId (the consumer page) we
      // return a **plain array** – the front‑end does `Array.isArray(orders)`.
      // All other callers (e.g. dashboard‑orders) expect the historic
      // `{ data: [...] }` shape, so we keep it for them.
      if (buyerId) {
        return json(res, orders);                 // → [] or [{…}]
      }
      // default – keep historic wrapper
      return json(res, { data: orders });
    } catch (e) {
      console.error('[orders GET] →', e);
      return json(res, { error: 'Server error while fetching orders' }, 500);
    }
  }

  // -------------------------------------------------
  // 3️⃣ POST – create a new order (buyer)
  // -------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/orders') {
    // ---------- Parse body ----------
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

    // ---------- Validate each item ----------
    for (const it of items) {
      if (!it.productId) return json(res, { error: 'productId missing' }, 400);
      if (!it.quantity || it.quantity <= 0) return json(res, { error: 'invalid quantity' }, 400);
    }

    try {
      // Find the seller (producer) of the **first** product – UI creates a single‑product order.
      const firstProd = await prisma.product.findUnique({
        where: { id: Number(items[0].productId) },
        select: { producerId: true },
      });
      if (!firstProd) return json(res, { error: 'Product not found' }, 404);

      const newOrder = await prisma.order.create({
        data: {
          buyerId: userId,
          sellerId: firstProd.producerId,
          orderStatus: 'PENDING',
          totalAmount: 0, // optional – you could compute it here
          orderItems: {
            create: items.map(it => ({
              productListingId: it.productId,
              quantityOrdered: Number(it.quantity),
            })),
          },
        },
        include: {
          orderItems: {
            include: {
              productListing: {
                select: {
                  id: true,
                  title: true,
                  pricePerUnit: true,
                  unitOfMeasure: true,
                },
              },
            },
          },
          buyer: true,
          seller: true,
        },
      });

      return json(res, { data: newOrder }, 201);
    } catch (e) {
      console.error('[orders POST] →', e);
      return json(res, { error: 'Server error while creating order' }, 500);
    }
  }

  // -------------------------------------------------
  // 4️⃣ PATCH – seller confirms order
  // -------------------------------------------------
  if (req.method === 'PATCH' && req.url.match(/^\/api\/orders\/[^/]+$/)) {
    const orderId = req.url.split('/').pop();

    // ---------- Parse body ----------
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

    // ---------- Authorisation ----------
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { sellerId: true },
    });
    if (!order) return json(res, { error: 'Order not found' }, 404);
    if (order.sellerId !== userId && userRole !== 'ADMIN') {
      return json(res, { error: 'Not authorized' }, 403);
    }

    const newStatus = body.orderStatus;
    if (!newStatus) return json(res, { error: 'orderStatus required' }, 400);

    try {
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { orderStatus: newStatus },
        include: {
          orderItems: {
            include: {
              productListing: {
                select: {
                  id: true,
                  title: true,
                  pricePerUnit: true,
                  unitOfMeasure: true,
                },
              },
            },
          },
          buyer: true,
          seller: true,
        },
      });
      return json(res, { data: updated });
    } catch (e) {
      console.error('[orders PATCH] →', e);
      return json(res, { error: 'Server error while updating order' }, 500);
    }
  }

  // -------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
