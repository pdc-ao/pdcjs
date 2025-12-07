// ===============================================================
// archived-api/storage.js – Storage (Armazenamento) API
// ---------------------------------------------------------------
// Endpoints:
//   GET  /api/storage          → list all storage listings
//        (optional ?ownerId=…) → list only the logged‑in owner’s warehouses
//   POST /api/storage          → create a new storage listing
// ----------------------------------------------------------------
// All responses are JSON: { data: … } (or plain array when filtered)
// ----------------------------------------------------------------
// Executed via the catch‑all `api/[...slug].js`
// ===============================================================

const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');
require('dotenv').config();

// ---------- Tiny JSON helper ----------
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  // ---------- CORS ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // ---------- Authenticate ----------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  const userId = payload.userId;

  // ---------- GET /api/storage ----------
  if (req.method === 'GET' && req.url.startsWith('/api/storage')) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const ownerFilter = urlObj.searchParams.get('ownerId');

    try {
      const where = ownerFilter ? { ownerId: ownerFilter } : {};

      const listings = await prisma.storageListing.findMany({
        where,
        include: {
          owner: { select: { id: true, email: true, fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Add computed capacidade field
      const withCapacidade = listings.map(l => ({
        ...l,
        capacidade: l.totalCapacity && l.capacityUnit
          ? `${l.totalCapacity} ${l.capacityUnit}`
          : null
      }));

      if (ownerFilter) {
        return json(res, withCapacidade);
      }
      return json(res, { data: withCapacidade });
    } catch (e) {
      console.error('[storage GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // ---------- POST /api/storage ----------
  if (req.method === 'POST' && req.url === '/api/storage') {
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

    // ---- Required fields (capacityUnit optional) ----
    const required = [
      'facilityName',
      'storageType',
      'totalCapacity',
      'availabilityStatus'
    ];
    for (const f of required) {
      if (!body[f]) return json(res, { error: `${f} is required` }, 400);
    }

    const data = {
      facilityName: body.facilityName.trim(),
      storageType: body.storageType.trim(),
      totalCapacity: Number(body.totalCapacity),
      availabilityStatus: body.availabilityStatus.trim(),
      capacityUnit: body.capacityUnit?.trim() || null,
      availableCapacity: body.availableCapacity !== undefined
        ? Number(body.availableCapacity)
        : null,
      description: body.description?.trim() || '',
      addressLine1: body.addressLine1?.trim() || '',
      addressLine2: body.addressLine2?.trim() || undefined,
      city: body.city?.trim() || '',
      postalCode: body.postalCode?.trim() || '',
      pricingStructure: body.pricingStructure?.trim() || '',
      latitude: body.latitude !== undefined ? Number(body.latitude) : 0,   // ✅ default to 0
      longitude: body.longitude !== undefined ? Number(body.longitude) : 0, // ✅ default to 0

      // ✅ connect relation instead of ownerId
      owner: { connect: { id: userId } }
    };

    try {
      const newListing = await prisma.storageListing.create({
        data,
        include: {
          owner: { select: { id: true, email: true, fullName: true } }
        }
      });

      const response = {
        ...newListing,
        capacidade: newListing.totalCapacity && newListing.capacityUnit
          ? `${newListing.totalCapacity} ${newListing.capacityUnit}`
          : null
      };

      return json(res, { data: response }, 201);
    } catch (e) {
      console.error('[storage POST]', e);
      if (e.code === 'P2002') {
        return json(res, { error: 'Duplicate entry' }, 409);
      }
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // ---------- Fallback ----------
  return json(res, { error: 'Method not allowed' }, 405);
};