// ================================================================
// api/orders.js   –  Orders API (GET /api/orders, POST /api/orders, PATCH /api/orders/:id)
// ---------------------------------------------------------------
// Uses Prisma + JWT (same helpers as other API files).
// The only change from the previous version is that we now
// include the relation **productListing** (the correct name in the schema)
// instead of the non‑existent `product` field.
// ================================================================

const prisma = require('../lib/prisma');          // adjust path if your lib folder is elsewhere
const { verifyToken } = require('../lib/jwt');
require('dotenv').config();                       // loads PRISMA_DATABASE_URL, JWT secret, etc.

// ---------- Helper to send JSON responses ----------
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// ---------------------------------------------------------------
// Main exported handler – Vercel calls this with (req, res)
// ---------------------------------------------------------------
module.exports = async (req, res) => {
  // ---------- CORS (Vercel already does this, but we keep it safe) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // ---------- Authentication ----------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  const userId = payload.userId;   // same field used throughout the project
  const userRole = payload.role || '';

  // -----------------------------------------------------------------
  // 1️⃣ GET /api/orders → list orders where current user is buyer OR seller
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/orders')) {
    try {
      const orders = await prisma.order.findMany({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }]
        },
        include: {
          // 👉 **IMPORTANT** – use productListing (the name in your schema)
          orderItems: {
            include: {
              productListing: {
                select: {
                  id: true,
                  title: true,
                  pricePerUnit: true,
                  unitOfMeasure: true
                }
              }
            }
          },
          buyer: {
            select: { id: true, email: true, fullName: true }
          },
          seller: {
            select: { id: true, email: true, fullName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Front‑end expects { data: [...] }
      return json(res, { data: orders });
    } catch (e) {
      console.error('[orders GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 2️⃣ POST /api/orders → create a new order (buyer)
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/orders') {
    // ---- Parse request JSON body ------------------------------------
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

    // ---- Basic validation of each order item -----------------------
    for (const it of items) {
      if (!it.productId) return json(res, { error: 'productId missing' }, 400);
      if (!it.quantity || it.quantity <= 0) return json(res, { error: 'invalid quantity' }, 400);
    }

    try {
      // Find the seller (producer) of the **first** product – the UI only creates a single‑product order.
      const firstProd = await prisma.product.findUnique({
        where: { id: Number(items[0].productId) },
        select: { producerId: true }
      });
      if (!firstProd) return json(res, { error: 'Product not found' }, 404);

      const newOrder = await prisma.order.create({
        data: {
          buyerId: userId,
          sellerId: firstProd.producerId,
          orderStatus: 'PENDING',
          totalAmount: 0, // will be calculated below (optional – you can sum here)
          orderItems: {
            create: items.map(it => ({
              productListingId: it.productId, // note: column name is productListingId in DB
              quantityOrdered: Number(it.quantity),
              // pricePerUnitAtOrder and subtotal could be filled here if you want
            }))
          }
        },
        include: {
          orderItems: {
            include: {
              productListing: {
                select: {
                  id: true,
                  title: true,
                  pricePerUnit: true,
                  unitOfMeasure: true
                }
              }
            }
          },
          buyer: true,
          seller: true
        }
      });

      // You could also recalc totalAmount = sum(item.quantity * product.price) … but not required for UI.
      return json(res, { data: newOrder }, 201);
    } catch (e) {
      console.error('[orders POST]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ PATCH /api/orders/:id  → seller confirms order
  // -----------------------------------------------------------------
  if (req.method === 'PATCH' && req.url.match(/^\/api\/orders\/[^/]+$/)) {
    const orderId = req.url.split('/').pop();

    // ---- Parse request JSON body ------------------------------------
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

    // Only the seller (or an ADMIN) may change status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { sellerId: true }
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
                  unitOfMeasure: true
                }
              }
            }
          },
          buyer: true,
          seller: true
        }
      });
      return json(res, { data: updated });
    } catch (e) {
      console.error('[orders PATCH]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
