// -----------------------------------------------------------------------------
// src/storage/index.js
// -----------------------------------------------------------------------------
// Handles GET (list all storage listings) and POST (create a new listing)
// -----------------------------------------------------------------------------
// • Verifies the JWT from the Authorization header.
// • Makes `latitude` and `longitude` optional – if the client does not send
//   them we store `null` (the Prisma schema has been changed accordingly).
// • Returns JSON responses that match the format used throughout the app.
// -----------------------------------------------------------------------------

const prisma = require('../lib/prisma');
const { verifyToken } = require('../lib/jwt');
require('dotenv').config();

module.exports = async (req, res) => {
  // --------------------------------------------------------------
  // 1️⃣  Auth – extract bearer token and verify it
  // --------------------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  let payload;
  try {
    payload = verifyToken(token); // should return an object containing at least `userId`
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // --------------------------------------------------------------
  // 2️⃣  GET – list all storage listings (public endpoint)
  // --------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const listings = await prisma.storageListing.findMany({
        where: { availabilityStatus: 'Available' },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ data: listings });
    } catch (e) {
      console.error('[STORAGE GET]', e);
      return res
        .status(500)
        .json({ error: 'Failed to fetch storage listings' });
    }
  }

  // --------------------------------------------------------------
  // 3️⃣  POST – create a new storage listing (requires auth)
  // --------------------------------------------------------------
  if (req.method === 'POST') {
    // --- extract fields from the request body -------------------
    const {
      facilityName,
      storageType,
      totalCapacity,
      city,
      pricingStructure,
      availabilityStatus,
      description,
      addressLine1,
      postalCode,
      // optional – the front‑end does not supply them yet
      latitude,
      longitude,
    } = req.body || {};

    // --- basic validation ---------------------------------------
    if (
      !facilityName ||
      !storageType ||
      !totalCapacity ||
      !city ||
      !description ||
      !addressLine1 ||
      !postalCode
    ) {
      return res
        .status(400)
        .json({ error: 'Missing required fields' });
    }

    // ----------------------------------------------------------
    // Build the data object for Prisma.
    // `latitude` and `longitude` are optional (they may be undefined);
    // Prisma will store `null` because the schema marks them as Float?.
    // ----------------------------------------------------------
    const data = {
      ownerId: payload.userId,
      facilityName,
      storageType,
      totalCapacity: parseFloat(totalCapacity),
      // We also set the initial available capacity to the total capacity.
      availableCapacity: parseFloat(totalCapacity),
      city,
      pricingStructure,
      availabilityStatus: availabilityStatus || 'Available',
      description,
      addressLine1,
      postalCode,
      // optional coordinates – keep them null if not supplied
      latitude: typeof latitude === 'number' ? latitude : null,
      longitude: typeof longitude === 'number' ? longitude : null,
    };

    try {
      const listing = await prisma.storageListing.create({ data });
      return res.status(201).json({ data: listing });
    } catch (e) {
      console.error('[STORAGE POST]', e);
      return res
        .status(500)
        .json({ error: 'Failed to create storage listing' });
    }
  }

  // --------------------------------------------------------------
  // 4️⃣  Anything else → 405 Method Not Allowed
  // --------------------------------------------------------------
  return res.status(405).json({ error: 'Method not allowed' });
};
