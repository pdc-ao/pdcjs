// ===============================================================
// api/storage.js – Storage (Armazenamento) API
// ---------------------------------------------------------------
// Endpoints:
//   GET  /api/storage          → list all storage listings
//   POST /api/storage          → create a new storage listing
// ----------------------------------------------------------------
// All responses are JSON: { data: … } (or { error: … } on failure)
// ----------------------------------------------------------------
// This file is called by the catch‑all `api/[...slug].js`,
// therefore it still counts as ONE serverless function.
// ===============================================================

const prisma = require('../lib/prisma');          // adjust if lib folder lives elsewhere
const { verifyToken } = require('../lib/jwt');
require('dotenv').config();                       // loads DB URL, JWT secret, …

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
  // ---------- CORS (catch‑all already adds it, but we keep it safe) ----------
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
  // 2️⃣ GET /api/storage → list all storage listings (no pagination for now)
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

    // ---- Basic validation (feel free to extend) ----------------------------
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
    const data = {
      // Required / always‑present fields
      ownerId: userId,
      facilityName: body.facilityName,
      storageType: body.storageType,
      totalCapacity: Number(body.totalCapacity) || 0,
      availabilityStatus: body.availabilityStatus,

      // Optional fields – we only add them if they have a truthy value.
      // Prisma will ignore `undefined`, so the DB default (or null) is kept.
      capacityUnit: body.capacityUnit?.trim() || undefined,
      availableCapacity: body.availableCapacity
        ? Number(body.availableCapacity)
        : undefined,
      description: body.description?.trim() || '',
      addressLine1: body.addressLine1?.trim() || '',
      addressLine2: body.addressLine2?.trim() || '',
      city: body.city?.trim() || '',
      postalCode: body.postalCode?.trim() || '',
      pricingStructure: body.pricingStructure?.trim() || '',
      // -----------------------------------------------------------------
      // Latitude / Longitude – the schema marks these as required, but
      // we don’t have a UI for them, so we fall back to 0.
      // If your schema uses `locationLatitude` / `locationLongitude` rename
      // the keys accordingly.
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
      // Prisma unique‑constraint (P2002) or other validation errors can be
      // turned into more friendly messages if you wish.
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
