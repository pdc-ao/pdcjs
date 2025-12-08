// -----------------------------------------------------------------------------
// src/reviews/index.js
// -----------------------------------------------------------------------------
// End‑points:
//   GET  /api/reviews   → list reviews received by the logged‑in user
//   POST /api/reviews   → create a new review for another user
// -----------------------------------------------------------------------------
// • Uses the Prisma model `review` (the correct table name).  
// • UI sends `targetId` (user UUID or email); we resolve that to the real
//   `User.id` and store it in `reviewedUserId`.  
// • Global catch‑all already parses JSON bodies, so we read `req.body` directly.
// -----------------------------------------------------------------------------

const prisma = require('../../lib/prisma');          // two levels up from src/reviews
const { verifyToken } = require('../../lib/jwt');   // same
require('dotenv').config();                         // loads DB URL, JWT secret, etc.

module.exports = async (req, res) => {
  // --------------------------------------------------------------
  // 1️⃣  Authenticate (required for both GET & POST)
  // --------------------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  let payload;
  try {
    payload = verifyToken(token); // must contain at least { userId }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const currentUserId = payload.userId; // the logged‑in user (the reviewer)

  // --------------------------------------------------------------
  // 2️⃣  GET – list reviews **received** by the current user
  // --------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const reviews = await prisma.review.findMany({
        where: {
          reviewedUserId: currentUserId,   // ← correct field
          // If you only want admin‑approved reviews uncomment:
          // isApprovedByAdmin: true,
        },
        include: {
          reviewer: {
            select: { id: true, email: true, fullName: true },
          },
        },
        orderBy: { reviewDate: 'desc' },
      });

      // The UI expects `{ data: [...] }`
      return res.json({ data: reviews });
    } catch (e) {
      console.error('[REVIEWS GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 3️⃣  POST – create a new review for another user
  // --------------------------------------------------------------
  if (req.method === 'POST') {
    // The global catch‑all already parsed JSON, so we can use req.body
    const body = req.body || {};

    const { targetId, rating, comment } = body;

    // ---- Basic validation ----
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required (email or UUID)' });
    }
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res
        .status(400)
        .json({ error: 'rating must be an integer between 1 and 5' });
    }

    // ---- Resolve the target user (UUID first, then email) ----
    let targetUser;
    try {
      // Try UUID
      targetUser = await prisma.user.findUnique({
        where: { id: targetId.trim() },
        select: { id: true },
      });
      // If not found, try email
      if (!targetUser) {
        targetUser = await prisma.user.findUnique({
          where: { email: targetId.trim() },
          select: { id: true },
        });
      }
    } catch (e) {
      console.error('[REVIEWS POST – resolve target]', e);
      return res.status(500).json({ error: 'Server error while looking up target' });
    }

    if (!targetUser) {
      return res
        .status(404)
        .json({ error: `User "${targetId}" not found` });
    }

    // ---- Prevent self‑review ----
    if (targetUser.id === currentUserId) {
      return res.status(400).json({ error: 'You cannot review yourself' });
    }

    // ---- Optional: prevent duplicate reviews from the same reviewer ----
    const existing = await prisma.review.findFirst({
      where: {
        reviewerId: currentUserId,
        reviewedUserId: targetUser.id,
      },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: 'You have already reviewed this user' });
    }

    // ---- Build the Prisma payload ----
    const data = {
      reviewerId: currentUserId,
      reviewedUserId: targetUser.id,
      reviewedEntityType: 'USER', // UI only deals with user‑to‑user reviews
      rating: ratingNum,
      comment: comment?.trim() || '',
      // reviewDate defaults to now()
      // isApprovedByAdmin defaults to true (change if you need moderation)
    };

    try {
      const newReview = await prisma.review.create({
        data,
        include: {
          reviewer: { select: { id: true, email: true, fullName: true } },
        },
      });

      // Return the newly created review (status 201 = Created)
      return res.status(201).json({ data: newReview });
    } catch (e) {
      console.error('[REVIEWS POST]', e);
      if (e.code === 'P2002') {
        // Duplicate unique constraint (unlikely here, but safe)
        return res.status(409).json({ error: 'Duplicate entry' });
      }
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // --------------------------------------------------------------
  // 4️⃣  Anything else → 405 Method Not Allowed
  // --------------------------------------------------------------
  return res.status(405).json({ error: 'Method not allowed' });
};
