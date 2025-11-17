// ===============================================================
// api/storage.js  –  Storage (Armazenamento) API
// ---------------------------------------------------------------
// Endpoints:
//   GET  /api/storage          → list all storage listings
//   POST /api/storage          → create a new storage listing
// ----------------------------------------------------------------
// All responses are JSON: { data: … }  (or { error: … } on failure)
// ----------------------------------------------------------------
// This file is called by the catch‑all `api/[...slug].js`, so it
// counts as ONE server‑less function.
// ===============================================================

const prisma = require('../lib/prisma');          // <-- adjust if lib folder is elsewhere
const { verifyToken } = require('../lib/jwt');
require('dotenv').config();                       // loads PRISMA_DATABASE_URL, JWT secret, etc.

// ---------- Helper to send JSON ----------
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// -----------------------------------------------------------------
// Main exported handler – Vercel passes (req, res)
// -----------------------------------------------------------------
module.exports = async (req, res) => {
  // ---------- CORS (the outer catch‑all already adds this, but we keep it) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣  Authenticate the caller – every endpoint in this project is
  //      protected by a JWT in the `Authorization: Bearer <token>` header.
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

  const userId = payload.userId;   // the ID stored in the JWT (same as in other APIs)

  // -----------------------------------------------------------------
  // 2️⃣ GET /api/storage  → list every storage listing (no pagination for demo)
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/storage')) {
    try {
      const listings = await prisma.storageListing.findMany({
        include: {
          // The UI only needs a handful of fields – we select them explicitly
          // to keep the payload small.
          owner: { select: { id: true, email: true, fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // The front‑end expects the array inside a `data` property.
      return json(res, { data: listings });
    } catch (e) {
      console.error('[storage GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/storage  → create a new storage listing (owner = logged‑in user)
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/storage') {
    // ---- Read request body (JSON) ----
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
      return json(res, { error: 'Invalid JSON body' }, 400);
    }

    // ---- Basic validation (feel free to extend) ----
    const required = ['facilityName', 'storageType', 'totalCapacity', 'availabilityStatus'];
    for (const field of required) {
      if (!body[field]) return json(res, { error: `${field} is required` }, 400);
    }

    try {
      const newListing = await prisma.storageListing.create({
        data: {
          // The column names in the Prisma model are exactly the same as the
          // property names we use here (camelCase → same as DB column via Prisma).
          ownerId: userId,
          facilityName: body.facilityName,
          storageType: body.storageType,
          totalCapacity: Number(body.totalCapacity) || 0,
          // optional fields – we store them only if they are present
          capacityUnit: body.capacityUnit ? String(body.capacityUnit) : undefined,
          availableCapacity: Number(body.availableCapacity) || undefined,
          availabilityStatus: body.availabilityStatus,
          description: body.description || '',
          addressLine1: body.addressLine1 || '',
          addressLine2: body.addressLine2 || '',
          city: body.city || '',
          postalCode: body.postalCode || '',
          pricingStructure: body.pricingStructure || '',
          // Any extra fields you might need can be added here.
        },
        include: {
          owner: { select: { id: true, email: true, fullName: true } }
        }
      });

      // Return the freshly created record (status 201 = Created)
      return json(res, { data: newListing }, 201);
    } catch (e) {
      console.error('[storage POST]', e);
      // Prisma unique‑constraint errors come with a `code` field = 'P2002'
      if (e.code === 'P2002') {
        return json(res, { error: 'Duplicate entry' }, 409);
      }
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
