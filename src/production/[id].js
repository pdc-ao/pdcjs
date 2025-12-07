// ---------------------------------------------------------------------------
// api/production/[id].js – Update / Delete a single Production Plan
// ---------------------------------------------------------------------------
// Endpoints:
//   PATCH /api/production/:id   → edit fields (productName, areaSize, status, …)
//   DELETE /api/production/:id  → delete the plan
// ---------------------------------------------------------------------------

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { verifyToken } = require('../../lib/jwt');
require('dotenv').config();

// tiny json helper – same as other API files
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
  // CORS
  // -------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // 1️⃣ Authenticate
  // -------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  try {
    verifyToken(token); // we only need to ensure it’s valid
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  // -------------------------------------------------
  // Extract ID from URL (e.g. /api/production/ck1abc123)
  // -------------------------------------------------
  const parts = req.url.split('/');
  const planId = parts[parts.length - 1]; // last segment

  // -------------------------------------------------
  // DELETE – remove a plan
  // -------------------------------------------------
  if (req.method === 'DELETE') {
    try {
      await prisma.productionPlan.delete({ where: { id: planId } });
      return json(res, { message: 'Plan deleted' });
    } catch (e) {
      console.error('[production DELETE] →', e);
      return json(res, { error: 'Plan not found or cannot be deleted' }, 404);
    }
  }

  // -------------------------------------------------
  // PATCH – update a plan
  // -------------------------------------------------
  if (req.method === 'PATCH') {
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

    // ---- Build Prisma update payload ---------------------------------
    const data = {};
    if (body.productName) data.productName = body.productName;
    if (body.areaSize) data.areaSize = Number(body.areaSize);
    if (body.areaUnit) data.areaUnit = body.areaUnit;
    if (body.status) data.status = body.status;
    if (body.estimatedHarvestDate) {
      data.estimatedHarvestDate = new Date(body.estimatedHarvestDate);
    }

    try {
      const updated = await prisma.productionPlan.update({
        where: { id: planId },
        data,
      });

      const result = {
        id: updated.id,
        productName: updated.productName,
        areaSize: updated.areaSize,
        areaUnit: updated.areaUnit,
        status: updated.status,
        estimatedHarvestDate: updated.estimatedHarvestDate
          ? new Date(updated.estimatedHarvestDate).toISOString().split('T')[0]
          : null,
      };
      return json(res, result);
    } catch (e) {
      console.error('[production PATCH] →', e);
      return json(res, { error: 'Plan not found or update failed' }, 404);
    }
  }

  // -------------------------------------------------
  // Anything else → 405
  // -------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
