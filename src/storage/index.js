const prisma = require('../lib/prisma');
const { verifyToken } = require('../lib/jwt');

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
      const listings = await prisma.storageListing.findMany({
        where: { availabilityStatus: 'Available' },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ data: listings });
    }

    if (req.method === 'POST') {
      const {
        facilityName,
        storageType,
        totalCapacity,
        city,
        pricingStructure,
        availabilityStatus,
        description,
        addressLine1,
        postalCode
      } = req.body || {};

      if (
        !facilityName ||
        !storageType ||
        !totalCapacity ||
        !city ||
        !description ||
        !addressLine1 ||
        !postalCode
      ) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const listing = await prisma.storageListing.create({
        data: {
          ownerId: payload.userId,
          facilityName,
          storageType,
          totalCapacity: parseFloat(totalCapacity),
          availableCapacity: parseFloat(totalCapacity),
          city,
          pricingStructure,
          availabilityStatus: availabilityStatus || 'Available',
          description,
          addressLine1,
          postalCode
        }
      });

      return res.status(201).json({ data: listing });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[STORAGE API]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
