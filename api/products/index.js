const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');

require('dotenv').config();

// GET /api/products -> list
// POST /api/products -> create (requires Authorization: Bearer <token>)
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const { page = 1, limit = 20, q } = req.query;
      const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {};
      const products = await prisma.product.findMany({
        where,
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ data: products });
    }

    if (req.method === 'POST') {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
      if (!token) return res.status(401).json({ error: 'Missing token' });

      let payload;
      try {
        payload = verifyToken(token);
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Only allow producers or admin to create products
      if (!['ADMIN', 'PRODUCER', 'FACILITY_OWNER'].includes(payload.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { name, description, price = 0, quantity = 0, facilityId } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name required' });

      const product = await prisma.product.create({
        data: { name, description, price: Number(price), quantity: Number(quantity), facilityId: facilityId || undefined },
      });

      return res.status(201).json({ data: product });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};