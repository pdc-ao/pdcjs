// ---------------------------------------------------------------------------
// api/production.js – Production Plans API
// ---------------------------------------------------------------------------
// Endpoints:
//   GET  /api/production          → list plans (optional filter ?producerId=…)
//   POST /api/production          → create a new plan
// ---------------------------------------------------------------------------

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { verifyToken } = require('../lib/jwt');
require('dotenv').config();               // loads JWT secret, DB URL, …

// ------------------- tiny JSON helper (identical to transformation.js) -------------------
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
  // 1️⃣ Authenticate – same flow as other APIs
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
  const userId = payload.userId; // producer who owns the plan

  // -------------------------------------------------
  // 2️⃣ GET – list production plans (optional filter by producerId)
  // -------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/production')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const filterProducer = urlObj.searchParams.get('producerId');

    try {
      const where = filterProducer ? { producerId: filterProducer } : {};
      const raw = await prisma.productionPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      // UI shape expected by the front‑end
      const data = raw.map(p => ({
        id: p.id,
        productName: p.productName,
        areaSize: p.areaSize,
        areaUnit: p.areaUnit,
        status: p.status,
        estimatedHarvestDate: p.estimatedHarvestDate
          ? new Date(p.estimatedHarvestDate).toISOString().split('T')[0]
          : null,
      }));
      return json(res, data);
    } catch (e) {
      console.error('[production GET] →', e);
      return json(res, { error: 'Server error while fetching plans' }, 500);
    }
  }

  // -------------------------------------------------
  // 3️⃣ POST – create a new production plan
  // -------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/production') {
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
    const {
      productName,
      areaSize,
      areaUnit,
      status,
      estimatedHarvestDate,
    } = body;

    if (!productName || !areaSize || !areaUnit) {
      return json(res, { error: 'productName, areaSize & areaUnit are required' }, 400);
    }

    // ---- Build Prisma payload -------------------------------------------
    try {
      const created = await prisma.productionPlan.create({
        data: {
          producerId: userId,
          productName,
          areaSize: Number(areaSize),
          areaUnit,
          status: status || 'PLANNED',            // default if not supplied
          estimatedHarvestDate: estimatedHarvestDate
            ? new Date(estimatedHarvestDate)
            : undefined,
        },
      });

      const result = {
        id: created.id,
        productName: created.productName,
        areaSize: created.areaSize,
        areaUnit: created.areaUnit,
        status: created.status,
        estimatedHarvestDate: created.estimatedHarvestDate
          ? new Date(created.estimatedHarvestDate).toISOString().split('T')[0]
          : null,
      };
      return json(res, result, 201);
    } catch (e) {
      console.error('[production POST] →', e);
      if (e.code === 'P2002') return json(res, { error: 'Duplicate entry' }, 409);
      return json(res, { error: 'Server error while creating plan' }, 500);
    }
  }

  // -------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
