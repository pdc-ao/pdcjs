// ---------------------------------------------------------------------------
// api/facilities/[id].js – Facility DELETE / PATCH
// ---------------------------------------------------------------------------
// Endpoints:
//   DELETE /api/facilities/:id → remove a facility
//   PATCH  /api/facilities/:id → edit name / city / status
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
  // CORS (same as the others)
  // -------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // 1️⃣ Authenticate
  // -------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  try {
    verifyToken(token); // we only need to check it – owner check is done later
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  // -------------------------------------------------
  // Extract the facility ID from the URL (e.g. /api/facilities/ck1…)
  // -------------------------------------------------
  const parts = req.url.split('/');
  const facilityId = parts[parts.length - 1]; // last segment

  // -------------------------------------------------
  // DELETE – remove the facility
  // -------------------------------------------------
  if (req.method === 'DELETE') {
    try {
      await prisma.transformationFacility.delete({
        where: { id: facilityId },
      });
      return json(res, { message: 'Facility deleted' });
    } catch (e) {
      console.error('[facilities DELETE] →', e);
      return json(res, { error: 'Facility not found or cannot be deleted' }, 404);
    }
  }

  // -------------------------------------------------
  // PATCH – update name / city / status
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

    // ---- Build the Prisma update payload ---------------------------------
    const data = {};
    if (body.facilityName) data.name = body.facilityName;
    if (body.city) data.location = body.city;
    if (body.status) data.isActive = body.status === 'Disponível';

    try {
      const updated = await prisma.transformationFacility.update({
        where: { id: facilityId },
        data,
      });

      // Return the UI‑shaped object
      const result = {
        id: updated.id,
        facilityName: updated.name,
        description: '',
        city: updated.location,
        status: updated.isActive ? 'Disponível' : 'Indisponível',
      };
      return json(res, result);
    } catch (e) {
      console.error('[facilities PATCH] →', e);
      return json(res, { error: 'Facility not found or update failed' }, 404);
    }
  }

  // -------------------------------------------------
  // Anything else → 405
  // -------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
