// ===============================================================
// api/transformation.js – Transformation (Facilidade) API
// ---------------------------------------------------------------
// Endpoints:
//   GET  /api/transformation   → list all transformation facilities
//   POST /api/transformation   → create a new facility (capacity defaults to 0)
// ----------------------------------------------------------------
// Returns JSON { data: [...] } (or { error: … }) – same shape as the
// other APIs (products, storage, transport, …).
// ===============================================================

const prisma = require('../../lib/prisma');          // adjust if lib folder is elsewhere
const { verifyToken } = require('../../lib/jwt');
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
  // ---------- CORS (the outer catch‑all already adds this, but we keep it) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣ Authenticate – every endpoint needs a valid JWT
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

  const userId = payload.userId;   // the owner of the facility

  // -----------------------------------------------------------------
  // 2️⃣ GET /api/transformation → list all facilities
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/transformation')) {
    try {
      const raw = await prisma.transformationFacility.findMany({
        select: {
          id: true,
          name: true,
          serviceType: true,
          location: true,
          isActive: true,
          ownerId: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Map DB → UI field names
      const transformed = raw.map(fac => ({
        id: fac.id,
        name: fac.name,
        type: fac.serviceType,                              // UI expects `type`
        location: fac.location,
        status: fac.isActive ? 'Disponível' : 'Indisponível', // UI expects string
        ownerId: fac.ownerId
      }));

      return json(res, { data: transformed });
    } catch (e) {
      console.error('[transformation GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/transformation → create a new facility
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/transformation') {
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

    // ---- Validate required UI fields ----------------------------------------
    const required = ['name', 'type', 'location', 'status'];
    for (const f of required) {
      if (!body[f]) return json(res, { error: `${f} is required` }, 400);
    }

    // ---- UI `status` (string) → DB `isActive` (boolean) --------------------
    const isActive = body.status === 'Disponível';

    // ---- Build Prisma `create` payload --------------------------------------
    const data = {
      ownerId: userId,
      name: body.name,
      serviceType: body.type,
      location: body.location,
      isActive,
      // **capacity is required in the schema.** If the client does not send
      // one, we default to 0 (you can change this to any sensible number).
      capacity: body.capacity ? Number(body.capacity) : 0,
      // `processingRate` has a DB default of 0, so we can omit it unless you
      // want to set a custom value.
      processingRate: body.processingRate
        ? Number(body.processingRate)
        : undefined
    };

    try {
      const created = await prisma.transformationFacility.create({
        data,
        select: {
          id: true,
          name: true,
          serviceType: true,
          location: true,
          isActive: true,
          ownerId: true
        }
      });

      // Map back to the UI shape
      const mapped = {
        id: created.id,
        name: created.name,
        type: created.serviceType,
        location: created.location,
        status: created.isActive ? 'Disponível' : 'Indisponível',
        ownerId: created.ownerId
      };

      return json(res, { data: mapped }, 201);
    } catch (e) {
      console.error('[transformation POST]', e);
      if (e.code === 'P2002') return json(res, { error: 'Duplicate entry' }, 409);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
