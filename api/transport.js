import mod from '../archived-api/src_app_api_transport_route.js';
export default mod;
// ===============================================================
// api/transport.js – Transport (Transporte) API
// ---------------------------------------------------------------
// Endpoints:
//   GET  /api/transport   → list all transport listings
//   POST /api/transport   → create a new transport service (owner = logged‑in user)
// ----------------------------------------------------------------
// Returns JSON { data: [...] } (or { error: … }) – same shape as other APIs.
// ===============================================================

const prisma = require('../lib/prisma');
const { verifyToken } = require('../lib/jwt');
require('dotenv').config();

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  // ---------- CORS (redundant but safe) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.end();

  // ---------- Authentication ----------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  const userId = payload.userId;   // the transporter (owner) of the listing

  // -----------------------------------------------------------------
  // 1️⃣ GET /api/transport → list all transport listings
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/transport')) {
    try {
      const listings = await prisma.transportListing.findMany({
        include: {
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
  // 2️⃣ POST /api/transport → create a new transport service
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

    // ---- Validate required fields --------------------------------------------
    const required = ['title', 'vehicle', 'routes', 'status'];
    for (const f of required) {
      if (!body[f]) return json(res, { error: `${f} is required` }, 400);
    }

    // ---- Build Prisma data object -------------------------------------------
    const data = {
      transporterId: userId,
      serviceTitle: body.title,
      vehicleType: body.vehicle,
      operationalRoutes: body.routes,
      availabilityStatus: body.status,

      // Optional fields – you can extend later, but we give sensible defaults:
      baseLocationCity: 'Luanda',
      baseLocationCountry: 'Angola',
      pricingModel: 'Por tonelada',
      // If you ever add a description, you can send it, otherwise leave null.
      description: body.description?.trim() || null
    };

    try {
      const newService = await prisma.transportListing.create({
        data,
        include: {
          transporter: { select: { id: true, email: true, fullName: true } }
        }
      });
      return json(res, { data: newService }, 201);
    } catch (e) {
      console.error('[transport POST]', e);
      if (e.code === 'P2002') return json(res, { error: 'Duplicate entry' }, 409);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
