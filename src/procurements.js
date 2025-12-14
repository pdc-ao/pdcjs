// ===============================================================
// api/procurements.js – Procurement API
// ---------------------------------------------------------------
// Endpoints:
//
//   GET  /api/procurements                → list all procurement requests
//   POST /api/procurements                → create a new request
//   PATCH /api/procurements/:id           → update status (APPROVE / REJECT)
// ---------------------------------------------------------------
// All responses are JSON { data: … } (or { error: … }).
// ===============================================================

const prisma = require('../../lib/prisma');          // ← corrected
const { verifyToken } = require('../../lib/jwt');    // ← corrected
require('dotenv').config();

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
  // ---------- CORS (the outer catch‑all already adds this, but keep it safe) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣ Authenticate – required for all endpoints
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

  const currentUserId = payload.userId;   // the logged‑in user (buyer)

  // -----------------------------------------------------------------
  // 2️⃣ GET /api/procurements → list all requests (admin sees all, buyer sees own)
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/procurements')) {
    try {
      const where = {}; // admin sees everything; non‑admin sees only own
      if (payload.role !== 'ADMIN') {
        where.buyerId = currentUserId;
      }

      const requests = await prisma.procurementRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, title: true } },
          buyer:   { select: { id: true, email: true, fullName: true } }
        }
      });

      // Shape for the UI:
      const data = requests.map(r => ({
        id: r.id,
        product: r.product.title,
        productId: r.product.id,
        quantity: r.quantity,
        status: r.status,
        buyerId: r.buyer.id,
        buyerEmail: r.buyer.email,
        buyerName: r.buyer.fullName
      }));

      return json(res, { data });
    } catch (e) {
      console.error('[procurements GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/procurements → create a new request (buyer only)
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/procurements') {
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

    const { productId, quantity } = body;
    if (!productId) return json(res, { error: 'productId required' }, 400);
    if (!quantity || quantity <= 0) return json(res, { error: 'valid quantity required' }, 400);

    try {
      const newReq = await prisma.procurementRequest.create({
        data: {
          productId,
          buyerId: currentUserId,
          quantity: Number(quantity),
          status: 'PENDENTE'
        },
        include: {
          product: { select: { title: true } }
        }
      });

      const result = {
        id: newReq.id,
        product: newReq.product.title,
        quantity: newReq.quantity,
        status: newReq.status,
        buyerId: currentUserId
      };

      return json(res, { data: result }, 201);
    } catch (e) {
      console.error('[procurements POST]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 4️⃣ PATCH /api/procurements/:id → admin updates status (APPROVE / REJECT)
  // -----------------------------------------------------------------
  const patchMatch = req.url.match(/^\/api\/procurements\/([^/]+)$/);
  if (req.method === 'PATCH' && patchMatch) {
    const procId = patchMatch[1];

    // Only ADMIN can change status
    if (payload.role !== 'ADMIN') {
      return json(res, { error: 'Insufficient permissions' }, 403);
    }

    // ---- Parse JSON body (expects { action: "APPROVE" | "REJECT" }) ---------
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

    const action = (body.action || '').toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return json(res, { error: 'Invalid action' }, 400);
    }

    const newStatus = action === 'APPROVE' ? 'APROVADO' : 'REJEITADO';

    try {
      const updated = await prisma.procurementRequest.update({
        where: { id: procId },
        data: { status: newStatus }
      });
      return json(res, { data: updated });
    } catch (e) {
      console.error('[procurements PATCH]', e);
      if (e.code === 'P2025') return json(res, { error: 'Request not found' }, 404);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
