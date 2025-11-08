const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');

require('dotenv').config();

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const { page = 1, limit = 20, q } = req.query;

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
        status = 'Active'
      } = req.body || {};

      const price = Number(req.body.price);
      const quantity = Number(req.body.quantity);

      if (!name) return res.status(400).json({ error: 'name required' });
      if (isNaN(price)) return res.status(400).json({ error: 'invalid price' });
      if (isNaN(quantity)) return res.status(400).json({ error: 'invalid quantity' });

      const product = await prisma.productListing.create({
        data: {
          title: name,
          description,
          category,
          pricePerUnit: price,
          quantityAvailable: quantity,
          unitOfMeasure: unit,
          producerId: payload.userId,
          status
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
