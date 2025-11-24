// ================================================================
// api/products/[id].js – Single product handler (GET, PATCH, DELETE)
// ---------------------------------------------------------------
// GET    → fetch a product by id
// PATCH  → update fields (requires ADMIN / PRODUCER)
// DELETE → delete product (requires ADMIN)
// ================================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { verifyToken } = require('../../lib/jwt');
require('dotenv').config();

// ------------------- tiny JSON helper (same as other APIs) -------------------
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // 1️⃣ Extract ID from URL (e.g. /api/products/ck1abc123)
  // -------------------------------------------------
  const parts = req.url.split('/');
  const id = Number(parts[parts.length - 1]); // last segment
  if (!id) return json(res, { error: 'Invalid id' }, 400);

  // -------------------------------------------------
  // 2️⃣ GET – public, no auth needed
  // -------------------------------------------------
  if (req.method === 'GET') {
    try {
      const product = await prisma.productListing.findUnique({ where: { id } });
      if (!product) return json(res, { error: 'Not found' }, 404);
      return json(res, { data: product });
    } catch (e) {
      console.error('[product GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -------------------------------------------------
  // 3️⃣ Authenticated routes (PATCH, DELETE)
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

  // -------------------------------------------------
  // 4️⃣ PATCH – update product (admin / producer only)
  // -------------------------------------------------
  if (req.method === 'PATCH' || req.method === 'PUT') {
    // ---- Only allowed roles -------------------------------------------------
    if (!['ADMIN', 'PRODUCER', 'FACILITY_OWNER'].includes(payload.role)) {
      return json(res, { error: 'Insufficient permissions' }, 403);
    }

    // ---- Parse JSON body ----------------------------------------------------
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

    // ---- Build Prisma update payload ----------------------------------------
    const data = {};
    if (body.title) data.title = body.title;
    if (body.description) data.description = body.description;
    if (body.category) data.category = body.category;
    if (body.price) data.pricePerUnit = Number(body.price);
    if (body.quantity) data.quantityAvailable = Number(body.quantity);
    if (body.unit) data.unitOfMeasure = body.unit;
    if (body.status) data.status = body.status;

    try {
      const updated = await prisma.productListing.update({
        where: { id },
        data,
      });
      return json(res, { data: updated });
    } catch (e) {
      console.error('[product PATCH]', e);
      return json(res, { error: 'Server error while updating' }, 500);
    }
  }

  // -------------------------------------------------
  // 5️⃣ DELETE – remove product (admin only)
  // -------------------------------------------------
  if (req.method === 'DELETE') {
    if (!['ADMIN'].includes(payload.role)) {
      return json(res, { error: 'Insufficient permissions' }, 403);
    }

    try {
      await prisma.productListing.delete({ where: { id } });
      // 204 No Content – we still send a tiny JSON payload for consistency
      return json(res, { message: 'Deleted' }, 204);
    } catch (e) {
      console.error('[product DELETE]', e);
      return json(res, { error: 'Server error while deleting' }, 500);
    }
  }

  // -------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
