const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');

require('dotenv').config();

// POST /api/orders -> create order for authenticated user
// GET /api/orders -> list orders for authenticated user (admins can list all with ?all=1)
module.exports = async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (req.method === 'POST') {
      const { items = [] } = req.body || {};
      if (!items.length) return res.status(400).json({ error: 'items required' });

      // Calculate total, validate products exist
      const productIds = items.map((i) => i.productId);
      const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

      const productMap = new Map(products.map((p) => [p.id, p]));
      let total = 0;
      const orderItemsData = items.map((it) => {
        const prod = productMap.get(it.productId);
        if (!prod) throw new Error(`Product ${it.productId} not found`);
        const qty = Number(it.quantity || 1);
        const price = Number(prod.price);
        total += qty * price;
        return {
          product: { connect: { id: prod.id } },
          quantity: qty,
          price,
        };
      });

      const order = await prisma.order.create({
        data: {
          user: { connect: { id: payload.userId } },
          total,
          items: { create: orderItemsData },
        },
        include: { items: true },
      });

      return res.status(201).json({ data: order });
    }

    if (req.method === 'GET') {
      const { all } = req.query;
      const where = all === '1' && payload.role === 'ADMIN' ? {} : { userId: payload.userId };
      const orders = await prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' } });
      return res.json({ data: orders });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};