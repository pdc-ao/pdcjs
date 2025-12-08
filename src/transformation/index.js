// -----------------------------------------------------------------------------
// src/transformation/index.js
// -----------------------------------------------------------------------------
// End‑points:
//   GET  /api/transformation   → list the logged‑in user's transformation facilities
//   POST /api/transformation   → create a new facility (auth required)
// -----------------------------------------------------------------------------
// • Uses the Prisma model `transformationFacility` (the name that exists in the
//   schema).  
// • The UI expects the keys `name`, `type`, `location`, `status`, `ownerId`.
//   Those are derived from the DB columns `name`, `serviceType`, `location`,
//   `isActive`, `ownerId`.
// • The global catch‑all (`src/index.js`) already parses JSON bodies, so we
//   simply read `req.body`.
// -----------------------------------------------------------------------------

const prisma = require('../../lib/prisma');          // two levels up from src/transformation
const { verifyToken } = require('../../lib/jwt');   // same
require('dotenv').config();                         // loads DB URL, JWT secret, etc.

module.exports = async (req, res) => {
  // --------------------------------------------------------------
  // 1️⃣  Authenticate (required for both GET and POST)
  // --------------------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  let payload;
  try {
    payload = verifyToken(token);           // must contain at least { userId }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = payload.userId;           // the owner of the facilities

  // --------------------------------------------------------------
  // 2️⃣  GET – list the logged‑in user's transformation facilities
  // --------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const raw = await prisma.transformationFacility.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
      });

      // Map DB columns → UI field names
      const transformed = raw.map(fac => ({
        id: fac.id,
        name: fac.name,
        type: fac.serviceType,                               // UI expects `type`
        location: fac.location,
        status: fac.isActive ? 'Disponível' : 'Indisponível', // UI expects a string
        ownerId: fac.ownerId,
      }));

      return res.json({ data: transformed });
    } catch (e) {
      console.error('[TRANSFORMATION GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 3️⃣  POST – create a new transformation facility (auth required)
  // --------------------------------------------------------------
  if (req.method === 'POST') {
    // The global catch‑all already parsed the JSON body:
    const body = req.body || {};

    // ---- Validate required UI fields ----
    const required = ['name', 'type', 'location', 'status'];
    for (const f of required) {
      if (!body[f]) {
        return res.status(400).json({ error: `${f} is required` });
      }
    }

    // ---- Convert UI `status` → DB `isActive` (boolean) ----
    const isActive = body.status === 'Disponível';

    // ---- Build the Prisma payload (DB column names) ----
    const data = {
      ownerId: userId,
      name: body.name.trim(),
      serviceType: body.type.trim(),
      location: body.location.trim(),
      isActive,
      // Optional fields that have defaults in the schema:
      capacity: body.capacity !== undefined ? Number(body.capacity) : 0,
      processingRate:
        body.processingRate !== undefined
          ? Number(body.processingRate)
          : undefined, // will default to 0 in the DB
    };

    try {
      const created = await prisma.transformationFacility.create({
        data,
        // Return only the fields we need for the UI
        select: {
          id: true,
          name: true,
          serviceType: true,
          location: true,
          isActive: true,
          ownerId: true,
        },
      });

      // Map back to UI shape
      const uiResponse = {
        id: created.id,
        name: created.name,
        type: created.serviceType,
        location: created.location,
        status: created.isActive ? 'Disponível' : 'Indisponível',
        ownerId: created.ownerId,
      };

      return res.status(201).json({ data: uiResponse });
    } catch (e) {
      console.error('[TRANSFORMATION POST]', e);
      if (e.code === 'P2002') {
        // duplicate unique constraint (e.g. name+ownerId)
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
