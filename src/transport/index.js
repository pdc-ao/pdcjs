// -----------------------------------------------------------------------------
// src/transport/index.js
// -----------------------------------------------------------------------------
// Handles GET (list all transport listings) and POST (create a new transport service)
// -----------------------------------------------------------------------------
// • Authenticated via JWT (required for POST, optional for GET – we still
//   verify the token because the UI always sends it, but we ignore it for the
//   listing request.
// • Returns field names that the front‑end expects (`title`, `vehicle`, `routes`,
//   `status`). Internally they are stored as `serviceTitle`, `vehicleType`,
//   `operationalRoutes`, `availabilityStatus`.
// -----------------------------------------------------------------------------
// NOTE: The global catch‑all (`src/index.js`) already adds CORS headers and
//       handles OPTIONS pre‑flight, so we only need the business logic here.
// -----------------------------------------------------------------------------

const prisma = require('../../lib/prisma');          // correct relative path
const { verifyToken } = require('../../lib/jwt');
require('dotenv').config();

module.exports = async (req, res) => {
  // --------------------------------------------------------------
  // 1️⃣  Authenticate – we need a valid token for POST.
  //     For GET we still parse it (the UI always sends it) but we
  //     don't abort if it is missing – the listings are public.
  // --------------------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  let payload = null;
  if (token) {
    try {
      payload = verifyToken(token); // may throw
    } catch (e) {
      // If the token is invalid we still allow GET (public), but POST will
      // later reject because we need a userId.
      payload = null;
    }
  }

  // --------------------------------------------------------------
  // 2️⃣  GET – list all transport listings (public)
  // --------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const listings = await prisma.transportListing.findMany({
        include: {
          // We only need the transporter’s id for the front‑end filter.
          transporter: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Map DB fields to the names the UI expects.
      const mapped = listings.map(l => ({
        id: l.id,
        transporterId: l.transporterId,
        title: l.serviceTitle,
        vehicle: l.vehicleType,
        routes: l.operationalRoutes,
        status: l.availabilityStatus,
        // optional extra info (you can expose more if needed)
        createdAt: l.createdAt,
        transporter: l.transporter,
      }));

      return res.json({ data: mapped });
    } catch (e) {
      console.error('[TRANSPORT GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 3️⃣  POST – create a new transport service (requires auth)
  // --------------------------------------------------------------
  if (req.method === 'POST') {
    // ---------- Ensure we have a valid user ----------
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ---------- Parse the request body ----------
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

    // ---------- Validate required fields ----------
    const required = ['title', 'vehicle', 'routes', 'status'];
    for (const f of required) {
      if (!body[f]) {
        return res.status(400).json({ error: `${f} is required` });
      }
    }

    // ---------- Build Prisma payload ----------
    const data = {
      transporterId: payload.userId,
      serviceTitle: body.title.trim(),
      vehicleType: body.vehicle.trim(),
      operationalRoutes: body.routes.trim(),
      availabilityStatus: body.status.trim(),

      // Default values you may want to expose later:
      baseLocationCity: 'Luanda',
      baseLocationCountry: 'Angola',
      pricingModel: 'Por tonelada',
      description: body.description?.trim() || null,
    };

    try {
      const created = await prisma.transportListing.create({
        data,
        include: {
          transporter: { select: { id: true, email: true, fullName: true } },
        },
      });

      // Map to front‑end field names before sending back
      const response = {
        id: created.id,
        transporterId: created.transporterId,
        title: created.serviceTitle,
        vehicle: created.vehicleType,
        routes: created.operationalRoutes,
        status: created.availabilityStatus,
        createdAt: created.createdAt,
        transporter: created.transporter,
      };

      return res.status(201).json({ data: response });
    } catch (e) {
      console.error('[TRANSPORT POST]', e);
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
