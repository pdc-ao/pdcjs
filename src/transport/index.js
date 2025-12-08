// -----------------------------------------------------------------------------
// src/transport/index.js
// -----------------------------------------------------------------------------
// End‑points:
//   GET  /api/transport   → list all transport listings (public)
//   POST /api/transport   → create a new transport service (auth required)
// -----------------------------------------------------------------------------
// • Auth via JWT (`Authorization: Bearer <token>`).
// • The global catch‑all already parses JSON bodies, so we use `req.body`.
// • Prisma model is `transportListing`. The DB columns are:
//     serviceTitle, vehicleType, operationalRoutes, availabilityStatus,
//     transporterId, …
//   The UI expects the keys: title, vehicle, routes, status, transporterId.
//   We therefore **map the DB fields to those UI‑friendly names** before sending
//   the response.
// -----------------------------------------------------------------------------

const prisma = require('../../lib/prisma');          // two levels up from src/transport
const { verifyToken } = require('../../lib/jwt');   // same
require('dotenv').config();                       // loads DB URL, JWT secret, etc.

module.exports = async (req, res) => {
  // --------------------------------------------------------------
  // 1️⃣  Authenticate (required for POST, optional for GET)
  // --------------------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    // GET is public; we still need `payload` for POST, so we only
    // abort when the request is POST.
    if (req.method === 'POST') {
      return res.status(401).json({ error: 'Missing token' });
    }
  }

  let payload = null;
  if (token) {
    try {
      payload = verifyToken(token); // must contain at least { userId }
    } catch (e) {
      if (req.method === 'POST') {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
  }

  // --------------------------------------------------------------
  // 2️⃣  GET – list every transport listing (public)
  // --------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const listings = await prisma.transportListing.findMany({
        include: {
          // UI only needs the transporter id to filter “my services”
          transporter: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // ------- Map DB fields → UI fields -------
      const uiListings = listings.map(l => ({
        id: l.id,
        title: l.serviceTitle,          // UI expects `title`
        vehicle: l.vehicleType,         // UI expects `vehicle`
        routes: l.operationalRoutes,    // UI expects `routes`
        status: l.availabilityStatus,   // UI expects `status`
        transporterId: l.transporterId, // used for filtering “my services”
        // keep any other fields you might want to display
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      }));

      // UI expects `{ data: [...] }`
      return res.json({ data: uiListings });
    } catch (e) {
      console.error('[TRANSPORT GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 3️⃣  POST – create a new transport service (auth required)
  // --------------------------------------------------------------
  if (req.method === 'POST') {
    // --------------------------------------------------------------
    // We already have the token payload (`payload.userId`) from step 1
    // --------------------------------------------------------------
    if (!payload) {
      return res.status(401).json({ error: 'Missing token' });
    }

    // --------------------------------------------------------------
    // Body is already parsed by the global catch‑all (`src/index.js`)
    // --------------------------------------------------------------
    const body = req.body || {};

    // ---- Validate required fields (UI sends `title`, `vehicle`, `routes`, `status`) ----
    const required = ['title', 'vehicle', 'routes', 'status'];
    for (const f of required) {
      if (!body[f]) {
        return res.status(400).json({ error: `${f} is required` });
      }
    }

    // ---- Build the Prisma payload (DB column names) ----
    const data = {
      transporterId: payload.userId,                // link to logged‑in user
      serviceTitle: body.title.trim(),
      vehicleType: body.vehicle.trim(),
      operationalRoutes: body.routes.trim(),
      availabilityStatus: body.status.trim(),
      // Optional defaults – you can expose these later in the UI
      baseLocationCity: 'Luanda',
      baseLocationCountry: 'Angola',
      pricingModel: 'Por tonelada',
      description: body.description?.trim() || null,
    };

    try {
      const newService = await prisma.transportListing.create({
        data,
        include: {
          // Return the transporter info as well (same shape as GET)
          transporter: { select: { id: true, email: true, fullName: true } },
        },
      });

      // ------- Map DB fields → UI fields for the response -------
      const uiResponse = {
        id: newService.id,
        title: newService.serviceTitle,
        vehicle: newService.vehicleType,
        routes: newService.operationalRoutes,
        status: newService.availabilityStatus,
        transporterId: newService.transporterId,
        createdAt: newService.createdAt,
        updatedAt: newService.updatedAt,
        // you can add any other fields you need
      };

      return res.status(201).json({ data: uiResponse });
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
