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
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // -------------------------------------------------
    // POST – create a new order
    // -------------------------------------------------
    if (req.method === 'POST') {
      const { items = [] } = req.body || {};
      if (!items.length) return res.status(400).json({ error: 'items required' });

      const productIds = items.map((i) => i.productId);
      const products = await prisma.productListing.findMany({
        where: { id: { in: productIds } }
      });

      const productMap = new Map(products.map((p) => [p.id, p]));
      let total = 0;

      const orderItemsData = items.map((it) => {
        const prod = productMap.get(it.productId);
        if (!prod) throw new Error(`Product ${it.productId} not found`);
        const qty = Number(it.quantity || 1);
        const price = Number(prod.pricePerUnit);
        const subtotal = qty * price;
        total += subtotal;
        return {
          productListing: { connect: { id: prod.id } },
          quantityOrdered: qty,
          pricePerUnitAtOrder: price,
          subtotal
        };
      });

      const order = await prisma.order.create({
        data: {
          buyer: { connect: { id: payload.userId } },
          seller: { connect: { id: products[0].producerId } }, // assumes all items from same seller
          totalAmount: total,
          currency: 'AOA',
          orderStatus: 'PENDING',
          paymentStatus: 'PENDING',
          shippingAddressLine1: 'Rua Principal',
          shippingCity: 'Luanda',
          shippingPostalCode: '1000',
          shippingCountry: 'Angola',
          orderItems: { create: orderItemsData }   // ✅ corrected relation
        },
        include: { orderItems: true }              // ✅ corrected relation
      });

      return res.status(201).json({ data: order });
    }

    // -------------------------------------------------
    // GET – list orders
    // -------------------------------------------------
    if (req.method === 'GET') {
      const { all } = req.query;

      const where =
        all === '1' && payload.role === 'ADMIN'
          ? {}
          : {
              OR: [
                { buyerId: payload.userId },
                { sellerId: payload.userId },
                { transporterId: payload.userId }
              ]
            };

      const orders = await prisma.order.findMany({
        where,
        include: {
          orderItems: {                           // ✅ corrected relation
            include: {
              productListing: true
            }
          },
          buyer: true,
          seller: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ data: orders });
    }

    // -------------------------------------------------
    // Anything else → 405
    // -------------------------------------------------
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[ORDERS API]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
