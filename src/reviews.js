// ===============================================================
// api/reviews.js – Reviews (Avaliações) API
// ---------------------------------------------------------------
// Endpoints:
//   GET  /api/reviews          → list reviews received by logged‑in user
//   POST /api/reviews          → create a new review for another user
// ---------------------------------------------------------------
// All responses are JSON: { data: [...] } (or { error: … } on failure)
// --------------------------------------------------------------
const prisma = require('../lib/prisma');          // adjust if your lib folder lives elsewhere
const { verifyToken } = require('../lib/jwt');
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
  // ---------- CORS (the outer catch‑all already adds this, but keep safe) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣ Authentication – required for both GET and POST
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

  const currentUserId = payload.userId;   // reviewer (the logged‑in user)

  // -----------------------------------------------------------------
  // 2️⃣ GET /api/reviews → list reviews *received* by the current user
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/reviews')) {
    try {
      const reviews = await prisma.review.findMany({
        where: {
          reviewedUserId: currentUserId,
          // Optional: only show approved reviews
          // isApprovedByAdmin: true
        },
        include: {
          reviewer: {
            select: { id: true, email: true, fullName: true }
          }
        },
        orderBy: { reviewDate: 'desc' }
      });

      // UI expects an array under the key `data`
      return json(res, { data: reviews });
    } catch (e) {
      console.error('[reviews GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/reviews → create a new review
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/reviews') {
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

    const targetIdentifier = (body.targetId || '').trim();   // may be email or uuid
    const rating = Number(body.rating);
    const comment = (body.comment || '').trim() || null;

    // ---- Basic validation ----------------------------------------------------
    if (!targetIdentifier) {
      return json(res, { error: 'targetId is required (email or UUID)' }, 400);
    }
    if (!rating || rating < 1 || rating > 5) {
      return json(res, { error: 'rating must be an integer between 1 and 5' }, 400);
    }

    // ---- Resolve the target user (by UUID first, then by email) ----------------
    let targetUser;
    try {
      // Try UUID
      targetUser = await prisma.user.findUnique({
        where: { id: targetIdentifier },
        select: { id: true }
      });
      // If not found, try email
      if (!targetUser) {
        targetUser = await prisma.user.findUnique({
          where: { email: targetIdentifier },
          select: { id: true }
        });
      }
    } catch (e) {
      console.error('[reviews POST – resolve target]', e);
      return json(res, { error: 'Server error while looking up target user' }, 500);
    }

    if (!targetUser) {
      return json(res, { error: `User "${targetIdentifier}" not found` }, 404);
    }

    // ---- Prevent self‑review -------------------------------------------------
    if (targetUser.id === currentUserId) {
      return json(res, { error: 'You cannot review yourself' }, 400);
    }

    // ---- Optional: prevent duplicate reviews from the same reviewer -------
    const existing = await prisma.review.findFirst({
      where: {
        reviewerId: currentUserId,
        reviewedUserId: targetUser.id
        // If you want to allow multiple reviews, remove this block.
      }
    });
    if (existing) {
      return json(res, { error: 'You have already reviewed this user' }, 409);
    }

    // ---- Build the Prisma create payload ------------------------------------
    const data = {
      reviewerId: currentUserId,
      reviewedUserId: targetUser.id,
      reviewedEntityType: 'USER', // UI only deals with user‑to‑user reviews
      rating,
      comment,
      // reviewDate defaults to now()
      // isApprovedByAdmin defaults to true (you can change if you need moderation)
    };

    try {
      const newReview = await prisma.review.create({
        data,
        include: {
          reviewer: { select: { id: true, email: true, fullName: true } }
        }
      });

      // Return the freshly created review (status 201 = Created)
      return json(res, { data: newReview }, 201);
    } catch (e) {
      console.error('[reviews POST]', e);
      if (e.code === 'P2002') {
        // Unique‑constraint violation (unlikely here, but keep for safety)
        return json(res, { error: 'Duplicate entry' }, 409);
      }
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
