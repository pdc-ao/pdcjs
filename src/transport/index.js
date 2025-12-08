// -----------------------------------------------------------------------------
// src/transport/index.js
// -----------------------------------------------------------------------------
// End‑points:
//   GET  /api/transport   → list all transport listings (public)
//   POST /api/transport   → create a new transport service (requires auth)
// -----------------------------------------------------------------------------
// • Auth is performed via the JWT in the Authorization header.
// • The global catch‑all (`src/index.js`) already parses JSON bodies, so we
//   use `req.body` directly – no manual stream handling.
// • The Prisma model is `transportListing`; field names are mapped from the UI
//   (`title`, `vehicle`, `routes`, `status`) to the DB columns.
// -----------------------------------------------------------------------------

const prisma = require('../../lib/prisma');          // two levels up from src/transport
const { verifyToken } = require('../../lib/jwt');  // same
require('dotenv').config();                       // loads DB URL, JWT secret, etc.

module.exports = async (req, res) => {
  // --------------------------------------------------------------
  // 1️⃣  Authenticate – extract and verify JWT
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
  // 2️⃣  GET – list every transport listing (public)
  // --------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const listings = await prisma.transportListing.findMany({
        include: {
          // UI only needs the transporter’s id to filter its own services
          transporter: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      // UI expects `{ data: [...] }`
      return res.json({ data: listings });
    } catch (e) {
      console.error('[TRANSPORT GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 3️⃣  POST – create a new transport service (auth required)
  // --------------------------------------------------------------
  if (req.method === 'POST') {
    // The global catch‑all already placed the parsed JSON here:
    const body = req.body || {};

    // ---- Validate required fields ----
    const required = ['title', 'vehicle', 'routes', 'status'];
    for (const f of required) {
      if (!body[f]) {
        return res.status(400).json({ error: `${f} is required` });
      }
    }

    // ---- Build the Prisma payload (field‑name mapping) ----
    const data = {
      // Link the service to the logged‑in user
      transporterId: payload.userId,

      // UI → DB column mapping
      serviceTitle: body.title.trim(),
      vehicleType: body.vehicle.trim(),
      operationalRoutes: body.routes.trim(),
      availabilityStatus: body.status.trim(),

      // Optional defaults (feel free to expose them later in the UI)
      baseLocationCity: 'Luanda',
      baseLocationCountry: 'Angola',
      pricingModel: 'Por tonelada',
      description: body.description?.trim() || null,
    };

    try {
      const newService = await prisma.transportListing.create({
        data,
        include: {
          transporter: { select: { id: true, email: true, fullName: true } },
        },
      });

      // 201 – Created
      return res.status(201).json({ data: newService });
    } catch (e) {
      console.error('[TRANSPORT POST]', e);
      // Prisma unique‑constraint violation (e.g. duplicate title)
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
