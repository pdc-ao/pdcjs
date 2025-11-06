const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');

require('dotenv').config();

// GET /api/products -> list (public preview or authenticated search)
// POST /api/products -> create (requires Authorization: Bearer <token>)
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const { page = 1, limit = 20, q } = req.query;

      // Try to read token (optional for GET)
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
      let payload = null;
      if (token) {
        try {
          payload = verifyToken(token);
        } catch {
          // ignore invalid token for GET
        }
      }

      // Only allow search if authenticated
      const where =
        payload && q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {};

      const products = await prisma.productListing.findMany({
        where,
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
        orderBy: { createdAt: 'desc' },
      });

      return res.json({ data: products });
    }

    if (req.method === 'POST') {
      // Require token for publishing
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
      if (!token) return res.status(401).json({ error: 'Missing token' });

      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Only allow producers or admin to create products
      if (!['ADMIN', 'PRODUCER'].includes(payload.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const {
        name,
        description,
        price = 0,
        quantity = 0,
        unit = 'kg',
        category = 'general',
      } = req.body || {};

      if (!name) return res.status(400).json({ error: 'name required' });

      const product = await prisma.productListing.create({
        data: {
          title: name,
          description,
          category,
          pricePerUnit: Number(price),
          quantityAvailable: Number(quantity),
          unitOfMeasure: unit,
          producerId: payload.userId, // assumes JWT payload includes userId
        },
      });

      return res.status(201).json({ data: product });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[PRODUCTS API]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
