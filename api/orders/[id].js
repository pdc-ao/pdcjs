const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');

require('dotenv').config();

module.exports = async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing order ID' });

    if (req.method === 'GET') {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          orderItems: {
            include: {
              productListing: true
            }
          },
          buyer: true,
          seller: true,
          transporter: true,
          transportListing: true,
          storage: true,
          statusHistory: true,
          preOrder: true
        }
      });

      if (!order) return res.status(404).json({ error: 'Order not found' });

      const isAuthorized =
        payload.role === 'ADMIN' ||
        [order.buyerId, order.sellerId, order.transporterId].includes(payload.userId);

      if (!isAuthorized) return res.status(403).json({ error: 'Access denied' });

      return res.json({ data: order });
    }

    if (req.method === 'PATCH') {
      const { orderStatus } = req.body;
      if (!orderStatus) return res.status(400).json({ error: 'Missing orderStatus' });

      const updated = await prisma.order.update({
        where: { id },
        data: { orderStatus },
        include: {
          orderItems: true
        }
      });

      return res.json({ data: updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[ORDER ID API]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
