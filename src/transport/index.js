// -----------------------------------------------------------------------------
// src/transport/index.js
// -----------------------------------------------------------------------------
// Handles:
//   GET  /api/transport  → list all transport listings (public)
//   POST /api/transport  → create a new transport service (auth required)
// -----------------------------------------------------------------------------
// • Authenticated via the JWT in the Authorization header.
// • Uses the Prisma model `transportListing` (the name that exists in the schema).
// • Maps UI‑field names (`title`, `vehicle`, `routes`, `status`) to the DB
//   columns (`serviceTitle`, `vehicleType`, `operationalRoutes`,
//   `availabilityStatus`).
// -----------------------------------------------------------------------------
// NOTE: The global catch‑all (`src/index.js`) resolves `/api/transport` to
// `src/transport/index.js` automatically (it adds `/index.js` when the folder is a
// directory). No additional routing rules are required.
// -----------------------------------------------------------------------------

const prisma = require('../../lib/prisma');          // <-- two levels up from src/transport
const { verifyToken } = require('../../lib/jwt');  // <-- same
require('dotenv').config();                       // loads DB URL, JWT secret, etc.

module.exports = async (req, res) => {
  // --------------------------------------------------------------
  // 1️⃣  Authenticate
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
  // 2️⃣  GET – list *all* transport listings (public)
  // --------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const listings = await prisma.transportListing.findMany({
        include: {
          transporter: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // The front‑end expects `{ data: [...] }`
      return res.json({ data: listings });
    } catch (e) {
      console.error('[TRANSPORT GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 3️⃣  POST – create a new transport service (requires auth)
  // --------------------------------------------------------------
  if (req.method === 'POST') {
    // --------------------------------------------------------------
    // Parse JSON body (the global catch‑all adds a body‑parser for us,
    // but we keep a tiny manual version for safety)
    // --------------------------------------------------------------
    let body;
    try {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => (raw += chunk));
        req.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
        req.on('error', reject);
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    // --------------------------------------------------------------
    // Validate required fields
    // --------------------------------------------------------------
    const required = ['title', 'vehicle', 'routes', 'status'];
    for (const f of required) {
      if (!body[f]) {
        return res.status(400).json({ error: `${f} is required` });
      }
    }

    // --------------------------------------------------------------
    // Build the Prisma‑compatible payload
    // --------------------------------------------------------------
    const data = {
      // The logged‑in user is the owner of the service
      transporterId: payload.userId,

      // UI → DB field mapping
      serviceTitle: body.title.trim(),
      vehicleType: body.vehicle.trim(),
      operationalRoutes: body.routes.trim(),
      availabilityStatus: body.status.trim(),

      // Optional defaults (feel free to expose them in the UI later)
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
      // P2002 = unique‑constraint violation (e.g. duplicate title)
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
