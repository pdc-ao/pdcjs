// ===============================================================
// api/storage.js – Storage (Armazenamento) API
// ---------------------------------------------------------------
// Endpoints:
//   GET  /api/storage          → list all storage listings
//   POST /api/storage          → create a new storage listing
// ----------------------------------------------------------------
// All responses are JSON: { data: … } (or { error: … } on failure)
// ----------------------------------------------------------------
// This file is executed via the catch‑all `api/[...slug].js`,
// so it still counts as ONE serverless function.
// ===============================================================

const prisma = require('../lib/prisma');          // adjust path if your lib folder lives elsewhere
const { verifyToken } = require('../lib/jwt');
require('dotenv').config();                       // loads PRISMA_DATABASE_URL, JWT secret, etc.

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
  // ---------- CORS (outer catch‑all already adds it, but we keep it safe) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣ Authenticate – all storage endpoints require a valid JWT
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

  const userId = payload.userId;   // same field used by the rest of the API

  // -----------------------------------------------------------------
  // 2️⃣ GET /api/storage → list all storage listings (no pagination for demo)
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/storage')) {
    try {
      const listings = await prisma.storageListing.findMany({
        include: {
          // The UI only needs the owner’s id to filter its own listings
          owner: { select: { id: true, email: true, fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return json(res, { data: listings });
    } catch (e) {
      console.error('[storage GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/storage → create a new storage listing
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/storage') {
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
    } catch (e) {
      return json(res, { error: 'Invalid JSON body' }, 400);
    }

    // ---- Required fields ----------------------------------------------------
    const required = [
      'facilityName',
      'storageType',
      'totalCapacity',
      'availabilityStatus'
    ];
    for (const f of required) {
      if (!body[f]) return json(res, { error: `${f} is required` }, 400);
    }

    // ---- Build the data object for Prisma -----------------------------------
    // Only include a field if it has a non‑empty value (undefined = not sent)
    const data = {
      ownerId: userId,
      facilityName: body.facilityName,
      storageType: body.storageType,
      totalCapacity: Number(body.totalCapacity) || 0,
      availabilityStatus: body.availabilityStatus,

      // Optional fields – keep only those that exist in your schema
      capacityUnit: body.capacityUnit?.trim() || undefined,
      availableCapacity: body.availableCapacity
        ? Number(body.availableCapacity)
        : undefined,

      description: body.description?.trim() || '',
      addressLine1: body.addressLine1?.trim() || '',
      // ---- addressLine2 exists in the schema, but if you never send it
      //      you can keep it undefined – Prisma will ignore it.
      addressLine2: body.addressLine2?.trim() || undefined,

      city: body.city?.trim() || '',
      postalCode: body.postalCode?.trim() || '',
      pricingStructure: body.pricingStructure?.trim() || '',
      // -----------------------------------------------------------------
      // Latitude / Longitude – the schema marks these as optional.
      // If you do not have them in the UI we just store 0 (or omit the field).
      // Change the key names to `locationLatitude` / `locationLongitude`
      // if your schema uses those names instead of plain `latitude`.
      // -----------------------------------------------------------------
      latitude: body.latitude ? Number(body.latitude) : 0,
      longitude: body.longitude ? Number(body.longitude) : 0
    };

    try {
      const newListing = await prisma.storageListing.create({
        data,
        include: {
          owner: { select: { id: true, email: true, fullName: true } }
        }
      });

      // 201 – Created
      return json(res, { data: newListing }, 201);
    } catch (e) {
      console.error('[storage POST]', e);
      // Prisma unique‑constraint (P2002) or other validation errors:
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
