// ---------------------------------------------------------------------------
// api/storage/[id].js – Get / Update / Delete a single warehouse
// ---------------------------------------------------------------------------
// Endpoints:
//   GET    /api/storage/:id       → fetch a warehouse (public)
//   PATCH  /api/storage/:id       → edit (owner only)
//   DELETE /api/storage/:id       → delete (owner only)
// ---------------------------------------------------------------------------

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { verifyToken } = require('../../lib/jwt');
require('dotenv').config();

// tiny json helper – identical to the other API files
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
module.exports = async (req, res) => {
  // -------------------------------------------------
  // CORS (same as other APIs)
  // -------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // Extract the warehouse ID from the URL (last segment)
  // -------------------------------------------------
  const parts = req.url.split('/');
  const id = parts[parts.length - 1]; // e.g. ".../api/storage/ck1ab..."

  // -------------------------------------------------
  // 1️⃣ GET – public, no auth needed
  // -------------------------------------------------
  if (req.method === 'GET') {
    try {
      const wh = await prisma.storageListing.findUnique({ where: { id } });
      if (!wh) return json(res, { error: 'Not found' }, 404);

      const result = {
        id: wh.id,
        facilityName: wh.facilityName,
        description: wh.description,
        city: wh.city,
        availabilityStatus: wh.availabilityStatus,
      };
      return json(res, result);
    } catch (e) {
      console.error('[storage GET id] →', e);
      return json(res, { error: 'Server error while fetching warehouse' }, 500);
    }
  }

  // -------------------------------------------------
  // 2️⃣ Authenticated routes (PATCH, DELETE)
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
  // Verify that the logged‑in user is the **owner** of the warehouse
  // -------------------------------------------------
  const warehouse = await prisma.storageListing.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!warehouse) return json(res, { error: 'Warehouse not found' }, 404);
  if (warehouse.ownerId !== payload.userId) {
    return json(res, { error: 'Not authorized' }, 403);
  }

  // -------------------------------------------------
  // 3️⃣ PATCH – update fields (facilityName, description, city, availabilityStatus)
  // -------------------------------------------------
  if (req.method === 'PATCH') {
    // ---- Parse body -------------------------------------------------
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

    // ---- Build Prisma update payload ---------------------------------
    const data = {};
    if (body.facilityName) data.facilityName = body.facilityName;
    if (body.description) data.description = body.description;
    if (body.city) data.city = body.city;
    if (body.availabilityStatus) data.availabilityStatus = body.availabilityStatus;

    try {
      const updated = await prisma.storageListing.update({
        where: { id },
        data,
      });
      const result = {
        id: updated.id,
        facilityName: updated.facilityName,
        description: updated.description,
        city: updated.city,
        availabilityStatus: updated.availabilityStatus,
      };
      return json(res, result);
    } catch (e) {
      console.error('[storage PATCH] →', e);
      return json(res, { error: 'Server error while updating warehouse' }, 500);
    }
  }

  // -------------------------------------------------
  // 4️⃣ DELETE – remove the warehouse
  // -------------------------------------------------
  if (req.method === 'DELETE') {
    try {
      await prisma.storageListing.delete({ where: { id } });
      // 204 No Content – we still send a tiny JSON payload for consistency
      return json(res, { message: 'Deleted' }, 204);
    } catch (e) {
      console.error('[storage DELETE] →', e);
      return json(res, { error: 'Server error while deleting warehouse' }, 500);
    }
  }

  // -------------------------------------------------
  // Anything else → 405
  // -------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
