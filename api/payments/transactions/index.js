const prisma = require('../../../lib/prisma');
const { verifyToken } = require('../../../lib/jwt');

module.exports = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const { userId } = verifyToken(token);

    if (req.method === 'GET') {
      const txns = await prisma.paymentTransaction.findMany({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }]
        },
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { id: true, fullName: true, username: true } },
          seller: { select: { id: true, fullName: true, username: true } }
        }
      });
      return res.json(txns);
    }

    if (req.method === 'POST') {
      const { sellerId, amount, description } = req.body || {};
      if (!sellerId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Invalid sellerId or amount' });
      }

      const txn = await prisma.paymentTransaction.create({
        data: {
          buyerId: userId,
          sellerId,
          amount: Number(amount),
          description: description || '',
          status: 'PENDING'
        }
      });

      await prisma.paymentTransactionEvent.create({
        data: {
          transactionId: txn.id,
          actorId: userId,
          action: 'CREATE'
        }
      });

      return res.status(201).json(txn);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[TXN INDEX]', err);
    return res.status(500).json({ error: err.message });
  }
};
