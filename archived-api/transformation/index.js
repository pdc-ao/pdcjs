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

    if (req.method === 'GET') {
      const services = await prisma.transformationService.findMany({
        where: { ownerId: payload.userId },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ data: services });
    }

    if (req.method === 'POST') {
      const { name, type, location, status } = req.body || {};
      if (!name || !type || !location || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const service = await prisma.transformationService.create({
        data: {
          ownerId: payload.userId,
          name,
          type,
          location,
          status
        }
      });

      return res.status(201).json({ data: service });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[TRANSFORMATION API]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
