// ===============================================================
// api/payments.js – Payments (Transações) API
// ---------------------------------------------------------------
// Endpoints:
//
//   GET  /api/payments/transactions                → list transactions for the logged‑in user
//   POST /api/payments/transactions                → create a new transaction (buyer initiates)
//   PATCH /api/payments/transactions/:id          → execute an action (FUND, CANCEL, …)
// ---------------------------------------------------------------
// All responses are JSON { data: … } (or { error: … }).
// ===============================================================

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
  // 1️⃣ Authenticate – required for every endpoint
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

  const currentUserId = payload.userId;   // the logged‑in user (buyer or seller)
  const userRole = payload.role || '';    // ADMIN check for extra actions

  // -----------------------------------------------------------------
  // 2️⃣ GET /api/payments/transactions → list for the current user
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/payments/transactions')) {
    try {
      const txns = await prisma.paymentTransaction.findMany({
        where: {
          OR: [
            { buyerId: currentUserId },
            { sellerId: currentUserId }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      // Front‑end expects an array (it will iterate over it). No wrapping needed.
      return json(res, txns);
    } catch (e) {
      console.error('[payments GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/payments/transactions → create a new transaction
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/payments/transactions') {
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

    const { sellerId, amount, description } = body;
    if (!sellerId) return json(res, { error: 'sellerId required' }, 400);
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return json(res, { error: 'valid amount required' }, 400);
    }

    // The buyer is the logged‑in user
    const buyerId = currentUserId;

    // -----------------------------------------------------------------
    // Insert the transaction with status = PENDING
    // -----------------------------------------------------------------
    try {
      const newTxn = await prisma.paymentTransaction.create({
        data: {
          buyerId,
          sellerId,
          amount: Number(amount),
          currency: 'AOA',
          status: 'PENDING',                 // matches enum PaymentStatus in the schema
          type: description?.trim() || null  // optional free‑form description
        }
      });

      // Return the created transaction (status 201 = Created)
      return json(res, newTxn, 201);
    } catch (e) {
      console.error('[payments POST]', e);
      // Duplicate idempotency key or other DB constraint
      if (e.code === 'P2002') return json(res, { error: 'Duplicate transaction' }, 409);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 4️⃣ PATCH /api/payments/transactions/:id → perform an action
  // -----------------------------------------------------------------
  const patchMatch = req.url.match(/^\/api\/payments\/transactions\/([^/]+)$/);
  if (req.method === 'PATCH' && patchMatch) {
    const txnId = patchMatch[1];

    // ---- Parse JSON body (expects { action: "FUND" } etc.) --------------------
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
    if (!action) return json(res, { error: 'action required' }, 400);

    // -----------------------------------------------------------------
    // Load the transaction first (we need current status & participants)
    // -----------------------------------------------------------------
    const txn = await prisma.paymentTransaction.findUnique({
      where: { id: txnId }
    });

    if (!txn) return json(res, { error: 'Transaction not found' }, 404);

    // -----------------------------------------------------------------
    // Helper: who is allowed to do what?
    // -----------------------------------------------------------------
    const isBuyer = txn.buyerId === currentUserId;
    const isSeller = txn.sellerId === currentUserId;
    const isAdmin = userRole === 'ADMIN';

    // -----------------------------------------------------------------
    // Map UI actions → state changes
    // -----------------------------------------------------------------
    let update = {};

    // -------------------------------------------------
    // FUND – buyer funds the transaction (moves PENDING → FUNDED)
    // -------------------------------------------------
    if (action === 'FUND') {
      if (!isBuyer) return json(res, { error: 'Only buyer can fund' }, 403);
      if (txn.status !== 'PENDING') return json(res, { error: 'Can only fund a PENDING txn' }, 400);
      update = { status: 'FUNDED', buyerConfirmed: true };
    }

    // -------------------------------------------------
    // CANCEL – buyer cancels while still pending
    // -------------------------------------------------
    else if (action === 'CANCEL') {
      if (!isBuyer) return json(res, { error: 'Only buyer can cancel' }, 403);
      if (txn.status !== 'PENDING') return json(res, { error: 'Can only cancel a PENDING txn' }, 400);
      update = { status: 'CANCELLED' };
    }

    // -------------------------------------------------
    // SELLER_CONFIRM – seller acknowledges receipt after funding
    // -------------------------------------------------
    else if (action === 'SELLER_CONFIRM') {
      if (!isSeller) return json(res, { error: 'Only seller can confirm' }, 403);
      if (txn.status !== 'FUNDED') return json(res, { error: 'Can only confirm a FUNDED txn' }, 400);
      update = { status: 'SELLER_CONFIRMED', sellerConfirmed: true };
    }

    // -------------------------------------------------
    // BUYER_CONFIRM – buyer acknowledges receipt after seller confirm
    // -------------------------------------------------
    else if (action === 'BUYER_CONFIRM') {
      if (!isBuyer) return json(res, { error: 'Only buyer can confirm' }, 403);
      if (txn.status !== 'SELLER_CONFIRMED') return json(res, { error: 'Can only confirm after seller' }, 400);
      update = { status: 'BUYER_CONFIRMED', buyerConfirmed: true };
    }

    // -------------------------------------------------
    // DISPUTE – either party can dispute a funded or confirmed txn
    // -------------------------------------------------
    else if (action === 'DISPUTE') {
      if (!(isBuyer || isSeller)) return json(res, { error: 'Only participants can dispute' }, 403);
      if (!['FUNDED', 'SELLER_CONFIRMED', 'BUYER_CONFIRMED'].includes(txn.status)) {
        return json(res, { error: 'Can only dispute a funded/confirmed txn' }, 400);
      }
      update = { status: 'DISPUTED' };
    }

    // -------------------------------------------------
    // RELEASE – admin releases escrow after both sides confirmed
    // -------------------------------------------------
    else if (action === 'RELEASE') {
      if (!isAdmin) return json(res, { error: 'Only admin can release' }, 403);
      if (!['BUYER_CONFIRMED', 'SELLER_CONFIRMED'].includes(txn.status)) {
        return json(res, { error: 'Can only release a confirmed txn' }, 400);
      }
      update = { status: 'RELEASED' };
    }

    // -------------------------------------------------
    // REFUND – admin refunds a disputed transaction
    // -------------------------------------------------
    else if (action === 'REFUND') {
      if (!isAdmin) return json(res, { error: 'Only admin can refund' }, 403);
      if (txn.status !== 'DISPUTED') return json(res, { error: 'Can only refund a DISPUTED txn' }, 400);
      update = { status: 'REFUNDED' };
    }

    // -------------------------------------------------
    // Unknown action
    // -------------------------------------------------
    else {
      return json(res, { error: `Unsupported action "${action}"` }, 400);
    }

    // -----------------------------------------------------------------
    // Apply the update
    // -----------------------------------------------------------------
    try {
      const updatedTxn = await prisma.paymentTransaction.update({
        where: { id: txnId },
        data: update
      });
      return json(res, updatedTxn);
    } catch (e) {
      console.error('[payments PATCH]', e);
      return json(res, { error: 'Server error while updating' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
