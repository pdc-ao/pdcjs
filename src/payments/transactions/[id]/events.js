const prisma = require('../../../../lib/prisma');
const { verifyToken } = require('../../../../lib/jwt');

module.exports = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    verifyToken(token); // No role check needed for viewing events

    const txnId = req.query.id;
    const events = await prisma.paymentTransactionEvent.findMany({
      where: { transactionId: txnId },
      include: {
        actor: { select: { id: true, username: true, fullName: true } }
      },
      orderBy: { timestamp: 'asc' }
    });

    return res.json(events);
  } catch (err) {
    console.error('[TXN EVENTS]', err);
    return res.status(500).json({ error: err.message });
  }
};
