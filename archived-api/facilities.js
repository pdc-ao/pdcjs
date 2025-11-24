// ---------------------------------------------------------------------------
// api/facilities.js – Facilities (Transformação) API
// ---------------------------------------------------------------------------
// Endpoints:
//   GET  /api/facilities          → list all facilities (optionally filter by ownerId)
//   POST /api/facilities          → create a new facility
// ---------------------------------------------------------------------------

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { verifyToken } = require('../lib/jwt');
require('dotenv').config();   // loads JWT secret, DB URL, …

// ------------------- tiny JSON helper (exactly like in transformation.js) -------------------
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Main exported handler – Vercel calls it with (req, res)
// ---------------------------------------------------------------------------
module.exports = async (req, res) => {
  // -------------------------------------------------
  // CORS (kept for safety – the global catch‑all also adds it)
  // -------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // 1️⃣ Authenticate – same logic as transformation.js
  // -------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }
  const userId = payload.userId; // the *owner* of the facility

  // -------------------------------------------------
  // 2️⃣ GET – list facilities (optional owner filter)
  // -------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/facilities')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const ownerFilter = urlObj.searchParams.get('ownerId');

    try {
      const where = ownerFilter ? { ownerId: ownerFilter } : {};
      const raw = await prisma.transformationFacility.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      // ------------------- Map DB → UI shape -------------------
      const data = raw.map(f => ({
        id: f.id,
        facilityName: f.name,
        description: '',                // UI expects a description – not stored, keep empty
        city: f.location,
        status: f.isActive ? 'Disponível' : 'Indisponível',
      }));

      return json(res, data);
    } catch (e) {
      console.error('[facilities GET] →', e);
      return json(res, { error: 'Server error while fetching facilities' }, 500);
    }
  }

  // -------------------------------------------------
  // 3️⃣ POST – create a new facility
  // -------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/facilities') {
    // ---- Parse JSON body -------------------------------------------------
    let body;
    try {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => (raw += chunk));
        req.on('end', () => {
          try {
            resolve(raw ? JSON.parse(raw) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', reject);
      });
    } catch {
      return json(res, { error: 'Invalid JSON body' }, 400);
    }

    // ---- Validate required UI fields ------------------------------------
    const { facilityName, city, status } = body;
    if (!facilityName || !city) {
      return json(res, { error: 'facilityName and city are required' }, 400);
    }

    // ---- Map UI → DB ------------------------------------------------------
    const isActive = status === 'Disponível';

    try {
      const created = await prisma.transformationFacility.create({
        data: {
          ownerId: userId,
          name: facilityName,
          location: city,
          isActive,
          // capacity & processingRate are optional – default to 0 in the schema
          capacity: body.capacity ? Number(body.capacity) : 0,
          processingRate: body.processingRate
            ? Number(body.processingRate)
            : undefined,
        },
      });

      // UI shape for the newly created record
      const result = {
        id: created.id,
        facilityName: created.name,
        description: '',
        city: created.location,
        status: created.isActive ? 'Disponível' : 'Indisponível',
      };
      return json(res, result, 201);
    } catch (e) {
      console.error('[facilities POST] →', e);
      if (e.code === 'P2002') return json(res, { error: 'Duplicate entry' }, 409);
      return json(res, { error: 'Server error while creating facility' }, 500);
    }
  }

  // -------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
