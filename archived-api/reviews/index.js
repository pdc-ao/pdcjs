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

    const userId = payload.userId;

    if (req.method === 'GET') {
      const reviews = await prisma.review.findMany({
        where: { targetId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, email: true, fullName: true } }
        }
      });

      return res.json({ data: reviews });
    }

    if (req.method === 'POST') {
      const { targetId, rating, comment } = req.body || {};
      if (!targetId || !rating) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      const review = await prisma.review.create({
        data: {
          reviewerId: userId,
          targetId,
          rating: parseInt(rating),
          comment: comment || ''
        }
      });

      return res.status(201).json({ data: review });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[REVIEWS API]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
