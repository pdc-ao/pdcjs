// ===============================================================
// api/messages.js – Messaging API
// ---------------------------------------------------------------
// Endpoints:
//
//   GET  /api/messages            → list messages (filterable)
//   POST /api/messages            → send a new message (creates conversation if needed)
// ---------------------------------------------------------------
// All responses are JSON:
//
//   GET  → { messages: [...] }
//   POST → { message: { … } }
//
// The shape matches what dashboard‑messages.html expects.
// ===============================================================

const prisma = require('../../lib/prisma');          // adjust if your lib folder lives elsewhere
const { verifyToken } = require('../../lib/jwt');
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
  // ---------- CORS (catch‑all already adds this, but we keep it safe) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣ Authenticate – required for BOTH GET and POST
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

  const userId = payload.userId;   // the logged‑in user (will be sender)

  // -----------------------------------------------------------------
  // 2️⃣ GET – list messages (optionally filtered)
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/messages')) {
    // ---- Parse query string ------------------------------------------------
    const url = new URL(req.url, `http://${req.headers.host}`);
    const senderId = url.searchParams.get('senderId');          // required by UI
    const receiverId = url.searchParams.get('receiverId');      // optional
    const conversationId = url.searchParams.get('conversationId'); // optional
    const limit = Number(url.searchParams.get('limit') || '100');

    // ---- Build Prisma where clause ----------------------------------------
    const where = {
      OR: [
        { senderId: userId },
        { receiverId: userId }
      ]
    };

    // If the UI supplies extra filters we tighten the query
    if (receiverId) where.receiverId = receiverId;
    if (conversationId) where.conversationId = conversationId;

    try {
      const msgs = await prisma.message.findMany({
        where,
        orderBy: { sentAt: 'asc' },
        take: limit,
        include: {
          sender:   { select: { id: true, email: true, fullName: true } },
          receiver: { select: { id: true, email: true, fullName: true } }
        }
      });

      // The front‑end expects an object with a `messages` array
      return json(res, { messages: msgs });
    } catch (e) {
      console.error('[messages GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST – send a new message (creates conversation when needed)
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/messages') {
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

    const receiverId = body.receiverId;
    const messageContent = body.messageContent?.trim();
    let conversationId = body.conversationId;   // may be undefined

    if (!receiverId) return json(res, { error: 'receiverId required' }, 400);
    if (!messageContent) return json(res, { error: 'messageContent required' }, 400);

    // -----------------------------------------------------------------
    // If the client did NOT send a conversationId we create a brand‑new one
    // -----------------------------------------------------------------
    if (!conversationId) {
      try {
        const newConv = await prisma.conversation.create({
          data: {
            participants: {
              create: [
                { userId: userId },
                { userId: receiverId }
              ]
            }
          },
          select: { id: true }
        });
        conversationId = newConv.id;
      } catch (e) {
        console.error('[messages POST – create conversation]', e);
        return json(res, { error: 'Could not create conversation' }, 500);
      }
    }

    // -----------------------------------------------------------------
    // Insert the message
    // -----------------------------------------------------------------
    try {
      const created = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          receiverId,
          messageContent
        },
        include: {
          sender:   { select: { id: true, email: true, fullName: true } },
          receiver: { select: { id: true, email: true, fullName: true } }
        }
      });

      // Return the newly created message (status 201 = Created)
      return json(res, { message: created }, 201);
    } catch (e) {
      console.error('[messages POST]', e);
      // Prisma unique‑constraint (P2002) → 409 Conflict
      if (e.code === 'P2002') return json(res, { error: 'Duplicate message' }, 409);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};
