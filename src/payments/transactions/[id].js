const prisma = require('../../../lib/prisma');
const { verifyToken } = require('../../../lib/jwt');
const { ensureWallet, creditWallet } = require('../../../lib/wallet');

async function logEvent(tx, transactionId, actorId, action) {
  await tx.paymentTransactionEvent.create({
    data: { transactionId, actorId, action }
  });
}

module.exports = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const { userId, role } = verifyToken(token);
    const txnId = req.query.id;

    if (req.method === 'GET') {
      const txn = await prisma.paymentTransaction.findUnique({
        where: { id: txnId },
        include: {
          buyer: { select: { id: true, fullName: true, username: true } },
          seller: { select: { id: true, fullName: true, username: true } }
        }
      });
      if (!txn) return res.status(404).json({ error: 'Not found' });
      return res.json(txn);
    }

    if (req.method === 'PATCH') {
      const { action } = req.body || {};
      if (!action) return res.status(400).json({ error: 'Missing action' });

      const result = await prisma.$transaction(async tx => {
        const txn = await tx.paymentTransaction.findUnique({ where: { id: txnId } });
        if (!txn) throw new Error('Transaction not found');

        const isBuyer = txn.buyerId === userId;
        const isSeller = txn.sellerId === userId;
        const isAdmin = role === 'ADMIN';

        switch (action) {
          case 'FUND':
            if (!isBuyer || txn.status !== 'PENDING') throw new Error('Unauthorized or invalid state');
            await logEvent(tx, txnId, userId, 'FUND');
            return tx.paymentTransaction.update({
              where: { id: txnId },
              data: { status: 'FUNDED', escrowHeldAt: new Date() }
            });

          case 'SELLER_CONFIRM':
            if (!isSeller || txn.status !== 'FUNDED') throw new Error('Unauthorized or invalid state');
            await logEvent(tx, txnId, userId, 'SELLER_CONFIRM');
            return tx.paymentTransaction.update({
              where: { id: txnId },
              data: { status: 'SELLER_CONFIRMED' }
            });

          case 'BUYER_CONFIRM':
            if (!isBuyer || !['FUNDED', 'SELLER_CONFIRMED'].includes(txn.status)) throw new Error('Unauthorized or invalid state');
            await logEvent(tx, txnId, userId, 'BUYER_CONFIRM');
            return tx.paymentTransaction.update({
              where: { id: txnId },
              data: { status: 'BUYER_CONFIRMED' }
            });

          case 'RELEASE':
            if (!isAdmin && !(txn.status === 'BUYER_CONFIRMED' || txn.status === 'SELLER_CONFIRMED')) throw new Error('Unauthorized');
            await ensureWallet(tx, txn.sellerId);
            await creditWallet(tx, txn.sellerId, Number(txn.amount), { paymentTransactionId: txnId });
            await logEvent(tx, txnId, userId, 'RELEASE');
            return tx.paymentTransaction.update({
              where: { id: txnId },
              data: { status: 'RELEASED', releasedAt: new Date() }
            });

          case 'DISPUTE':
            if (!(isBuyer || isSeller)) throw new Error('Unauthorized');
            if (!['FUNDED', 'SELLER_CONFIRMED', 'BUYER_CONFIRMED'].includes(txn.status)) throw new Error('Invalid state');
            await logEvent(tx, txnId, userId, 'DISPUTE');
            return tx.paymentTransaction.update({ where: { id: txnId }, data: { status: 'DISPUTED' } });

          case 'REFUND':
            if (!isAdmin || txn.status !== 'DISPUTED') throw new Error('Unauthorized or invalid state');
            await ensureWallet(tx, txn.buyerId);
            await creditWallet(tx, txn.buyerId, Number(txn.amount), { paymentTransactionId: txnId, refund: true });
            await logEvent(tx, txnId, userId, 'REFUND');
            return tx.paymentTransaction.update({
              where: { id: txnId },
              data: { status: 'REFUNDED', refundedAt: new Date() }
            });

          case 'CANCEL':
            if (!isBuyer || txn.status !== 'PENDING') throw new Error('Unauthorized or invalid state');
            await logEvent(tx, txnId, userId, 'CANCEL');
            return tx.paymentTransaction.update({ where: { id: txnId }, data: { status: 'CANCELLED' } });

          default:
            throw new Error('Unknown action');
        }
      });

      return res.json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[TXN PATCH]', err);
    return res.status(500).json({ error: err.message });
  }
};
