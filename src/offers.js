// ---------------------------------------------------------------------------
// api/offers.js – Offers (Serviços) API
// ---------------------------------------------------------------------------
// Endpoints:
//   POST /api/offers → create a new offering (service)
//   GET  /api/offers → list all offerings (not required for the button,
//                     but kept for completeness)
// ---------------------------------------------------------------------------

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { verifyToken } = require('../lib/jwt');   // same as other APIs
require('dotenv').config();                      // loads JWT secret, DB URL, etc.

// ----------------------- tiny JSON helper (exactly like transformation.js) -----------------------
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
  // CORS (already added by the global catch‑all, but keep it for safety)
  // -------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // 1️⃣ Authenticate – same logic used in transformation.js
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
  const userId = payload.userId;   // <-- will become the `ownerId` of the offering

  // -------------------------------------------------
  // 2️⃣ POST /api/offers → create a new offering
  // -------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/offers') {
    // ---- Parse JSON body ----------------------------------------------------
    let body;
    try {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
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

    // ---- Validate required fields --------------------------------------------
    const { title, description, status } = body;
    if (!title || !description) {
      return json(res, { error: 'title & description are required' }, 400);
    }

    // ---- Map UI `status` (string) → DB field(s) --------------------------------
    // The `Offering` model only has `title`, `description`, `ownerId`.
    // If you want to keep the UI status you can store it in a JSON column
    // called `metadata` (add it later).  For now we just ignore it.
    // (If you later add a `status` column, replace the line below with the proper field.)

    try {
      const newOffering = await prisma.offering.create({
        data: {
          title,
          description,
          ownerId: userId,
          // optional: metadata: { status: status ?? 'Ativo' }
        },
      });

      // -------------------------------------------------
      // 3️⃣ Success – return the created record (201)
      // -------------------------------------------------
      return json(res, newOffering, 201);
    } catch (e) {
      console.error('[api/offers] DB error →', e);
      // Prisma duplicate key → 409, otherwise 500
      if (e.code === 'P2002') return json(res, { error: 'Duplicate entry' }, 409);
      return json(res, { error: 'Server error while creating offering' }, 500);
    }
  }

  // -------------------------------------------------
  // 4️⃣ GET /api/offers → list all (optional, helpful for debugging)
  // -------------------------------------------------
  if (req.method === 'GET' && req.url === '/api/offers') {
    try {
      const all = await prisma.offering.findMany({
        select: { id: true, title: true, description: true, ownerId: true },
        orderBy: { createdAt: 'desc' },
      });
      return json(res, { data: all });
    } catch (e) {
      console.error('[api/offers] GET error →', e);
      return json(res, { error: 'Server error while fetching offerings' }, 500);
    }
  }

  // -------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
