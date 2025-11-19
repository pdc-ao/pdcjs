// ===============================================================
// api/admin.js – Admin (Administração) API
// ---------------------------------------------------------------
// Endpoints:
//
//   GET  /api/admin/users          → list pending users
//   PATCH /api/admin/users/:id    → { action: "APPROVE"|"REJECT" }
//   GET  /api/admin/documents     → list pending documents
//   PATCH /api/admin/documents/:id → { action: "APPROVE"|"REJECT" }
//   GET  /api/admin/payments      → list recent payment transactions
// ---------------------------------------------------------------
// All responses are JSON { data: [...] } (or { error: … }).
// --------------------------------------------------------------

const prisma = require('../lib/prisma');          // adjust if lib folder lives elsewhere
const { verifyToken } = require('../lib/jwt');
require('dotenv').config();                       // loads DB URL, JWT secret, etc.

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
  // ---------- CORS (the outer catch‑all already adds this, but keep safe) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣ Authenticate – all admin endpoints require a valid JWT + ADMIN role
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

  // Only users with role ADMIN can use these routes
  if (payload.role !== 'ADMIN') {
    return json(res, { error: 'Insufficient permissions' }, 403);
  }

  const adminId = payload.userId; // not used here, but kept for possible audit logs

  // -----------------------------------------------------------------
  // 2️⃣ Helper: extract the ":id" param from a URL like /api/admin/users/:id
  // -----------------------------------------------------------------
  const urlParts = req.url.split('/').filter(Boolean); // removes empty parts
  // urlParts example for PATCH /api/admin/users/12345 → ["api","admin","users","12345"]
  const idParam = urlParts[3]; // index 3 = the ":id" segment (if present)

  // -----------------------------------------------------------------
  // 3️⃣ USERS – pending verification
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url === '/api/admin/users') {
    try {
      const pending = await prisma.user.findMany({
        where: { verificationStatus: 'PENDING' },
        select: { id: true, email: true, role: true, verificationStatus: true }
      });
      return json(res, { data: pending });
    } catch (e) {
      console.error('[admin users GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // PATCH /api/admin/users/:id → approve or reject
  if (req.method === 'PATCH' && /^\/api\/admin\/users\/[^/]+$/.test(req.url)) {
    // ---- Parse JSON body (expects { action: "APPROVE" | "REJECT" }) ------------
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

    const newStatus = action === 'APPROVE' ? 'VERIFIED' : 'REJECTED';

    try {
      const updatedUser = await prisma.user.update({
        where: { id: idParam },
        data: { verificationStatus: newStatus }
      });
      return json(res, { data: updatedUser });
    } catch (e) {
      console.error('[admin users PATCH]', e);
      if (e.code === 'P2025') { // record not found
        return json(res, { error: 'User not found' }, 404);
      }
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 4️⃣ DOCUMENTS – pending review
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url === '/api/admin/documents') {
    try {
      const pendingDocs = await prisma.document.findMany({
        where: { status: 'PENDING_REVIEW' },
        include: {
          user: { select: { id: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Simplify for the UI
      const payload = pendingDocs.map(d => ({
        id: d.id,
        userId: d.user?.id || '',
        userEmail: d.user?.email || '',
        type: d.type,
        status: d.status
      }));

      return json(res, { data: payload });
    } catch (e) {
      console.error('[admin documents GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // PATCH /api/admin/documents/:id → approve or reject
  if (req.method === 'PATCH' && /^\/api\/admin\/documents\/[^/]+$/.test(req.url)) {
    // ---- Parse JSON body (expects { action: "APPROVE" | "REJECT" }) ------------
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

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    try {
      const updatedDoc = await prisma.document.update({
        where: { id: idParam },
        data: { status: newStatus }
      });
      return json(res, { data: updatedDoc });
    } catch (e) {
      console.error('[admin documents PATCH]', e);
      if (e.code === 'P2025') { // not found
        return json(res, { error: 'Document not found' }, 404);
      }
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 5️⃣ PAYMENTS – recent transactions (read‑only)
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url === '/api/admin/payments') {
    try {
      const recent = await prisma.paymentTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,                         // adjust as needed
        include: {
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true } }
        }
      });

      // Flatten for the UI table
      const payload = recent.map(t => ({
        id: t.id,
        sender: t.buyer?.email || t.buyerId,
        receiver: t.seller?.email || t.sellerId,
        amount: Number(t.amount),
        status: t.status
      }));

      return json(res, { data: payload });
    } catch (e) {
      console.error('[admin payments GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
