const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');

require('dotenv').config();

module.exports = async (req, res) => {
  const id = Number(req.query.id || req.url.split('/').pop());
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  try {
    if (req.method === 'GET') {
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) return res.status(404).json({ error: 'Not found' });
      return res.json({ data: product });
    }

    // For update/delete require auth
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      // permission check
      if (!['ADMIN', 'PRODUCER', 'FACILITY_OWNER'].includes(payload.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const data = req.body || {};
      const updated = await prisma.product.update({ where: { id }, data });
      return res.json({ data: updated });
    }

    if (req.method === 'DELETE') {
      if (!['ADMIN'].includes(payload.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      await prisma.product.delete({ where: { id } });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};