// ===============================================================
// api/transport.js – Transport (Transporte) API
// ---------------------------------------------------------------
// Endpoints:
//
//   GET  /api/transport   → list all transport listings
//   POST /api/transport   → create a new transport service
// ---------------------------------------------------------------
// Returns JSON { data: [...] } (or { error: … }) – same shape as
// the other API endpoints (products, orders, storage, …).
// ===============================================================

const prisma = require('../../lib/prisma');          // <-- adjust if your lib folder lives elsewhere
const { verifyToken } = require('../../lib/jwt');
require('dotenv').config();                       // loads DB URL, JWT secret, etc.

// ---------- Tiny JSON helper ----------
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// -----------------------------------------------------------------
// Main exported handler – Vercel calls it with (req, res)
// -----------------------------------------------------------------
module.exports = async (req, res) => {
  // ---------- CORS (the outer catch‑all already adds this, but we keep it) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣ Authenticate – all transport endpoints require a valid JWT
  // -----------------------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  const userId = payload.userId;   // the currently logged‑in user (transport provider)

  // -----------------------------------------------------------------
  // 2️⃣ GET /api/transport → list every transport listing
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/transport')) {
    try {
      const listings = await prisma.transportListing.findMany({
        include: {
          // The UI only needs the transporter’s id to filter “my services”
          transporter: { select: { id: true, email: true, fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return json(res, { data: listings });
    } catch (e) {
      console.error('[transport GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/transport → create a new transport service
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/transport') {
    // ---- Parse JSON body ----------------------------------------------------
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
    } catch {
      return json(res, { error: 'Invalid JSON body' }, 400);
    }

    // ---- Validate required fields -------------------------------------------
    const required = ['title', 'vehicle', 'routes', 'status'];
    for (const f of required) {
      if (!body[f]) return json(res, { error: `${f} is required` }, 400);
    }

    // ---- Build the Prisma data object ---------------------------------------
    const data = {
      // The foreign‑key that links the listing to the logged‑in user
      transporterId: userId,

      // Field name mapping – these must match the column names in the Prisma model
      serviceTitle: body.title,
      vehicleType: body.vehicle,
      operationalRoutes: body.routes,
      availabilityStatus: body.status,

      // Optional defaults – you can extend the UI later to let the user set these
      baseLocationCity: 'Luanda',
      baseLocationCountry: 'Angola',
      pricingModel: 'Por tonelada',
      // If you ever want a description, the front‑end can send it; otherwise null.
      description: body.description?.trim() || null
    };

    try {
      const newService = await prisma.transportListing.create({
        data,
        include: {
          transporter: { select: { id: true, email: true, fullName: true } }
        }
      });
      // 201 – Created
      return json(res, { data: newService }, 201);
    } catch (e) {
      console.error('[transport POST]', e);
      // Prisma unique‑constraint (P2002) => 409 Conflict
      if (e.code === 'P2002') return json(res, { error: 'Duplicate entry' }, 409);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
