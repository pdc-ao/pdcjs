// -----------------------------------------------------------------------------
// src/storage/index.js
// -----------------------------------------------------------------------------
// Handles GET (list all storage listings) and POST (create a new listing)
// -----------------------------------------------------------------------------
// • Verifies the JWT from the Authorization header.
// • Uses the *optional* latitude/longitude fields (they are now Float? in the
//   Prisma schema).
// • Returns JSON in the same shape the front‑end expects.
// -----------------------------------------------------------------------------

// ----------- FIXED IMPORT PATHS -----------------
const prisma = require('../../lib/prisma');          // <-- two levels up
const { verifyToken } = require('../../lib/jwt');   // <-- two levels up
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
    payload = verifyToken(token); // must contain at least { userId: … }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // --------------------------------------------------------------
  // 2️⃣  GET – public list of storage listings (optional owner filter)
  // --------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      // If the client wants only its own listings they can call
      // /api/storage?ownerId=xxxxx – the UI does not use it now, but we keep it.
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const ownerId = urlObj.searchParams.get('ownerId');

      const where = ownerId ? { ownerId } : {};

      const listings = await prisma.storageListing.findMany({
        where,
        include: {
          owner: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Add the computed “capacidade” field that the UI expects
      const withCapacidade = listings.map(l => ({
        ...l,
        capacidade:
          l.totalCapacity && l.capacityUnit
            ? `${l.totalCapacity} ${l.capacityUnit}`
            : null,
      }));

      // If an owner filter was supplied we return a plain array,
      // otherwise we wrap it in { data: … } (what the dashboard expects).
      return ownerId
        ? res.json(withCapacidade)
        : res.json({ data: withCapacidade });
    } catch (e) {
      console.error('[STORAGE GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 3️⃣  POST – create a new storage listing (requires auth)
  // --------------------------------------------------------------
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
      postalCode,
      // Optional coordinates – the front‑end does **not** send them yet.
      latitude,
      longitude,
    } = req.body || {};

    // ---------- Basic required‑field validation ----------
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

    // ---------- Build the Prisma create payload ----------
    const data = {
      ownerId: payload.userId,
      facilityName: facilityName.trim(),
      storageType: storageType.trim(),
      totalCapacity: Number(totalCapacity),
      // set the initial available capacity to the total capacity
      availableCapacity: Number(totalCapacity),
      city: city.trim(),
      pricingStructure: pricingStructure?.trim() || '',
      availabilityStatus: (availabilityStatus?.trim() || 'Available'),
      description: description.trim(),
      addressLine1: addressLine1.trim(),
      postalCode: postalCode.trim(),
      // Optional coordinates – store null if not provided (schema: Float?)
      latitude: typeof latitude === 'number' ? latitude : null,
      longitude: typeof longitude === 'number' ? longitude : null,
    };

    try {
      const newListing = await prisma.storageListing.create({
        data,
        include: {
          owner: { select: { id: true, email: true, fullName: true } },
        },
      });

      // Add the UI‑friendly computed field
      const response = {
        ...newListing,
        capacidade:
          newListing.totalCapacity && newListing.capacityUnit
            ? `${newListing.totalCapacity} ${newListing.capacityUnit}`
            : null,
      };

      return res.status(201).json({ data: response });
    } catch (e) {
      console.error('[STORAGE POST]', e);
      // P2002 = unique‑constraint violation – keep the same message you had before
      if (e.code === 'P2002') {
        return res.status(409).json({ error: 'Duplicate entry' });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 4️⃣  Anything else → 405 Method Not Allowed
  // --------------------------------------------------------------
  return res.status(405).json({ error: 'Method not allowed' });
};
