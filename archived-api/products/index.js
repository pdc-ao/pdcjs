// ================================================================
// api/products/index.js – Product Listing API
// ---------------------------------------------------------------
// GET  → list products (optional search, pagination, **producerId** filter)
// POST → create a new product (restricted to ADMIN / PRODUCER)
// ================================================================

const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');

require('dotenv').config();

module.exports = async (req, res) => {
  try {
    // -----------------------------------------------------------------
    // 1️⃣ GET – list products (public, optional auth for search)
    // -----------------------------------------------------------------
    if (req.method === 'GET') {
      const {
        page = 1,
        limit = 20,
        q,
        producerId,                // ← NEW – filter by owner when supplied
      } = req.query;

      // ---- Optional auth (allows private search) --------------------
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
      let payload = null;
      if (token) {
        try {
          payload = verifyToken(token);
        } catch {
          // ignore an invalid token – we still serve public rows
        }
      }

      // ---- Build the Prisma `where` clause -------------------------
      // Search text (only when we have a valid token – same as before)
      const searchWhere = payload && q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {};

      // NEW – if a producerId is supplied we narrow the results to that user
      const producerWhere = producerId ? { producerId } : {};

      // Merge both objects (empty objects are harmless)
      const where = { ...searchWhere, ...producerWhere };

      // ---- Execute the query ----------------------------------------
      const products = await prisma.productListing.findMany({
        where,
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
        orderBy: { createdAt: 'desc' },
      });

      // Keep the exact shape the UI expects
      return res.json({ data: products });
    }

    // -----------------------------------------------------------------
    // 2️⃣ POST – create a new product (auth‑required)
    // -----------------------------------------------------------------
    if (req.method === 'POST') {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
      if (!token) return res.status(401).json({ error: 'Missing token' });

      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }

      if (!['ADMIN', 'PRODUCER'].includes(payload.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const {
        name,
        description,
        unit = 'kg',
        category = 'general',
        status = 'Active',
      } = req.body || {};

      const price = Number(req.body.price);
      const quantity = Number(req.body.quantity);

      if (!name) return res.status(400).json({ error: 'name required' });
      if (isNaN(price) || price <= 0) return res.status(400).json({ error: 'invalid price' });
      if (isNaN(quantity) || quantity < 0) return res.status(400).json({ error: 'invalid quantity' });

      const product = await prisma.productListing.create({
        data: {
          title: name,
          description,
          category,
          pricePerUnit: price,
          quantityAvailable: quantity,
          unitOfMeasure: unit,
          producerId: payload.userId,   // ← owner of the listing
          status,
        },
      });

      return res.status(201).json({ data: product });
    }

    // -----------------------------------------------------------------
    // Anything else → 405 Method Not Allowed
    // -----------------------------------------------------------------
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[PRODUCTS API]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
